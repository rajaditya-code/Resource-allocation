"""
Notification model — in-app and email notifications for users.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.time import get_ist_now


class Notification(Base):
    """
    In-app notification record. Also triggers an email notification
    when created (if email is configured).

    Types: booking_approved, booking_rejected, asset_issued,
           return_due, asset_overdue, maintenance_update, system
    """
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)  # e.g., 'booking_approved', 'asset_overdue'
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=get_ist_now)

    # Relationships
    user = relationship("User", back_populates="notifications")

    def __repr__(self):
        return f"<Notification {self.type} → user {self.user_id}>"
