from flask import Blueprint, render_template, request, redirect, session, url_for, flash
from werkzeug.security import check_password_hash, generate_password_hash
from models import Student, Librarian, db, log_audit

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/')
def login(): 
    return render_template('login.html')

@auth_bp.route('/auth', methods=['POST'])
def auth():
    role, uid, pwd = request.form.get('role'), request.form.get('uid'), request.form.get('pwd')

    if role == 'librarian':
        lib = Librarian.query.filter_by(id=uid).first()
        if lib:
            # Fallback logic for plaintext passwords
            if lib.password.startswith('scrypt:') or lib.password.startswith('pbkdf2:'):
                if check_password_hash(lib.password, pwd):
                    session['role'], session['user'], session['uid'] = 'librarian', 'Admin', lib.id
                    log_audit(lib.id, "Login Success", "Librarian logged in successfully via web dashboard.")
                    return redirect(url_for('web.lib_dash'))
            else:
                if lib.password == pwd:
                    try:
                        lib.password = generate_password_hash(pwd)
                        db.session.commit()
                        session['role'], session['user'], session['uid'] = 'librarian', 'Admin', lib.id
                        log_audit(lib.id, "Login Success", "Librarian logged in successfully via web dashboard.")
                        return redirect(url_for('web.lib_dash'))
                    except Exception:
                        db.session.rollback()
                    finally:
                        db.session.remove()

    elif role == 'student':
        stu = Student.query.filter_by(id=uid).first()
        if stu:
            # Fallback logic for plaintext passwords
            if stu.password.startswith('scrypt:') or stu.password.startswith('pbkdf2:'):
                if check_password_hash(stu.password, pwd):
                    session['role'], session['user'], session['uid'] = 'student', stu.name, stu.id
                    log_audit(stu.id, "Login Success", "Student logged in successfully via web dashboard.")
                    return redirect(url_for('web.stu_dash'))
            else:
                if stu.password == pwd:
                    try:
                        stu.password = generate_password_hash(pwd)
                        db.session.commit()
                        session['role'], session['user'], session['uid'] = 'student', stu.name, stu.id
                        log_audit(stu.id, "Login Success", "Student logged in successfully via web dashboard.")
                        return redirect(url_for('web.stu_dash'))
                    except Exception:
                        db.session.rollback()
                    finally:
                        db.session.remove()

    log_audit(uid, "Login Failed", f"Failed web login attempt for role '{role}'.")
    flash("Invalid ID or Password.")
    return redirect(url_for('auth.login'))

@auth_bp.route('/change_password', methods=['POST'])
def change_password():
    role = session.get('role')
    uid = session.get('uid')

    if not role:
        return redirect(url_for('auth.login'))

    current_pwd = request.form.get('current_pwd')
    new_pwd = request.form.get('new_pwd')

    user = None
    redirect_page = 'auth.login'

    if role == 'student':
        user = Student.query.get(uid)
        redirect_page = 'web.stu_dash'
    elif role == 'librarian':
        user = Librarian.query.get(uid)
        redirect_page = 'web.lib_dash'

    if user:
        is_valid = False
        if user.password.startswith('scrypt:') or user.password.startswith('pbkdf2:'):
            is_valid = check_password_hash(user.password, current_pwd)
        else:
            is_valid = (user.password == current_pwd)

        if is_valid:
            try:
                user.password = generate_password_hash(new_pwd)
                db.session.commit()
                if role == 'student':
                    try:
                        from notification_service import notify_password_changed
                        notify_password_changed(user.id)
                    except Exception as notif_err:
                        print(f"Error sending security notification on web password change: {notif_err}")
                flash("Success! Password changed successfully.")
            except Exception:
                db.session.rollback()
                flash("Error: Database error during password change.")
            finally:
                db.session.remove()
        else:
            flash("Error: Incorrect current password. Change failed.")

    return redirect(url_for(redirect_page))

@auth_bp.route('/reset_student_password', methods=['POST'])
def reset_student_password():
    if session.get('role') != 'librarian':
        flash("Unauthorized access.")
        return redirect(url_for('auth.login'))

    student_id = request.form.get('student_id')
    student = Student.query.get(student_id)

    if student:
        try:
            student.password = generate_password_hash(student.id)
            db.session.commit()
            flash(f"Success! Password for {student.name} ({student.id}) has been reset to default.")
        except Exception:
            db.session.rollback()
            flash("Error: Database error during reset.")
        finally:
            db.session.remove()
    else:
        flash(f"Error: Student ID '{student_id}' not found in the database.")
    return redirect(url_for('web.lib_dash'))

@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('auth.login'))
