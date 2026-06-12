"""
Notification routes — endpoints for viewing and managing notifications.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.auth.models import User
from app.notifications import service
from app.notifications.schemas import (
    NotificationResponse, NotificationListResponse, UnreadCountResponse,
)

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


@router.get("/", response_model=NotificationListResponse)
def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's notifications."""
    return service.get_user_notifications(current_user.id, db, page, page_size)


@router.get("/unread-count", response_model=UnreadCountResponse)
def unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the count of unread notifications."""
    count = service.get_unread_count(current_user.id, db)
    return UnreadCountResponse(unread_count=count)


@router.put("/{notification_id}/read")
def mark_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a notification as read."""
    service.mark_as_read(notification_id, current_user.id, db)
    return {"message": "Marked as read"}


@router.put("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications as read."""
    count = service.mark_all_as_read(current_user.id, db)
    return {"message": f"Marked {count} notifications as read"}
