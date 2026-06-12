"""
Queue models — waitlist system for unavailable assets.

When an asset is fully booked, users can join a queue. When the asset
becomes available again, the first person in line gets a 4-hour
reservation window to book it. If they don't book in time, the
reservation expires and moves to the next person.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


from app.utils.time import get_ist_now


class AssetQueue(Base):
    """
    A spot in the waitlist for an asset model.
    Position determines order (1 = first in line).
    When it's your turn, status goes to Reserved and you get 4 hours to book.
    """
    __tablename__ = "asset_queue"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_model_id = Column(UUID(as_uuid=True), ForeignKey("asset_models.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    position = Column(Integer, nullable=False)
    status = Column(
        Enum("Waiting", "Reserved", "Expired", "Completed", name="queue_status"),
        nullable=False,
        default="Waiting",
    )
    reserved_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_ist_now)

    # Relationships
    asset_model = relationship("AssetModel")
    user = relationship("User")

    def __repr__(self):
        return f"<Queue #{self.position} for model {self.asset_model_id} ({self.status})>"
