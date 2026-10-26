import os
import csv
import qrcode
import datetime
from io import StringIO
from flask import Blueprint, render_template, request, redirect, session, url_for, jsonify, Response, flash, make_response, current_app
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash
from models import Book, Student, Paper, IssueRecord, db, log_audit
from services.scanner import camera_manager, gen_frames
from sqlalchemy import func
from notification_service import notify_issue_book, notify_return_book, notify_new_paper, notify_new_book

web_bp = Blueprint('web', __name__)

@web_bp.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@web_bp.route('/toggle_camera/<action>')
def toggle_camera(action):
    if action == 'start':
        camera_manager.start()
    else:
        camera_manager.stop()
    return jsonify({"status": "success", "active": camera_manager.active})

@web_bp.route('/check_scan')
def check_scan():
    last_code = camera_manager.get_last_scanned()
    if last_code:
        raw_data = str(last_code).strip()
        if "STUDENT:" in raw_data:
            res_type, res_id = "student", raw_data.replace("STUDENT:", "")
        elif "BOOK:" in raw_data:
            res_type, res_id = "book", raw_data.replace("BOOK:", "")
        else:
            res_type, res_id = "book", raw_data

        camera_manager.reset_last_scanned()
        return jsonify({"status": "found", "type": res_type, "id": res_id})
    return jsonify({"status": "searching"})

@web_bp.route('/scanning')
def scanning(): 
    return render_template('scanning.html')

@web_bp.route('/lib_dash')
def lib_dash():
    if session.get('role') != 'librarian':
        return redirect(url_for('auth.login'))

    total_physical = db.session.query(db.func.sum(Book.available)).scalar() or 0
    total_unique = Book.query.count()
    total_students = Student.query.count()
    total_papers = Paper.query.count()

    now = datetime.datetime.now()
    start_of_month = datetime.datetime(now.year, now.month, 1)

    issues_this_month = IssueRecord.query.filter(
        IssueRecord.action == 'Issue',
        IssueRecord.timestamp >= start_of_month
    ).count()

    returns_this_month = IssueRecord.query.filter(
        IssueRecord.action == 'Return',
        IssueRecord.timestamp >= start_of_month
    ).count()

    fines_collected = db.session.query(db.func.sum(IssueRecord.fine_paid)).filter(
        IssueRecord.action == 'Return',
        IssueRecord.timestamp >= start_of_month
    ).scalar() or 0

    btech_books = Book.query.filter_by(course='B.Tech').count()
    diploma_books = Book.query.filter_by(course='Diploma').count()
    mtech_books = Book.query.filter_by(course='M.Tech').count()

    return render_template('lib_dash.html',
                           total_physical=total_physical,
                           total_unique=total_unique,
                           user_count=total_students,
                           paper_count=total_papers,
                           issues_month=issues_this_month,
                           returns_month=returns_this_month,
                           fines_month=fines_collected,
                           btech_books=btech_books,
                           diploma_books=diploma_books,
                           mtech_books=mtech_books)

@web_bp.route('/stu_dash')
def stu_dash():
    sid = session.get('uid')
    if not sid:
        return redirect(url_for('auth.login'))

    student = Student.query.get(sid)
    if not student:
        flash("Student record not found.")
        return redirect(url_for('auth.login'))

    history_records = IssueRecord.query.filter_by(student_id=sid).order_by(IssueRecord.timestamp.desc()).limit(5).all()
    history = []
    
    # Batch fetch books for history
    book_ids = [h.book_id for h in history_records]
    if book_ids:
        books_for_history = {b.id: b for b in Book.query.filter(Book.id.in_(book_ids)).all()}
    else:
        books_for_history = {}
        
    for h in history_records:
        b = books_for_history.get(h.book_id)
        title = b.title if b else "Unknown Book"
        history.append({'title': title, 'action': h.action, 'time': h.timestamp})

    borrowed_books = []
    
    # N+1 Query Optimization for active issues
    issue_counts = db.session.query(IssueRecord.book_id, func.count(IssueRecord.id).label('count')).filter_by(student_id=sid, action='Issue').group_by(IssueRecord.book_id).subquery()
    return_counts = db.session.query(IssueRecord.book_id, func.count(IssueRecord.id).label('count')).filter_by(student_id=sid, action='Return').group_by(IssueRecord.book_id).subquery()
    
    active_books_query = db.session.query(
        Book, 
        func.coalesce(issue_counts.c.count, 0).label('issues'), 
        func.coalesce(return_counts.c.count, 0).label('returns')
    ).outerjoin(issue_counts, Book.id == issue_counts.c.book_id) \
     .outerjoin(return_counts, Book.id == return_counts.c.book_id) \
     .filter(func.coalesce(issue_counts.c.count, 0) > func.coalesce(return_counts.c.count, 0)).all()

    for b, issues, returns in active_books_query:
        last_issue = IssueRecord.query.filter_by(student_id=sid, book_id=b.id, action='Issue').order_by(IssueRecord.timestamp.desc()).first()
        if last_issue:
            issue_date = last_issue.timestamp
            due_date = issue_date + datetime.timedelta(days=14)
            today = datetime.datetime.now()

            is_overdue = False
            fine = 0
            if today > due_date:
                is_overdue = True
                days_late = (today - due_date).days
                fine = days_late * 5

            borrowed_books.append({
                'title': b.title,
                'id': b.id,
                'issue_date': issue_date.strftime('%Y-%m-%d'),
                'due_date': due_date.strftime('%Y-%m-%d'),
                'is_overdue': is_overdue,
                'fine': fine
            })

    available_books = Book.query.filter_by(dept=student.dept, semester=student.semester).all()
    return render_template('stu_dash.html', student=student, books=available_books, history=history, borrowed_books=borrowed_books)


@web_bp.route('/registration')
def registration():
    qr_file = request.args.get('qr_file')
    return render_template('registration.html', qr_file=qr_file)

@web_bp.route('/add_book', methods=['POST'])
def add_book():
    bid = request.form['bid']
    qty = int(request.form['qty'])

    existing_book = Book.query.get(bid)
    file_name = f"book_{bid}.png"

    if existing_book:
        try:
            existing_book.available += qty
            db.session.commit()
            log_audit(session.get('uid'), "Update Book", f"Added {qty} copies to book '{bid}'.")
            flash(f"Update: Book '{bid}' already exists! Added {qty} more copies. Total stock is now {existing_book.available}.")
        except Exception as e:
            db.session.rollback()
            flash(f"Error updating book: {e}")
        finally:
            db.session.remove()
    else:
        try:
            new_book = Book(id=bid, title=request.form['title'], author=request.form['author'],
                            course=request.form.get('course'), dept=request.form.get('dept'),
                            semester=request.form.get('sem'), available=qty)
            db.session.add(new_book)
            db.session.commit()
            try:
                notify_new_book(new_book)
            except Exception as notif_err:
                print(f"Error notifying new book: {notif_err}")
            log_audit(session.get('uid'), "Add Book", f"Registered new book '{bid}' with {qty} copies.")

            qrcode.make(f"BOOK:{bid}").save(os.path.join(current_app.config['QR_FOLDER'], file_name))
            flash(f"Success! New book '{bid}' registered and QR code generated.")
        except Exception as e:
            db.session.rollback()
            flash(f"Error registering new book: {e}")
        finally:
            db.session.remove()

    return redirect(url_for('web.registration', qr_file=file_name))

@web_bp.route('/download_csv_template')
def download_csv_template():
    if session.get('role') != 'librarian':
        flash("Unauthorized access.")
        return redirect(url_for('auth.login'))

    si = StringIO()
    cw = csv.writer(si)
    cw.writerow(['Book ID', 'Title', 'Author', 'Course', 'Department', 'Semester', 'Quantity'])
    cw.writerow(['CS-101', 'Python Basics', 'John Doe', 'B.Tech', 'CSE', '1', '10'])

    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = "attachment; filename=book_upload_template.csv"
    output.headers["Content-type"] = "text/csv"
    return output


@web_bp.route('/bulk_upload_books', methods=['POST'])
def bulk_upload_books():
    if session.get('role') != 'librarian':
        flash("Unauthorized access.")
        return redirect(url_for('auth.login'))

    file = request.files.get('csv_file')
    if not file or file.filename == '':
        flash("No file selected!")
        return redirect(url_for('web.registration'))
    if not file.filename.endswith('.csv'):
        flash("Only CSV files are allowed!")
        return redirect(url_for('web.registration'))

    VALID_RULES = {
        "Diploma": {"max_sem": 6, "depts": ["CST", "ECE", "EE", "ME", "CE"]},
        "B.Tech": {"max_sem": 8, "depts": ["CSE", "ECE", "EE", "ME", "CE", "AIML"]},
        "M.Tech": {"max_sem": 4, "depts": ["Microelectronics and VLSI"]}
    }

    try:
        stream = StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.reader(stream)
        next(csv_reader, None)

        success_count = 0
        error_messages = []
        row_number = 1

        for row in csv_reader:
            row_number += 1
            if len(row) < 7:
                error_messages.append(f"Row {row_number}: Missing columns.")
                continue

            bid, title, author, course, dept, sem_str, qty_str = [item.strip() for item in row[:7]]

            try:
                sem = int(sem_str)
                qty = int(qty_str)
            except ValueError:
                error_messages.append(f"Row {row_number}: Semester & Quantity must be numbers.")
                continue

            if course not in VALID_RULES:
                error_messages.append(f"Row {row_number}: Invalid Course '{course}'.")
                continue
            if dept not in VALID_RULES[course]["depts"]:
                error_messages.append(f"Row {row_number}: Dept '{dept}' invalid for {course}.")
                continue
            if sem < 1 or sem > VALID_RULES[course]["max_sem"]:
                error_messages.append(f"Row {row_number}: Semester {sem} invalid for {course}.")
                continue

            existing_book = Book.query.get(bid)
            if existing_book:
                existing_book.available += qty
            else:
                new_book = Book(id=bid, title=title, author=author, course=course,
                                dept=dept, semester=str(sem), available=qty)
                db.session.add(new_book)

            file_name = f"book_{bid}.png"
            qr_path = os.path.join(current_app.config['QR_FOLDER'], file_name)
            qrcode.make(f"BOOK:{bid}").save(qr_path)
            success_count += 1

        db.session.commit()

        if error_messages:
            display_errors = " | ".join(error_messages[:3])
            if len(error_messages) > 3:
                display_errors += f" ...and {len(error_messages) - 3} more."
            flash(f"Error: Uploaded {success_count} books, but found issues: {display_errors}")
        else:
            flash(f"Success All {success_count} books uploaded and QR codes generated perfectly!")

    except Exception as e:
        db.session.rollback()
        print(f"CSV UPLOAD ERROR: {e}")
        flash("Error: Failed processing the CSV file. Please check the format.")
    finally:
        db.session.remove()
    return redirect(url_for('web.registration'))

@web_bp.route('/add_student', methods=['POST'])
def add_student():
    sid = request.form['sid']
    existing_student = Student.query.get(sid)
    if existing_student:
        flash(f"Error:Student with '{sid}' Roll Number already exists in the system!")
        return redirect(url_for('web.registration'))

    hashed_password = generate_password_hash(sid)
    new_stu = Student(id=sid, name=request.form['name'], course=request.form.get('course'), email=request.form.get('email'), dept=request.form['dept'],
                      semester=request.form['sem'], password=hashed_password)
    try:
        db.session.add(new_stu)
        db.session.commit()
        file_name = f"student_{sid}.png"
        qrcode.make(f"STUDENT:{sid}").save(os.path.join(current_app.config['QR_FOLDER'], file_name))
    except Exception as e:
        db.session.rollback()
        flash(f"Error registering student: {e}")
    finally:
        db.session.remove()
    return redirect(url_for('web.registration', qr_file=file_name))

@web_bp.route('/process_transaction', methods=['POST'])
def process_transaction():
    try:
        data = request.get_json()
        bid = data.get('bid')
        sid = data.get('sid')
        action = str(data.get('type')).title()
        force_issue = data.get('force_issue', False)
        fine_status = data.get('fine_status')

        book = Book.query.filter_by(id=bid).first()
        if not book: return jsonify({"status": "error", "message": f"Book '{bid}' not found!"})

        student = Student.query.get(sid)
        if not student: return jsonify({"status": "error", "message": f"Student '{sid}' not found!"})

        issues = IssueRecord.query.filter_by(student_id=sid, book_id=bid, action='Issue').count()
        returns = IssueRecord.query.filter_by(student_id=sid, book_id=bid, action='Return').count()
        currently_holding = (issues > returns)

        if action == 'Issue':
            if currently_holding:
                return jsonify({"status": "error", "message": f"{student.name} already holds this book!"})

            if not force_issue:
                if book.dept != student.dept or book.semester != str(student.semester) or book.course != student.course:
                    return jsonify({
                        "status": "warning",
                        "message": f"Mismatch Detected: Book is {book.course} {book.dept} (Sem {book.semester}), but {student.name} is {student.course} {student.dept} (Sem {student.semester})."
                    })

            if book.available > 0:
                book.available -= 1
                new_rec = IssueRecord(book_id=bid, student_id=sid, action='Issue')
                db.session.add(new_rec)
                db.session.commit()
                try:
                    notify_issue_book(sid, book)
                except Exception as notif_err:
                    print(f"Error notifying book issue: {notif_err}")
                return jsonify({"status": "success", "message": f"Issued to {student.name} Successfully!"})
            return jsonify({"status": "error", "message": "Book is Out of Stock!"})

        elif action == 'Return':
            if not currently_holding:
                return jsonify({"status": "error", "message": f"{student.name} does not have this book to return!"})

            last_issue = IssueRecord.query.filter_by(student_id=sid, book_id=bid, action='Issue').order_by(IssueRecord.timestamp.desc()).first()
            days_held = (datetime.datetime.now() - last_issue.timestamp).days
            fine_amount = 0
            days_late = 0

            if days_held > 14:
                days_late = days_held - 14
                fine_amount = days_late * 5

            if fine_amount > 0 and not fine_status:
                return jsonify({
                    "status": "payment_required",
                    "fine_amount": fine_amount,
                    "days_late": days_late,
                    "book_title": book.title,
                    "student_name": student.name
                })

            actual_fine_paid = fine_amount if fine_status == 'pay' else 0
            book.available += 1
            new_rec = IssueRecord(book_id=bid, student_id=sid, action='Return', fine_paid=actual_fine_paid)
            db.session.add(new_rec)
            db.session.commit()
            try:
                notify_return_book(sid, book, fine_paid=actual_fine_paid)
            except Exception as notif_err:
                print(f"Error notifying book return: {notif_err}")

            msg = f"Returned by {student.name} Successfully!"
            if fine_status == 'pay':
                msg += f" (₹{actual_fine_paid} Fine Collected)"
            elif fine_status == 'waive':
                msg += f" (₹{fine_amount} Fine Waived)"

            return jsonify({"status": "success", "message": msg})

        else:
            return jsonify({"status": "error", "message": f"Unknown action: {action}"})

    except Exception as e:
        print(f"TRANSACTION ERROR: {str(e)}")
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Backend Error: {str(e)}"})
    finally:
        db.session.remove()

@web_bp.route('/inventory')
def inventory():
    if session.get('role') != 'librarian':
        return redirect(url_for('auth.login'))

    books = Book.query.all()
    students = Student.query.all()
    student_map = {s.id: s.name for s in students}
    
    # N+1 Query Optimization for Inventory
    # Count total issues and returns per book
    issue_counts = db.session.query(IssueRecord.book_id, func.count(IssueRecord.id).label('count')).filter_by(action='Issue').group_by(IssueRecord.book_id).subquery()
    return_counts = db.session.query(IssueRecord.book_id, func.count(IssueRecord.id).label('count')).filter_by(action='Return').group_by(IssueRecord.book_id).subquery()
    
    book_stats = db.session.query(
        Book.id, 
        func.coalesce(issue_counts.c.count, 0).label('total_issues'),
        func.coalesce(return_counts.c.count, 0).label('total_returns')
    ).outerjoin(issue_counts, Book.id == issue_counts.c.book_id) \
     .outerjoin(return_counts, Book.id == return_counts.c.book_id).all()
     
    stats_map = {bs.id: (bs.total_issues, bs.total_returns) for bs in book_stats}
    
    # Active issues query: books currently held by students
    active_issues = db.session.query(IssueRecord).filter_by(action='Issue').all()
    active_returns = db.session.query(IssueRecord).filter_by(action='Return').all()
    
    # Compute active holds
    book_active_issues = {} # book_id -> dict(student_id -> balance)
    book_issue_dates = {}   # book_id -> dict(student_id -> list of issue dates)
    
    for r in active_issues:
        if r.book_id not in book_active_issues:
            book_active_issues[r.book_id] = {}
            book_issue_dates[r.book_id] = {}
        book_active_issues[r.book_id][r.student_id] = book_active_issues[r.book_id].get(r.student_id, 0) + 1
        
        if r.student_id not in book_issue_dates[r.book_id]:
            book_issue_dates[r.book_id][r.student_id] = []
        book_issue_dates[r.book_id][r.student_id].append(r.timestamp)
        
    for r in active_returns:
        if r.book_id in book_active_issues and r.student_id in book_active_issues[r.book_id]:
            book_active_issues[r.book_id][r.student_id] -= 1

    for b in books:
        t_issues, t_returns = stats_map.get(b.id, (0, 0))
        b.issued = t_issues - t_returns
        b.active_issues_list = []
        
        if b.issued > 0 and b.id in book_active_issues:
            balances = book_active_issues[b.id]
            for sid, balance in balances.items():
                if balance > 0:
                    student_name = student_map.get(sid, "Unknown Student")
                    # We take the most recent issue date if there are multiple active issues
                    # Or we could just pop dates, but for simplicity we get the max date available
                    dates = sorted(book_issue_dates[b.id].get(sid, [datetime.datetime.now()]), reverse=True)
                    for i in range(balance):
                        issue_date = dates[i] if i < len(dates) else datetime.datetime.now()
                        due_date = issue_date + datetime.timedelta(days=14)
                        b.active_issues_list.append({
                            'student_id': sid,
                            'student_name': student_name,
                            'issue_date': issue_date.strftime('%Y-%m-%d'),
                            'due_date': due_date.strftime('%Y-%m-%d')
                        })

    return render_template('inventory.html', books=books, students=students)

@web_bp.route('/update_student', methods=['POST'])
def update_student():
    if session.get('role') != 'librarian':
        return redirect(url_for('auth.login'))

    sid = request.form.get('sid')
    student = Student.query.get(sid)

    if student:
        try:
            student.name = request.form.get('name')
            student.email = request.form.get('email')
            student.course = request.form.get('course')
            student.dept = request.form.get('dept')
            student.semester = request.form.get('sem')
            db.session.commit()
            flash(f"Success! Details for Student {sid} have been updated.")
        except Exception as e:
            db.session.rollback()
            flash(f"Error updating student: {e}")
        finally:
            db.session.remove()
    else:
        flash("Error: Could not find that student.")

    return redirect(url_for('web.inventory'))

@web_bp.route('/delete_book/<bid>')
def delete_book(bid):
    if session.get('role') != 'librarian':
        return redirect(url_for('auth.login'))

    book = Book.query.get(bid)
    if book:
        try:
            db.session.delete(book)
            db.session.commit()
            log_audit(session.get('uid'), "Delete Book", f"Deleted book '{bid}'.")
            qr_path = os.path.join(current_app.config['QR_FOLDER'], f"book_{bid}.png")
            if os.path.exists(qr_path):
                os.remove(qr_path)
            flash(f"Book '{bid}' deleted successfully!")
        except Exception as e:
            db.session.rollback()
            flash(f"Error deleting book: {e}")
        finally:
            db.session.remove()
    return redirect(url_for('web.inventory'))

@web_bp.route('/delete_student/<sid>')
def delete_student(sid):
    if session.get('role') != 'librarian':
        return redirect(url_for('auth.login'))
    
    student = Student.query.get(sid)
    if student:
        try:
            db.session.delete(student)
            db.session.commit()
            qr_path = os.path.join(current_app.config['QR_FOLDER'], f"student_{sid}.png")
            if os.path.exists(qr_path):
                os.remove(qr_path)
            flash(f"Student '{sid}' deleted successfully!")
        except Exception as e:
            db.session.rollback()
            flash(f"Error deleting student: {e}")
        finally:
            db.session.remove()
    else:
        flash(f"Error: Student '{sid}' not found.")
    return redirect(url_for('web.inventory'))

@web_bp.route('/update_book', methods=['POST'])
def update_book():
    if session.get('role') != 'librarian':
        return redirect(url_for('auth.login'))

    bid = request.form.get('bid')
    book = Book.query.get(bid)
    if book:
        try:
            book.title = request.form.get('title')
            book.author = request.form.get('author')
            book.course = request.form.get('course')
            book.dept = request.form.get('dept')
            book.semester = request.form.get('sem')
            book.available = int(request.form.get('qty'))
            db.session.commit()
            flash(f"Book '{bid}' updated successfully!")
        except Exception as e:
            db.session.rollback()
            flash(f"Error updating book: {e}")
        finally:
            db.session.remove()

    return redirect(url_for('web.inventory'))

@web_bp.route('/papers')
def papers_page():
    role = session.get('role')
    student_id = session.get('uid')
    current_student = None

    if role == 'student':
        current_student = Student.query.get(student_id)
        if current_student:
            papers = Paper.query.filter_by(course=current_student.course, dept=current_student.dept, semester=str(current_student.semester)).all()
        else:
            papers = []
    else:
        papers = Paper.query.all()
    return render_template('paper.html', papers=papers, student=current_student)

@web_bp.route('/upload_paper', methods=['POST'])
def upload_paper():
    file = request.files.get('file')
    course = request.form.get('course') 
    dept = request.form.get('dept')
    sem = request.form.get('sem')

    if file and file.filename != '':
        try:
            filename = secure_filename(file.filename)
            file.save(os.path.join(current_app.config['UPLOAD_FOLDER'], filename))
            new_paper = Paper(course=course, dept=dept, semester=sem, filename=filename)
            db.session.add(new_paper)
            db.session.commit()
            try:
                notify_new_paper(new_paper)
            except Exception as notif_err:
                print(f"Error notifying new paper: {notif_err}")
            flash("Paper Uploaded!")
        except Exception as e:
            db.session.rollback()
            flash(f"Error uploading paper: {e}")
        finally:
            db.session.remove()
    return redirect(url_for('web.papers_page'))

@web_bp.route('/delete_paper/<int:paper_id>')
def delete_paper(paper_id):
    if session.get('role') != 'librarian':
        flash("Unauthorized access.")
        return redirect(url_for('auth.login'))

    paper = Paper.query.get(paper_id)
    if paper:
        try:
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], paper.filename)
            if os.path.exists(file_path):
                os.remove(file_path)
            db.session.delete(paper)
            db.session.commit()
            flash("Paper deleted successfully!")
        except Exception as e:
            db.session.rollback()
            flash(f"Error deleting paper: {e}")
            print(f"Error removing file from folder: {e}")
        finally:
            db.session.remove()
    else:
        flash("Paper not found.")
    return redirect(url_for('web.papers_page'))

@web_bp.route('/export_report')
def export_report():
    if session.get('role') != 'librarian':
        flash("Unauthorized access.")
        return redirect(url_for('auth.login'))

    records = IssueRecord.query.order_by(IssueRecord.timestamp.desc()).all()
    si = StringIO()
    cw = csv.writer(si)
    cw.writerow(['Transaction ID', 'Book ID', 'Student ID', 'Action', 'Date and Time'])

    for r in records:
        cw.writerow([r.id, r.book_id, r.student_id, r.action, r.timestamp.strftime('%Y-%m-%d %H:%M')])

    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = "attachment; filename=library_transaction_report.csv"
    output.headers["Content-type"] = "text/csv"
    return output

@web_bp.route('/print_qrs')
def print_qrs():
    if session.get('role') != 'librarian':
        return redirect(url_for('auth.login'))
    books = Book.query.all()
    students = Student.query.all()

    qr_folder = current_app.config['QR_FOLDER']
    valid_books = [b for b in books if os.path.exists(os.path.join(qr_folder, f"book_{b.id}.png"))]
    valid_students = [s for s in students if os.path.exists(os.path.join(qr_folder, f"student_{s.id}.png"))]

    return render_template('print_qrs.html', books=valid_books, students=valid_students)

@web_bp.route('/update_student_profile', methods=['POST'])
def update_student_profile():
    sid = session.get('uid')
    if session.get('role') != 'student' or not sid:
        return redirect(url_for('auth.login'))

    student = Student.query.get(sid)
    if not student:
        flash("Student record not found.")
        return redirect(url_for('auth.login'))

    email = request.form.get('email')
    phone = request.form.get('phone')
    if email is not None: student.email = email
    if phone is not None: student.phone = phone

    file = request.files.get('profile_pic')
    if file and file.filename != '':
        allowed_extensions = {'.jpg', '.jpeg', '.png'}
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_extensions:
            flash("Error: Invalid file type. Only JPG and PNG allowed.")
            return redirect(url_for('web.stu_dash'))
        
        file.seek(0, os.SEEK_END)
        file_length = file.tell()
        file.seek(0, os.SEEK_SET)
        if file_length > 2 * 1024 * 1024:
            flash("Error: File size exceeds 2MB limit.")
            return redirect(url_for('web.stu_dash'))

        try:
            filename = secure_filename(f"student_{sid}_pic{ext}")
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            student.profile_pic_url = filename
        except Exception as e:
            flash(f"Error saving profile picture: {e}")
            return redirect(url_for('web.stu_dash'))

    try:
        db.session.commit()
        log_audit(sid, "Update Profile", "Updated student profile details.")
        flash("Profile updated successfully!")
    except Exception as e:
        db.session.rollback()
        flash(f"Database error updating profile: {e}")
    finally:
        db.session.remove()

    return redirect(url_for('web.stu_dash'))
