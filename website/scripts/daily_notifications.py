"""
Daily Notification Engine for TCEA Library (QRBLMS).
Scans all active loans across all students, generates advance due reminders (due in 0-2 days)
and high-priority overdue alerts with fine tallies. Dispatches native Expo push notifications
with offline queueing (ttl=28 days) and records deduplicated in-app notification history.

Usage:
    python website/scripts/daily_notifications.py
"""

import sys
import os
import datetime

# Add website directory to sys.path
website_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if website_dir not in sys.path:
    sys.path.insert(0, website_dir)

from flask import has_app_context, current_app
from App import create_app
from models import db, Student, Book, IssueRecord, Notification
from sqlalchemy import func
from notification_service import create_notification, send_expo_push, cleanup_old_notifications

def _execute_daily_notifications_core():
    start_time = datetime.datetime.now()
    print(f"[{start_time.strftime('%Y-%m-%d %H:%M:%S')}] Starting daily notification engine...")

    # 1. Cleanup old notifications (older than 30 days)
    deleted_old = cleanup_old_notifications()
    if deleted_old:
        print(f"Cleaned up {deleted_old} notification(s) older than 30 days.")

    today = start_time.date()
    today_str = today.strftime('%Y-%m-%d')

    # 2. Find all active loans across all students
    issue_counts = db.session.query(
        IssueRecord.student_id,
        IssueRecord.book_id,
        func.count(IssueRecord.id).label('issue_count')
    ).filter_by(action='Issue').group_by(IssueRecord.student_id, IssueRecord.book_id).subquery()

    return_counts = db.session.query(
        IssueRecord.student_id,
        IssueRecord.book_id,
        func.count(IssueRecord.id).label('return_count')
    ).filter_by(action='Return').group_by(IssueRecord.student_id, IssueRecord.book_id).subquery()

    active_loans = db.session.query(
        issue_counts.c.student_id,
        issue_counts.c.book_id,
        Book.title.label('book_title')
    ).outerjoin(
        return_counts,
        (issue_counts.c.student_id == return_counts.c.student_id) &
        (issue_counts.c.book_id == return_counts.c.book_id)
    ).outerjoin(Book, issue_counts.c.book_id == Book.id).filter(
        func.coalesce(issue_counts.c.issue_count, 0) > func.coalesce(return_counts.c.return_count, 0)
    ).all()

    print(f"Discovered {len(active_loans)} active loan(s) across catalog.")

    due_reminders_count = 0
    overdue_alerts_count = 0
    processed_students = set()

    for stu_id, book_id, book_title in active_loans:
        processed_students.add(stu_id)
        last_issue = IssueRecord.query.filter_by(
            student_id=stu_id,
            book_id=book_id,
            action='Issue'
        ).order_by(IssueRecord.timestamp.desc()).first()

        if not last_issue:
            continue

        issue_date = last_issue.timestamp
        due_date = getattr(last_issue, 'due_date', None) or (issue_date + datetime.timedelta(days=14))
        due_date_date = due_date.date()
        due_date_str = due_date.strftime('%Y-%m-%d')
        due_date_display = due_date.strftime('%d %b %Y')
        days_until_due = (due_date_date - today).days

        # 2-Day Advance Due Reminder (0 to 2 days remaining)
        if 0 <= days_until_due <= 2:
            dedup_key = f"due_soon:{last_issue.id}:{due_date_str}"
            existing = Notification.query.filter_by(student_id=stu_id, dedup_key=dedup_key).first()
            if not existing:
                if days_until_due == 1:
                    title = "Book due tomorrow"
                elif days_until_due == 0:
                    title = "Book due today"
                else:
                    title = f"Due in {days_until_due} days"
                body = f"'{book_title}' is due on {due_date_display}. Return or renew it to avoid late fines."

                create_notification(
                    student_id=stu_id,
                    notif_type='due',
                    title=title,
                    body=body,
                    channel_id='updates',
                    meta={"dueDate": due_date_display, "chipText": f"Due {due_date_display}", "route": "Borrowed", "bookId": book_id},
                    dedup_key=dedup_key
                )
                send_expo_push(
                    student_id=stu_id,
                    title=title,
                    body=body,
                    data={"screen": "Borrowed", "route": "Borrowed", "bookId": book_id},
                    channel_id="tcea-library-urgent"
                )
                due_reminders_count += 1

        # High-Priority Overdue Alert (today > due_date_date)
        elif today > due_date_date:
            overdue_days = (today - due_date_date).days
            pending_fine = overdue_days * 5
            dedup_key = f"overdue:{stu_id}:{last_issue.id}:{today_str}"
            existing = Notification.query.filter_by(student_id=stu_id, dedup_key=dedup_key).first()
            if not existing:
                title = f"Book overdue by {overdue_days} {'day' if overdue_days == 1 else 'days'}"
                body = f"'{book_title}' was due on {due_date_display}. Return it today to stop the fine from growing."

                create_notification(
                    student_id=stu_id,
                    notif_type='overdue',
                    title=title,
                    body=body,
                    channel_id='urgent',
                    meta={
                        "amount": pending_fine,
                        "dueDate": due_date_display,
                        "chipText": f"Pending fine ₹{pending_fine}",
                        "route": "Borrowed",
                        "bookId": book_id
                    },
                    dedup_key=dedup_key
                )
                send_expo_push(
                    student_id=stu_id,
                    title=title,
                    body=body,
                    data={"screen": "Borrowed", "route": "Borrowed", "bookId": book_id, "amount": pending_fine},
                    channel_id="tcea-library-urgent"
                )
                overdue_alerts_count += 1

    end_time = datetime.datetime.now()
    duration = (end_time - start_time).total_seconds()
    print(f"[{end_time.strftime('%Y-%m-%d %H:%M:%S')}] Daily notification engine run complete in {duration:.2f}s:")
    print(f"  • Unique students processed: {len(processed_students)}")
    print(f"  • Advance due reminders sent: {due_reminders_count}")
    print(f"  • Overdue fine alerts sent: {overdue_alerts_count}")

    return {
        "status": "success",
        "processed_students": len(processed_students),
        "active_loans": len(active_loans),
        "due_reminders_sent": due_reminders_count,
        "overdue_alerts_sent": overdue_alerts_count,
        "cleaned_notifications": deleted_old or 0,
        "duration_seconds": round(duration, 3),
        "timestamp": end_time.isoformat()
    }

def run_daily_notifications(app=None):
    """
    Executes the daily notification engine. Can be called directly from CLI or inside
    a web/cron endpoint. Automatically handles Flask application context if not already active.
    """
    if has_app_context():
        return _execute_daily_notifications_core()
    
    app = app or create_app()
    with app.app_context():
        return _execute_daily_notifications_core()

if __name__ == '__main__':
    run_daily_notifications()
