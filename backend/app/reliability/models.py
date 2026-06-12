"""
Reliability models — tracks every change to a user's reliability score.

Whenever a user's score changes (late return, queue timeout, admin adjustment),
a record is created here so there's a full audit trail of why their score is
what it is.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Text, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils.time import get_ist_now


class ReliabilityHistory(Base):
    """
    One entry = one score change. You can always reconstruct a user's
    full score journey by reading these entries in order.
    """
    __tablename__ = "reliability_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    old_score = Column(Float, nullable=False)
    new_score = Column(Float, nullable=False)
    reason = Column(
        Enum("LATE_RETURN", "QUEUE_TIMEOUT", "ADMIN_ADJUSTMENT", "ON_TIME_RETURN", "DAMAGE", "OTHER",
             name="reliability_reason"),
        nullable=False,
    )
    details = Column(Text, nullable=True)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=get_ist_now)

    def __repr__(self):
        return f"<ReliabilityHistory {self.old_score} → {self.new_score} ({self.reason})>"
