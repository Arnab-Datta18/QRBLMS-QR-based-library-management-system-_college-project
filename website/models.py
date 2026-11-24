from flask_sqlalchemy import SQLAlchemy
import datetime
import json

db = SQLAlchemy()

class Book(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    title = db.Column(db.String(100))
    author = db.Column(db.String(100))
    course = db.Column(db.String(50))
    dept = db.Column(db.String(50))
    semester = db.Column(db.String(20))
    available = db.Column(db.Integer)

class Student(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    course = db.Column(db.String(50), nullable=True)
    dept = db.Column(db.String(50), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    profile_pic_url = db.Column(db.String(200), nullable=True)

class Paper(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    course = db.Column(db.String(50))
    dept = db.Column(db.String(50))
    semester = db.Column(db.String(20))
    filename = db.Column(db.String(100))
    year = db.Column(db.String(10), default='2025')

class IssueRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.String(50), db.ForeignKey('book.id'))
    student_id = db.Column(db.String(50), db.ForeignKey('student.id'))
    action = db.Column(db.String(20))  # 'Issue' or 'Return'
    timestamp = db.Column(db.DateTime, default=datetime.datetime.now)
    due_date = db.Column(db.DateTime, nullable=True)
    renewal_count = db.Column(db.Integer, default=0)
    fine_paid = db.Column(db.Integer, default=0)

class RenewalRequest(db.Model):
    __tablename__ = 'renewal_request'
    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.Integer, db.ForeignKey('issue_record.id'), nullable=False, index=True)
    student_id = db.Column(db.String(50), db.ForeignKey('student.id'), nullable=False, index=True)
    book_id = db.Column(db.String(50), db.ForeignKey('book.id'), nullable=False, index=True)
    requested_days = db.Column(db.Integer, nullable=False)
    current_due_date = db.Column(db.DateTime, nullable=False)
    proposed_due_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='pending', nullable=False, index=True)  # 'pending', 'approved', 'rejected', 'cancelled'
    librarian_note = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    resolved_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'loan_id': self.loan_id,
            'student_id': self.student_id,
            'book_id': self.book_id,
            'requested_days': self.requested_days,
            'current_due_date': self.current_due_date.strftime('%Y-%m-%d') if self.current_due_date else None,
            'proposed_due_date': self.proposed_due_date.strftime('%Y-%m-%d') if self.proposed_due_date else None,
            'status': self.status,
            'librarian_note': self.librarian_note,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'resolved_at': self.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if self.resolved_at else None,
        }

class Notification(db.Model):
    __tablename__ = 'notification'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(50), db.ForeignKey('student.id'), nullable=False, index=True)
    type = db.Column(db.String(30), nullable=False)  # 'overdue', 'due', 'fine', 'issued', 'returned', 'renewed', 'reserve', 'paper', 'book', 'security', 'notice'
    title = db.Column(db.String(150), nullable=False)
    body = db.Column(db.Text, nullable=False)
    channel_id = db.Column(db.String(20), default='updates')  # 'urgent' or 'updates'
    meta_json = db.Column(db.Text, nullable=True)  # JSON string for rich card chips
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    read_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    dedup_key = db.Column(db.String(120), nullable=True, index=True)

    def to_dict(self):
        meta = {}
        if self.meta_json:
            try:
                meta = json.loads(self.meta_json)
            except Exception:
                meta = {}
        return {
            'id': self.id,
            'student_id': self.student_id,
            'type': self.type,
            'title': self.title,
            'body': self.body,
            'channel_id': self.channel_id,
            'meta': meta,
            'is_read': self.is_read,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'dedup_key': self.dedup_key
        }

class Librarian(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    password = db.Column(db.String(100))

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    user_id = db.Column(db.String(50), nullable=True)
    action = db.Column(db.String(100), nullable=False)
    ip_address = db.Column(db.String(50), nullable=True)
    details = db.Column(db.Text, nullable=True)

def log_audit(user_id, action, details):
    from flask import request
    try:
        ip_address = request.remote_addr
    except Exception:
        ip_address = None
        
    try:
        log_entry = AuditLog(user_id=user_id, action=action, ip_address=ip_address, details=details)
        db.session.add(log_entry)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Failed to log audit: {e}")
