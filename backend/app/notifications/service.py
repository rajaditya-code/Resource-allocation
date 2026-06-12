"""
Notification service — handles in-app and email notification delivery.

Every critical event in the system calls create_notification() to
keep users informed. Email is sent alongside if configured.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.notifications.models import Notification
from app.auth.models import User
from app.utils.email import send_notification_email


def create_notification(
    user_id: UUID,
    title: str,
    message: str,
    notification_type: str,
    db: Session,
    send_email: bool = True,
) -> Notification:
    """
    Create an in-app notification and optionally send an email.

    This is the central function called by all modules when something
    notable happens (booking approved, asset overdue, etc.).
    """
    # Create in-app notification
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Also send an email if configured
    if send_email:
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.email:
            send_notification_email(user.email, title, message)

    return notification


def get_user_notifications(
    user_id: UUID,
    db: Session,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Get notifications for a user with pagination."""
    query = db.query(Notification).filter(Notification.user_id == user_id)

    total = query.count()
    unread = query.filter(Notification.is_read == False).count()

    offset = (page - 1) * page_size
    items = query.order_by(Notification.created_at.desc()).offset(offset).limit(page_size).all()

    return {
        "items": items,
        "total": total,
        "unread_count": unread,
    }


def mark_as_read(notification_id: UUID, user_id: UUID, db: Session) -> bool:
    """Mark a specific notification as read."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user_id,
    ).first()

    if not notification:
        return False

    notification.is_read = True
    db.commit()
    return True


def mark_all_as_read(user_id: UUID, db: Session) -> int:
    """Mark all of a user's unread notifications as read. Returns count updated."""
    count = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return count


def get_unread_count(user_id: UUID, db: Session) -> int:
    """Get the count of unread notifications for a user."""
    return db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,
    ).count()


# ──────────────────────────────────────────────
# Convenience functions for common notification types
# ──────────────────────────────────────────────

def notify_booking_approved(user_id: UUID, asset_name: str, db: Session):
    """Notify user that their booking was approved."""
    create_notification(
        user_id=user_id,
        title="Booking Approved",
        message=f"Your booking for {asset_name} has been approved. Please wait for issuance.",
        notification_type="booking_approved",
        db=db,
    )


def notify_booking_rejected(user_id: UUID, asset_name: str, reason: str, db: Session):
    """Notify user that their booking was rejected."""
    create_notification(
        user_id=user_id,
        title="Booking Rejected",
        message=f"Your booking for {asset_name} was rejected. Reason: {reason}",
        notification_type="booking_rejected",
        db=db,
    )


def notify_asset_issued(user_id: UUID, asset_name: str, unit_codes: list, db: Session):
    """Notify user that assets have been issued to them."""
    units_str = ", ".join(unit_codes)
    create_notification(
        user_id=user_id,
        title="Assets Issued",
        message=f"You've been issued {asset_name} units: {units_str}. Please collect them.",
        notification_type="asset_issued",
        db=db,
    )


def notify_return_due(user_id: UUID, asset_name: str, due_date: str, db: Session):
    """Remind user that a return is due soon."""
    create_notification(
        user_id=user_id,
        title="Return Due Reminder",
        message=f"Your booking for {asset_name} is due for return on {due_date}.",
        notification_type="return_due",
        db=db,
    )


def notify_asset_overdue(user_id: UUID, asset_name: str, db: Session):
    """Notify user that their booking is overdue."""
    create_notification(
        user_id=user_id,
        title="Asset Overdue",
        message=f"Your booking for {asset_name} is OVERDUE. Please return it immediately.",
        notification_type="asset_overdue",
        db=db,
    )


def notify_maintenance_update(user_id: UUID, unit_code: str, new_status: str, db: Session):
    """Notify user about a maintenance status update."""
    create_notification(
        user_id=user_id,
        title="Maintenance Update",
        message=f"Maintenance request for {unit_code} has been updated to: {new_status}",
        notification_type="maintenance_update",
        db=db,
    )
