import datetime
from datetime import timedelta
import json
from sqlalchemy import func
from models import db, Student, Book, IssueRecord, Notification

def cleanup_old_notifications():
    try:
        cutoff_date = datetime.datetime.utcnow() - timedelta(days=30)
        deleted_count = Notification.query.filter(Notification.created_at < cutoff_date).delete(synchronize_session=False)
        db.session.commit()
        return deleted_count
    except Exception as e:
        db.session.rollback()
        print(f"Cleanup error: {e}")
        return 0

def create_notification(student_id, notif_type, title, body, channel_id='updates', meta=None, dedup_key=None, created_at=None, is_read=False):
    """
    Creates a Notification for a student with deduplication support.
    """
    if dedup_key:
        existing = Notification.query.filter_by(student_id=student_id, dedup_key=dedup_key).first()
        if existing:
            return existing

    meta_json = json.dumps(meta) if meta else None
    notif = Notification(
        student_id=student_id,
        type=notif_type,
        title=title,
        body=body,
        channel_id=channel_id,
        meta_json=meta_json,
        is_read=is_read,
        created_at=created_at or datetime.datetime.utcnow(),
        dedup_key=dedup_key
    )
    db.session.add(notif)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Error creating notification: {e}")
        return None
    return notif

def sync_student_loan_notifications(student_id):
    """
    Rule 1: Inspects active loans for student_id and creates:
    - 2-day advance due reminders (type: 'due')
    - 1 high-priority overdue alert per day (type: 'overdue')
    """
    cleanup_old_notifications()

    student = Student.query.get(student_id)
    if not student:
        return

    issue_counts = db.session.query(
        IssueRecord.book_id, func.count(IssueRecord.id).label('count')
    ).filter_by(student_id=student_id, action='Issue').group_by(IssueRecord.book_id).subquery()

    return_counts = db.session.query(
        IssueRecord.book_id, func.count(IssueRecord.id).label('count')
    ).filter_by(student_id=student_id, action='Return').group_by(IssueRecord.book_id).subquery()

    active_books_query = db.session.query(
        Book,
        func.coalesce(issue_counts.c.count, 0).label('issues'),
        func.coalesce(return_counts.c.count, 0).label('returns')
    ).outerjoin(issue_counts, Book.id == issue_counts.c.book_id) \
     .outerjoin(return_counts, Book.id == return_counts.c.book_id) \
     .filter(func.coalesce(issue_counts.c.count, 0) > func.coalesce(return_counts.c.count, 0)).all()

    now = datetime.datetime.now()
    today = now.date()
    today_str = today.strftime('%Y-%m-%d')

    for b, issues, returns in active_books_query:
        last_issue = IssueRecord.query.filter_by(student_id=student_id, book_id=b.id, action='Issue').order_by(IssueRecord.timestamp.desc()).first()
        if not last_issue:
            continue

        issue_date = last_issue.timestamp
        due_date = issue_date + datetime.timedelta(days=14)
        due_date_date = due_date.date()
        due_date_str = due_date.strftime('%Y-%m-%d')
        due_date_display = due_date.strftime('%d %b %Y')
        days_until_due = (due_date_date - today).days

        # Rule A: 2-Day Advance Due Reminder
        if 0 <= days_until_due <= 2:
            dedup_key = f"due_soon:{last_issue.id}:{due_date_str}"
            if days_until_due == 1:
                title = "Book due tomorrow"
            elif days_until_due == 0:
                title = "Book due today"
            else:
                title = f"Due in {days_until_due} days"
            body = f"{b.title} is due on {due_date_display}. Return or renew it to avoid late fines."
            create_notification(
                student_id=student_id,
                notif_type='due',
                title=title,
                body=body,
                channel_id='updates',
                meta={"dueDate": due_date_display, "chipText": f"Due {due_date_display}", "route": "Borrowed"},
                dedup_key=dedup_key
            )

        # Rule B: 1 High-Priority Overdue Alert Per Day
        if today > due_date_date:
            overdue_days = (today - due_date_date).days
            pending_fine = overdue_days * 5
            dedup_key = f"overdue:{student_id}:{last_issue.id}:{today_str}"
            title = f"Book overdue by {overdue_days} {'day' if overdue_days == 1 else 'days'}"
            body = f"{b.title} was due on {due_date_display}. Return it today to stop the fine from growing."
            create_notification(
                student_id=student_id,
                notif_type='overdue',
                title=title,
                body=body,
                channel_id='urgent',
                meta={
                    "amount": pending_fine,
                    "dueDate": due_date_display,
                    "chipText": f"Pending fine ₹{pending_fine}",
                    "route": "Borrowed"
                },
                dedup_key=dedup_key
            )

def notify_issue_book(student_id, book):
    """Rule 2a: Digital Issue Receipt"""
    due_date = datetime.datetime.now() + datetime.timedelta(days=14)
    due_date_display = due_date.strftime('%d %b %Y')
    return create_notification(
        student_id=student_id,
        notif_type='issued',
        title="Book issued",
        body=f"{book.title} is yours until {due_date_display}.",
        channel_id='updates',
        meta={"dueDate": due_date_display, "chipText": due_date_display, "route": "Borrowed"}
    )

def notify_return_book(student_id, book, fine_paid=0):
    """Rule 2b & 2c: Digital Return Receipt and Fine Added"""
    today_display = datetime.datetime.now().strftime('%d %b %Y')
    notif_return = create_notification(
        student_id=student_id,
        notif_type='returned',
        title="Book returned",
        body=f"{book.title} was returned. Thank you!",
        channel_id='updates',
        meta={"returnedDate": today_display, "chipText": "No dues" if fine_paid == 0 else f"Fine ₹{int(fine_paid)}", "route": "Borrowed"}
    )

    if fine_paid > 0:
        create_notification(
            student_id=student_id,
            notif_type='fine',
            title="Fine added to your account",
            body=f"A fine of ₹{int(fine_paid)} was added for the late return of {book.title}.",
            channel_id='urgent',
            meta={"amount": int(fine_paid), "chipText": f"+ ₹{int(fine_paid)}", "route": "Borrowed"}
        )

    return notif_return

def notify_new_paper(paper):
    """Rule 3a: Targeted Academic Alert on Question Paper upload"""
    dept = paper.dept
    sem = paper.semester
    query = Student.query
    if dept:
        query = query.filter_by(dept=dept)
    if sem:
        try:
            sem_int = int(sem)
            query = query.filter_by(semester=sem_int)
        except Exception:
            pass
    target_students = query.all()
    if not target_students and dept:
        target_students = Student.query.filter_by(dept=dept).all()

    count = 0
    chip_text = f"{dept or 'CST'} · Sem {sem or '5'}"
    for stu in target_students:
        create_notification(
            student_id=stu.id,
            notif_type='paper',
            title="New question papers added",
            body=f"New {paper.filename or 'exam'} question papers for your semester are now in the Digital Archives.",
            channel_id='updates',
            meta={"department": dept, "semester": str(sem), "chipText": chip_text, "route": "Academics"}
        )
        count += 1
    return count

def notify_new_book(book):
    """Rule 3b: Targeted Book Arrival Alert on Book addition"""
    dept = book.dept
    target_students = Student.query.filter_by(dept=dept).all() if dept else Student.query.all()
    count = 0
    chip_text = f"{dept or 'CST'} Catalog"
    for stu in target_students:
        create_notification(
            student_id=stu.id,
            notif_type='book',
            title=f"New arrivals in {dept or 'Library'}",
            body=f"{book.title} is now available in the library catalog.",
            channel_id='updates',
            meta={"chipText": chip_text, "route": "Borrowed"}
        )
        count += 1
    return count

def notify_password_changed(student_id):
    """Rule 4: Account Security Alert"""
    return create_notification(
        student_id=student_id,
        notif_type='security',
        title="Password changed",
        body="Your student portal password was changed. Contact the library if this wasn't you.",
        channel_id='urgent',
        meta={"chipText": "Security", "route": "Profile"}
    )

def notify_broadcast(title, body, important=False):
    """Rule 5: Global Librarian Broadcast"""
    students = Student.query.all()
    count = 0
    channel = 'urgent' if important else 'updates'
    for stu in students:
        create_notification(
            student_id=stu.id,
            notif_type='notice',
            title=title,
            body=body,
            channel_id=channel,
            meta={"chipText": "Sent to all students"}
        )
        count += 1
    return count

def ensure_initial_notifications(student_id):
    """
    Rule 6: Smart Initial Seed for Existing Demo Student.
    Seeds rich notifications across Today, Yesterday, and Earlier if none exist.
    """
    if Notification.query.filter_by(student_id=student_id).count() > 0:
        return

    student = Student.query.get(student_id)
    dept = (student.dept if student else None) or "CST"
    now = datetime.datetime.utcnow()

    initial_items = [
        # --- TODAY ---
        {
            "type": "due",
            "title": "Return Due in 2 Days",
            "body": "Clean Architecture: A Craftsman's Guide is due on Oct 20. Renew or return to avoid overdue fines.",
            "channel_id": "updates",
            "meta": {"dueDate": (now + datetime.timedelta(days=2)).strftime('%d %b %Y'), "chipText": "Due in 2 days", "route": "Borrowed"},
            "created_at": now - datetime.timedelta(minutes=10),
            "is_read": False,
        },
        {
            "type": "paper",
            "title": "New CST Sem 5 PYQ Alert",
            "body": "Winter 2024 Theory of Computation & Computer Networks question papers are now in the Digital Archives.",
            "channel_id": "updates",
            "meta": {"department": dept, "semester": "5th", "chipText": f"{dept} · 5th Semester", "route": "Academics"},
            "created_at": now - datetime.timedelta(hours=2),
            "is_read": False,
        },
        {
            "type": "issued",
            "title": "Digital Issue Receipt",
            "body": "Database System Concepts (Accession #CS-309) has been issued to your account. Due date is Nov 01, 2026.",
            "channel_id": "updates",
            "meta": {"dueDate": "01 Nov 2026", "chipText": "01 Nov 2026", "route": "Borrowed"},
            "created_at": now - datetime.timedelta(hours=5),
            "is_read": True,
        },
        # --- YESTERDAY ---
        {
            "type": "reserve",
            "title": "Reservation Ready for Pickup",
            "body": "Operating System Concepts is available at Circulation Counter 2. Hold valid for 48 hours.",
            "channel_id": "updates",
            "meta": {"chipText": "Ready at Desk", "route": "Borrowed"},
            "created_at": now - datetime.timedelta(days=1, hours=2),
            "is_read": False,
        },
        {
            "type": "overdue",
            "title": "Book overdue by 3 days",
            "body": "Compilers: Principles, Techniques, and Tools was due 3 days ago. Return it today to stop the fine from growing.",
            "channel_id": "urgent",
            "meta": {"amount": 15, "chipText": "Pending fine ₹15", "dueDate": "15 Oct 2026", "route": "Borrowed"},
            "created_at": now - datetime.timedelta(days=1, hours=6),
            "is_read": False,
        },
        {
            "type": "renewed",
            "title": "Loan Successfully Renewed",
            "body": "Artificial Intelligence: A Modern Approach has been extended by 14 days. New due date is Nov 02.",
            "channel_id": "updates",
            "meta": {"dueDate": "02 Nov 2026", "chipText": "02 Nov 2026", "route": "Borrowed"},
            "created_at": now - datetime.timedelta(days=1, hours=10),
            "is_read": True,
        },
        # --- EARLIER ---
        {
            "type": "fine",
            "title": "Fine added to your account",
            "body": "A late fine of ₹15.00 was added for the late return of Compilers (CS-1082).",
            "channel_id": "urgent",
            "meta": {"amount": 15, "chipText": "+ ₹15", "route": "Borrowed"},
            "created_at": now - datetime.timedelta(days=4),
            "is_read": True,
        },
        {
            "type": "book",
            "title": f"New arrivals in {dept}",
            "body": "6 new books on Cloud Computing & Distributed Systems added to the CST library stack.",
            "channel_id": "updates",
            "meta": {"chipText": f"{dept} Catalog", "route": "Borrowed"},
            "created_at": now - datetime.timedelta(days=7),
            "is_read": True,
        },
        {
            "type": "returned",
            "title": "Book returned",
            "body": "Modern Operating Systems was returned. Thank you!",
            "channel_id": "updates",
            "meta": {"chipText": "No dues", "returnedDate": (now - datetime.timedelta(days=10)).strftime('%d %b %Y'), "route": "Borrowed"},
            "created_at": now - datetime.timedelta(days=10),
            "is_read": True,
        },
        {
            "type": "security",
            "title": "Password changed",
            "body": "Your student portal password was changed. Contact the library if this wasn't you.",
            "channel_id": "urgent",
            "meta": {"chipText": "Security", "route": "Profile"},
            "created_at": now - datetime.timedelta(days=12),
            "is_read": True,
        },
        {
            "type": "notice",
            "title": "Global Librarian Broadcast",
            "body": "Central Library reading hall will remain open until 8:00 PM during upcoming mid-term examination week.",
            "channel_id": "updates",
            "meta": {"chipText": "Sent to all students"},
            "created_at": now - datetime.timedelta(days=14),
            "is_read": True,
        },
    ]

    for item in initial_items:
        create_notification(
            student_id=student_id,
            notif_type=item["type"],
            title=item["title"],
            body=item["body"],
            channel_id=item["channel_id"],
            meta=item["meta"],
            created_at=item["created_at"],
            is_read=item["is_read"]
        )
