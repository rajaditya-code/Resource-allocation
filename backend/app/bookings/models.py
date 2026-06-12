"""
Booking models — bookings, unit assignments, return photos, and assignment history.

The booking system works in stages:
    1. User creates a Booking against an AssetModel (quantity-based)
    2. Admin approves the booking
    3. Admin issues specific AssetUnits via BookingUnitAssignment
    4. Admin processes return, records condition and photos via ReturnPhoto
    5. AssetAssignmentHistory keeps a permanent record of who borrowed what
"""

import uuid
from datetime import datetime, date, timezone

from sqlalchemy import (
    Column, String, Text, Integer, Date, DateTime, Enum, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


from app.utils.time import get_ist_now


class Booking(Base):
    """
    A booking request from a user for a certain quantity of an asset model.
    Goes through: Pending → Approved → Issued → Returned (or Rejected/Overdue/Cancelled).
    """
    __tablename__ = "bookings"

    booking_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    asset_model_id = Column(UUID(as_uuid=True), ForeignKey("asset_models.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    purpose = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(
        Enum(
            "Pending", "Approved", "Rejected", "Issued",
            "Returned", "Overdue", "Cancelled",
            name="booking_status",
        ),
        nullable=False,
        default="Pending",
    )
    approval_notes = Column(Text, nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    preferred_unit_id = Column(UUID(as_uuid=True), ForeignKey("asset_units.id"), nullable=True)
    issued_at = Column(DateTime(timezone=True), nullable=True)
    returned_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_ist_now)

    # Relationships
    user = relationship("User", back_populates="bookings", foreign_keys=[user_id])
    asset_model = relationship("AssetModel", back_populates="bookings")
    unit_assignments = relationship("BookingUnitAssignment", back_populates="booking", lazy="selectin")
    return_photos = relationship("ReturnPhoto", back_populates="booking", lazy="selectin")

    def __repr__(self):
        return f"<Booking {self.booking_id} ({self.status})>"


class BookingUnitAssignment(Base):
    """
    When an admin issues a booking, they pick specific units.
    This table tracks which units were assigned, their condition
    before and after, and return details.
    """
    __tablename__ = "booking_unit_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.booking_id"), nullable=False, index=True)
    asset_unit_id = Column(UUID(as_uuid=True), ForeignKey("asset_units.id"), nullable=False, index=True)
    condition_before = Column(
        Enum("Excellent", "Good", "Fair", "Poor", "Damaged", name="asset_condition"),
        nullable=True,
    )
    condition_after = Column(
        Enum("Excellent", "Good", "Fair", "Poor", "Damaged", name="asset_condition"),
        nullable=True,
    )
    return_remarks = Column(Text, nullable=True)
    assigned_at = Column(DateTime(timezone=True), default=get_ist_now)
    returned_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    booking = relationship("Booking", back_populates="unit_assignments")
    asset_unit = relationship("AssetUnit")

    def __repr__(self):
        return f"<Assignment {self.asset_unit_id} → Booking {self.booking_id}>"


class ReturnPhoto(Base):
    """
    Photos uploaded during asset return — evidence for damage disputes.
    Each photo is tied to a specific booking and optionally a specific unit.
    """
    __tablename__ = "return_photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.booking_id"), nullable=False, index=True)
    asset_unit_id = Column(UUID(as_uuid=True), ForeignKey("asset_units.id"), nullable=True)
    image_url = Column(String(500), nullable=False)
    caption = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=get_ist_now)

    # Relationships
    booking = relationship("Booking", back_populates="return_photos")

    def __repr__(self):
        return f"<ReturnPhoto for booking {self.booking_id}>"


class AssetAssignmentHistory(Base):
    """
    Permanent record of every asset unit assignment — who borrowed it,
    when, and what condition it was in before and after.

    This table is never deleted. It's the full lifetime log of a unit.
    """
    __tablename__ = "asset_assignment_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_unit_id = Column(UUID(as_uuid=True), ForeignKey("asset_units.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.booking_id"), nullable=False)
    condition_before = Column(
        Enum("Excellent", "Good", "Fair", "Poor", "Damaged", name="asset_condition"),
        nullable=True,
    )
    condition_after = Column(
        Enum("Excellent", "Good", "Fair", "Poor", "Damaged", name="asset_condition"),
        nullable=True,
    )
    issued_at = Column(DateTime(timezone=True), nullable=False)
    returned_at = Column(DateTime(timezone=True), nullable=True)
    remarks = Column(Text, nullable=True)

    # Relationships
    asset_unit = relationship("AssetUnit", back_populates="assignment_history")

    def __repr__(self):
        return f"<AssignmentHistory unit={self.asset_unit_id} user={self.user_id}>"
