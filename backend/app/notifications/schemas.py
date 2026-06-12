"""
Notification schemas — request/response models.
"""

from datetime import datetime
from typing import List
from uuid import UUID

from app.schemas_base import BaseModel


class NotificationResponse(BaseModel):
    """Response for a notification."""
    id: UUID
    user_id: UUID
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    """Paginated list of notifications."""
    items: List[NotificationResponse]
    total: int
    unread_count: int


class UnreadCountResponse(BaseModel):
    """Just the unread notification count."""
    unread_count: int
