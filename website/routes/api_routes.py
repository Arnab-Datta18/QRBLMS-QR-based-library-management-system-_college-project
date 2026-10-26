import jwt
import datetime
import os
import io
import json
from flask import Blueprint, jsonify, request, current_app
from models import Student, Book, IssueRecord, Paper, Notification, db, log_audit
from sqlalchemy import func
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
from PIL import Image
from notification_service import (
    create_notification,
    notify_password_changed,
    notify_broadcast,
    ensure_initial_notifications,
    sync_student_loan_notifications,
)

api_bp = Blueprint('api', __name__, url_prefix='/api')

def generate_tokens(student):
    secret_key = current_app.config['SECRET_KEY']
    access_token = jwt.encode({
        'student_id': student.id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        'type': 'access'
    }, secret_key, algorithm='HS256')
    
    refresh_token = jwt.encode({
        'student_id': student.id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=365),
        'type': 'refresh'
    }, secret_key, algorithm='HS256')
    
    return access_token, refresh_token

# --- Section 6 PRD Endpoints ---

@api_bp.route('/login', methods=['POST'])
def api_login():
    """Returns tokens and basic user profile data."""
    data = request.get_json() or {}
    uid = data.get('student_id')
    pwd = data.get('password')
    
    if not uid or not pwd:
        log_audit(uid, "API Login Failed", "Missing credentials in API login.")
        return jsonify({"message": "Missing credentials"}), 400
        
    stu = Student.query.filter_by(id=uid).first()
    if not stu:
        log_audit(uid, "API Login Failed", "Invalid ID or Password in API login.")
        return jsonify({"message": "Invalid ID or Password"}), 401
        
    # Check password
    is_valid = False
    if stu.password.startswith('scrypt:') or stu.password.startswith('pbkdf2:'):
        is_valid = check_password_hash(stu.password, pwd)
    else:
        is_valid = (stu.password == pwd)
        
    if not is_valid:
        log_audit(uid, "API Login Failed", "Invalid ID or Password in API login.")
        return jsonify({"message": "Invalid ID or Password"}), 401
        
    access_token, refresh_token = generate_tokens(stu)
    
    log_audit(stu.id, "API Login Success", "Student logged in successfully via API.")
    
    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "student": {
            "id": stu.id,
            "name": stu.name,
            "course": stu.course,
            "department": stu.dept,
            "semester": stu.semester,
            "email": stu.email
        }
    }), 200

@api_bp.route('/refresh', methods=['POST'])
def api_refresh():
    """Validates refresh_token, returns new access_token."""
    data = request.get_json() or {}
    token = data.get('refresh_token')
    
    if not token:
        return jsonify({"message": "Missing refresh token"}), 400
        
    try:
        secret_key = current_app.config['SECRET_KEY']
        decoded = jwt.decode(token, secret_key, algorithms=['HS256'])
        if decoded.get('type') != 'refresh':
            return jsonify({"message": "Invalid token type"}), 401
            
        stu = Student.query.get(decoded.get('student_id'))
        if not stu:
            return jsonify({"message": "Student not found"}), 404
            
        access_token, new_refresh_token = generate_tokens(stu)
        return jsonify({
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "student_id": stu.id
        }), 200
    except jwt.ExpiredSignatureError:
        return jsonify({"message": "Refresh token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"message": "Invalid refresh token"}), 401

@api_bp.route('/change-password', methods=['POST'])
@api_bp.route('/student/change_password', methods=['POST'])
def api_change_password():
    """Updates user password securely after verifying current password."""
    data = request.get_json() or {}
    student_id = data.get('student_id') or data.get('studentId')
    current_password = data.get('current_password') or data.get('currentPassword')
    new_password = data.get('new_password') or data.get('newPassword')

    if not student_id or not current_password or not new_password:
        return jsonify({
            "status": "error",
            "message": "Missing required fields (student_id, current_password, new_password)"
        }), 400

    student = Student.query.get(student_id)
    if not student:
        return jsonify({
            "status": "error",
            "message": "Student record not found"
        }), 404

    # Verify current password
    is_valid = False
    if student.password.startswith('scrypt:') or student.password.startswith('pbkdf2:'):
        is_valid = check_password_hash(student.password, current_password)
    else:
        is_valid = (student.password == current_password)

    if not is_valid:
        log_audit(student.id, "API Password Change Failed", "Incorrect current password attempt.")
        return jsonify({
            "status": "error",
            "message": "Incorrect current password"
        }), 401

    if len(new_password) < 8:
        return jsonify({
            "status": "error",
            "message": "New password must be at least 8 characters long"
        }), 400

    try:
        student.password = generate_password_hash(new_password)
        db.session.commit()
        try:
            notify_password_changed(student.id)
        except Exception as notif_err:
            print(f"Error sending security notification: {notif_err}")
        log_audit(student.id, "API Password Change Success", "Student successfully changed password via API.")
        return jsonify({
            "status": "success",
            "message": "Password updated successfully"
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": f"Failed to update password: {str(e)}"
        }), 500

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp'}
ALLOWED_MIMETYPES = {'image/jpeg', 'image/png', 'image/webp'}
MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2 MB

def check_image_magic_bytes(header_bytes):
    """Verifies binary magic byte signature against known image headers."""
    if len(header_bytes) < 4:
        return False
    # JPEG: \xff\xd8\xff
    if header_bytes.startswith(b'\xff\xd8\xff'):
        return True
    # PNG: \x89PNG\r\n\x1a\n
    if header_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
        return True
    # WEBP: RIFF....WEBP
    if header_bytes.startswith(b'RIFF') and len(header_bytes) >= 12 and header_bytes[8:12] == b'WEBP':
        return True
    return False

@api_bp.route('/student/upload-avatar', methods=['POST'])
def api_upload_avatar():
    """Securely uploads and sanitizes student avatar."""
    student_id = request.form.get('student_id')
    if not student_id:
        return jsonify({"status": "error", "message": "Missing student_id"}), 400

    student = Student.query.get(student_id)
    if not student:
        return jsonify({"status": "error", "message": "Student not found"}), 404

    if 'avatar' not in request.files:
        return jsonify({"status": "error", "message": "No avatar file provided in form-data"}), 400

    file = request.files['avatar']
    if not file or file.filename == '':
        return jsonify({"status": "error", "message": "Empty file uploaded"}), 400

    raw_filename = file.filename or 'avatar.jpg'

    # 1. Extension Whitelist
    if '.' not in raw_filename:
        log_audit(student_id, "Avatar Security Block", f"No file extension: {raw_filename}")
        return jsonify({"status": "error", "message": "Invalid file format. Extension missing."}), 400

    ext = raw_filename.rsplit('.', 1)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        log_audit(student_id, "Avatar Security Block", f"Disallowed extension: {ext}")
        return jsonify({"status": "error", "message": "Invalid file extension. Only JPG, PNG, and WEBP allowed."}), 400

    # 2. MIME Type Whitelist
    if file.mimetype and file.mimetype.lower() not in ALLOWED_MIMETYPES:
        log_audit(student_id, "Avatar Security Block", f"Disallowed MIME type: {file.mimetype}")
        return jsonify({"status": "error", "message": "Invalid MIME type. Only genuine images allowed."}), 400

    # Read file content safely into memory
    file_bytes = file.read()
    file_size = len(file_bytes)

    # 3. File Size Cap (2 MB max)
    if file_size > MAX_AVATAR_SIZE:
        log_audit(student_id, "Avatar Security Block", f"File exceeds 2 MB ({file_size} bytes)")
        return jsonify({"status": "error", "message": "File exceeds maximum allowed size of 2 MB."}), 400

    if file_size == 0:
        return jsonify({"status": "error", "message": "Uploaded file is empty."}), 400

    # 4. Binary Magic-Byte Signature Verification
    header_bytes = file_bytes[:12]
    if not check_image_magic_bytes(header_bytes):
        log_audit(student_id, "Avatar Security Block", f"Invalid magic bytes header: {header_bytes}")
        return jsonify({"status": "error", "message": "Security Error: File binary signature does not match a valid image."}), 400

    # 5. Deep Image Decode, Verification & Re-encode (Pillow / PIL)
    safe_filename = secure_filename(f"avatar_{student_id}.jpg")
    upload_folder = os.path.join(current_app.root_path, 'static', 'uploads')
    os.makedirs(upload_folder, exist_ok=True)
    dest_path = os.path.join(upload_folder, safe_filename)

    try:
        stream = io.BytesIO(file_bytes)
        img = Image.open(stream)
        img.verify()

        # Re-open stream for editing
        stream.seek(0)
        img = Image.open(stream)

        # Convert to RGB (strips injected EXIF/metadata and color profiles)
        if img.mode != 'RGB':
            img = img.convert('RGB')

        # Resize / Thumbnail to max 400x400
        img.thumbnail((400, 400), Image.Resampling.LANCZOS)

        # Save freshly re-encoded JPEG with quality=85
        img.save(dest_path, format='JPEG', quality=85, optimize=True)

    except Exception as e:
        log_audit(student_id, "Avatar Decode Failed", f"Image processing failed: {str(e)}")
        return jsonify({"status": "error", "message": "Image processing failed: Corrupted or invalid image data."}), 400

    # Update Student model
    timestamp = int(datetime.datetime.utcnow().timestamp())
    avatar_url = f"/static/uploads/{safe_filename}?t={timestamp}"
    student.profile_pic_url = f"/static/uploads/{safe_filename}"
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Error saving profile_pic_url: {e}")

    log_audit(student_id, "Avatar Upload Success", f"Avatar safely uploaded and sanitized: {safe_filename}")

    return jsonify({
        "status": "success",
        "message": "Avatar uploaded successfully",
        "avatar_url": avatar_url
    }), 200

@api_bp.route('/student/dashboard/<student_id>', methods=['GET'])
@api_bp.route('/student/profile/<student_id>', methods=['GET'])
def api_student_dashboard(student_id):
    """Returns active issues, fines, demographic profile, and exact Student QR payload."""
    student = Student.query.get(student_id)
    if not student:
        return jsonify({"message": "Student not found"}), 404

    issue_counts = db.session.query(IssueRecord.book_id, func.count(IssueRecord.id).label('count')).filter_by(student_id=student_id, action='Issue').group_by(IssueRecord.book_id).subquery()
    return_counts = db.session.query(IssueRecord.book_id, func.count(IssueRecord.id).label('count')).filter_by(student_id=student_id, action='Return').group_by(IssueRecord.book_id).subquery()
    
    active_books_query = db.session.query(
        Book, 
        func.coalesce(issue_counts.c.count, 0).label('issues'), 
        func.coalesce(return_counts.c.count, 0).label('returns')
    ).outerjoin(issue_counts, Book.id == issue_counts.c.book_id) \
     .outerjoin(return_counts, Book.id == return_counts.c.book_id) \
     .filter(func.coalesce(issue_counts.c.count, 0) > func.coalesce(return_counts.c.count, 0)).all()

    total_fine = 0
    active_issues = []

    for b, issues, returns in active_books_query:
        last_issue = IssueRecord.query.filter_by(student_id=student_id, book_id=b.id, action='Issue').order_by(IssueRecord.timestamp.desc()).first()
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

            total_fine += fine
            active_issues.append({
                'issue_id': last_issue.id,
                'book_name': b.title,
                'author': b.author,
                'issue_date': issue_date.strftime('%Y-%m-%d'),
                'due_date': due_date.strftime('%Y-%m-%d'),
                'is_overdue': is_overdue,
                'qr_code_string': f"BOOK:{b.id}"
            })

    # Format semester string (e.g., "5th Semester")
    sem_val = student.semester
    sem_str = str(sem_val) if sem_val is not None else "5"
    if sem_str.isdigit():
        num = int(sem_str)
        if num == 1: suffix = "1st"
        elif num == 2: suffix = "2nd"
        elif num == 3: suffix = "3rd"
        else: suffix = f"{num}th"
        semester_display = f"{suffix} Semester"
    elif "semester" in sem_str.lower():
        semester_display = sem_str
    else:
        semester_display = f"{sem_str} Semester"

    dept_display = student.dept or "Computer Science & Technology (CST)"
    if dept_display.upper() == "CST":
        dept_display = "Computer Science & Technology (CST)"
    elif dept_display.upper() == "ETC":
        dept_display = "Electronics & Telecommunication (ETC)"
    elif dept_display.upper() == "CE":
        dept_display = "Civil Engineering (CE)"

    # Check for avatar file on disk
    upload_folder = os.path.join(current_app.root_path, 'static', 'uploads')
    safe_filename = secure_filename(f"avatar_{student_id}.jpg")
    dest_path = os.path.join(upload_folder, safe_filename)

    avatar_url = None
    if os.path.exists(dest_path):
        mtime = int(os.path.getmtime(dest_path))
        avatar_url = f"/static/uploads/{safe_filename}?t={mtime}"
    elif student.profile_pic_url:
        avatar_url = student.profile_pic_url

    # Unread notifications count and background sync
    unread_notifications_count = 0
    try:
        ensure_initial_notifications(student_id)
        sync_student_loan_notifications(student_id)
        unread_notifications_count = Notification.query.filter_by(student_id=student_id, is_read=False).count()
    except Exception as notif_err:
        print(f"Error syncing notifications for dashboard: {notif_err}")

    return jsonify({
        "student_id": student_id,
        "name": student.name,
        "student_name": student.name,
        "course": student.course or 'Diploma in Engineering',
        "department": dept_display,
        "semester": semester_display,
        "semester_num": student.semester,
        "email": student.email or f"{student_id.lower()}@tcea.edu.in",
        "active_loans_count": len(active_issues),
        "total_dues": total_fine,
        "total_fine": total_fine,
        "unread_notifications_count": unread_notifications_count,
        "avatar_url": avatar_url,
        "profile_pic_url": avatar_url,
        "qr_payload": f"STUDENT:{student_id}",
        "active_issues": active_issues
    }), 200

# --- NOTIFICATION ENGINE ENDPOINTS ---

@api_bp.route('/student/notifications/<student_id>', methods=['GET'])
@api_bp.route('/notifications/<student_id>', methods=['GET'])
def api_get_notifications(student_id):
    """
    Returns personalized student notifications, grouped by Today, Yesterday, Earlier.
    """
    student = Student.query.get(student_id)
    if not student:
        return jsonify({"status": "error", "message": "Student not found"}), 404

    try:
        ensure_initial_notifications(student_id)
        sync_student_loan_notifications(student_id)
    except Exception as e:
        print(f"Error ensuring notifications: {e}")

    rows = Notification.query.filter_by(student_id=student_id).order_by(Notification.created_at.desc()).all()

    now = datetime.datetime.utcnow()
    today = now.date()
    yesterday = today - datetime.timedelta(days=1)

    notifications_list = []
    unread_count = 0

    for n in rows:
        if not n.is_read:
            unread_count += 1

        created = n.created_at or now
        created_date = created.date()

        if created_date == today:
            group = 'Today'
            diff_sec = (now - created).total_seconds()
            if diff_sec < 60:
                time_str = "Just now"
            elif diff_sec < 3600:
                time_str = f"{max(1, int(diff_sec // 60))}m ago"
            elif diff_sec < 86400:
                time_str = f"{max(1, int(diff_sec // 3600))}h ago"
            else:
                time_str = created.strftime('%I:%M %p').lstrip('0')
        elif created_date == yesterday:
            group = 'Yesterday'
            time_str = f"Yesterday, {created.strftime('%I:%M %p').lstrip('0')}"
        else:
            group = 'Earlier'
            time_str = created.strftime('%b %d')

        meta = {}
        if n.meta_json:
            try:
                meta = json.loads(n.meta_json)
            except Exception:
                meta = {}

        notifications_list.append({
            "id": str(n.id),
            "type": n.type,
            "title": n.title,
            "desc": n.body,
            "time": time_str,
            "group": group,
            "unread": not n.is_read,
            "channel_id": n.channel_id,
            "data": meta,
            "target": meta.get("route")
        })

    return jsonify({
        "status": "success",
        "unread_count": unread_count,
        "notifications": notifications_list
    }), 200

@api_bp.route('/student/notifications/mark-read', methods=['POST'])
def api_mark_notification_read():
    data = request.get_json() or {}
    student_id = data.get('student_id')
    notification_id = data.get('notification_id')

    if not student_id or not notification_id:
        return jsonify({"status": "error", "message": "Missing student_id or notification_id"}), 400

    notif = Notification.query.filter_by(id=notification_id, student_id=student_id).first()
    if notif:
        notif.is_read = True
        notif.read_at = datetime.datetime.utcnow()
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    unread_count = Notification.query.filter_by(student_id=student_id, is_read=False).count()
    return jsonify({
        "status": "success",
        "unread_count": unread_count
    }), 200

@api_bp.route('/student/notifications/mark-all-read', methods=['POST'])
def api_mark_all_notifications_read():
    data = request.get_json() or {}
    student_id = data.get('student_id')

    if not student_id:
        return jsonify({"status": "error", "message": "Missing student_id"}), 400

    try:
        Notification.query.filter_by(student_id=student_id, is_read=False).update({
            "is_read": True,
            "read_at": datetime.datetime.utcnow()
        })
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

    return jsonify({
        "status": "success",
        "unread_count": 0
    }), 200

@api_bp.route('/notifications/targeted', methods=['POST'])
def api_targeted_notification():
    data = request.get_json() or {}
    notif_type = data.get('type', 'notice')
    title = data.get('title')
    body = data.get('body')
    dept = data.get('dept')
    semester = data.get('semester')

    if not title or not body:
        return jsonify({"status": "error", "message": "title and body are required"}), 400

    query = Student.query
    if dept:
        query = query.filter_by(dept=dept)
    if semester:
        try:
            query = query.filter_by(semester=int(semester))
        except Exception:
            pass

    target_students = query.all()
    count = 0
    chip_text = f"{dept or 'General'} · Sem {semester or 'All'}"
    for stu in target_students:
        create_notification(
            student_id=stu.id,
            notif_type=notif_type,
            title=title,
            body=body,
            channel_id='updates',
            meta={"department": dept, "semester": semester, "chipText": chip_text}
        )
        count += 1

    return jsonify({
        "status": "success",
        "message": f"Sent targeted notification to {count} students",
        "count": count
    }), 200

@api_bp.route('/notifications/broadcast', methods=['POST'])
def api_broadcast_notification():
    data = request.get_json() or {}
    title = data.get('title')
    body = data.get('body')
    important = data.get('important', False)

    if not title or not body:
        return jsonify({"status": "error", "message": "title and body are required"}), 400

    count = notify_broadcast(title, body, important=important)
    return jsonify({
        "status": "success",
        "message": f"Broadcast sent to {count} students",
        "count": count
    }), 200

@api_bp.route('/books/catalog/<student_id>', methods=['GET'])
def api_catalog(student_id):
    """Returns inventory automatically filtered by the student's demographics."""
    student = Student.query.get(student_id)
    if not student:
        return jsonify({"message": "Student not found"}), 404
        
    books = Book.query.filter_by(dept=student.dept, semester=str(student.semester)).all()
    catalog = []
    for b in books:
        catalog.append({
            "book_id": b.id,
            "title": b.title,
            "author": b.author,
            "is_in_stock": b.available > 0
        })
    return jsonify({"books": catalog}), 200

@api_bp.route('/student/history/<student_id>', methods=['GET'])
def api_history(student_id):
    """Returns vault of returned books."""
    student = Student.query.get(student_id)
    if not student:
        return jsonify({"message": "Student not found"}), 404

    return_records = IssueRecord.query.filter_by(student_id=student_id, action='Return').order_by(IssueRecord.timestamp.desc()).all()
    history = []
    book_ids = list({r.book_id for r in return_records})
    books_map = {b.id: b for b in Book.query.filter(Book.id.in_(book_ids)).all()} if book_ids else {}

    for r in return_records:
        b = books_map.get(r.book_id)
        last_issue = IssueRecord.query.filter_by(student_id=student_id, book_id=r.book_id, action='Issue').filter(IssueRecord.timestamp <= r.timestamp).order_by(IssueRecord.timestamp.desc()).first()
        issue_date_str = last_issue.timestamp.strftime('%Y-%m-%d') if last_issue else 'N/A'
        return_date_str = r.timestamp.strftime('%Y-%m-%d')

        history.append({
            "issue_id": r.id,
            "book_id": r.book_id,
            "book_name": b.title if b else "Unknown Book",
            "title": b.title if b else "Unknown Book",
            "author": b.author if b else "Unknown Author",
            "issue_date": issue_date_str,
            "return_date": return_date_str,
            "fine_paid": r.fine_paid or 0
        })

    return jsonify({"history": history}), 200

@api_bp.route('/pyq/<student_id>', methods=['GET'])
def api_pyq(student_id):
    """Returns academic papers automatically filtered by student demographics."""
    student = Student.query.get(student_id)
    if not student:
        return jsonify({"message": "Student not found"}), 404
        
    papers = Paper.query.filter_by(course=student.course, dept=student.dept, semester=str(student.semester)).all()
    pyqs = []
    for p in papers:
        pyqs.append({
            "paper_id": p.id,
            "title": p.filename,
            "subject": f"{p.dept} Sem {p.semester}",
            "year": "N/A",
            "pdf_url": f"/static/uploads/{p.filename}"
        })
    return jsonify({"pyqs": pyqs}), 200
