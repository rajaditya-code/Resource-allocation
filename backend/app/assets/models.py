"""
Asset models — the core of the inventory system.

Architecture:
    AssetModel  → The "type" of asset (e.g., Canon EOS 90D)
    AssetUnit   → An individual physical item (e.g., CAM-001)
    AssetImage  → Photos attached to an asset model
    AssetImageHistory → Tracks every image upload/replace/delete
"""

import uuid
from datetime import datetime, date

from sqlalchemy import (
    Column, String, Text, Integer, Date, DateTime, Enum,
    Boolean, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.time import get_ist_now


class AssetModel(Base):
    """
    An asset model represents a TYPE of asset — the SKU or product line.
    For example, "Canon EOS 90D" is an asset model with multiple physical units.
    """
    __tablename__ = "asset_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)  # primary display image
    location = Column(String(255), nullable=True)
    purchase_date = Column(Date, nullable=True)
    status = Column(
        Enum("Available", "Unavailable", "Maintenance", "Damaged", name="asset_model_status"),
        nullable=False,
        default="Available",
    )

    created_at = Column(DateTime, default=get_ist_now)
    updated_at = Column(DateTime, default=get_ist_now, onupdate=get_ist_now)

    # Relationships
    units = relationship("AssetUnit", back_populates="asset_model", lazy="dynamic")
    images = relationship("AssetImage", back_populates="asset_model", lazy="selectin")
    bookings = relationship("Booking", back_populates="asset_model", lazy="dynamic")

    @property
    def total_units(self) -> int:
        """Count all non-retired units of this model."""
        return self.units.filter(AssetUnit.status != "Retired").count()

    @property
    def available_units(self) -> int:
        """Count units currently available for booking."""
        return self.units.filter(AssetUnit.status == "Available").count()

    def __repr__(self):
        return f"<AssetModel {self.name} ({self.category})>"


class AssetUnit(Base):
    """
    An individual physical item — the actual thing you can hold.

    Each unit has its own:
    - Unique code (CAM-001, MIC-002, etc.)
    - Serial number
    - Condition tracking
    - QR code
    - Maintenance history
    - Assignment history
    """
    __tablename__ = "asset_units"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_model_id = Column(UUID(as_uuid=True), ForeignKey("asset_models.id"), nullable=False, index=True)
    unit_code = Column(String(50), unique=True, nullable=False, index=True)  # e.g., CAM-001
    serial_number = Column(String(100), nullable=True)
    condition = Column(
        Enum("Excellent", "Good", "Fair", "Poor", "Damaged", name="asset_condition"),
        nullable=False,
        default="Good",
    )
    status = Column(
        Enum("Available", "Issued", "Maintenance", "Retired", name="asset_unit_status"),
        nullable=False,
        default="Available",
    )
    qr_code_url = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=get_ist_now)
    updated_at = Column(DateTime, default=get_ist_now, onupdate=get_ist_now)

    # Relationships
    asset_model = relationship("AssetModel", back_populates="units")
    health_logs = relationship("AssetHealthLog", back_populates="asset_unit", lazy="dynamic")
    maintenance_requests = relationship("MaintenanceRequest", back_populates="asset_unit", lazy="dynamic")
    assignment_history = relationship("AssetAssignmentHistory", back_populates="asset_unit", lazy="dynamic")

    def __repr__(self):
        return f"<AssetUnit {self.unit_code} ({self.condition})>"


class AssetImage(Base):
    """
    Images attached to an asset model.
    Supports multiple images per model, with one marked as primary.
    """
    __tablename__ = "asset_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_model_id = Column(UUID(as_uuid=True), ForeignKey("asset_models.id"), nullable=False, index=True)
    image_url = Column(String(500), nullable=False)
    is_primary = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=get_ist_now)

    # Relationships
    asset_model = relationship("AssetModel", back_populates="images")
    history = relationship("AssetImageHistory", back_populates="asset_image", lazy="dynamic")

    def __repr__(self):
        return f"<AssetImage {self.id} for model {self.asset_model_id}>"


class AssetImageHistory(Base):
    """
    Tracks every change to asset images — uploads, replacements, and deletions.
    Admins can review the full image change log for any asset model.
    """
    __tablename__ = "asset_image_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_image_id = Column(UUID(as_uuid=True), ForeignKey("asset_images.id"), nullable=True)  # null if deleted
    asset_model_id = Column(UUID(as_uuid=True), ForeignKey("asset_models.id"), nullable=False, index=True)
    old_image_url = Column(String(500), nullable=True)  # null for new uploads
    new_image_url = Column(String(500), nullable=True)  # null for deletions
    action = Column(
        Enum("upload", "replace", "delete", name="image_action"),
        nullable=False,
    )
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime, default=get_ist_now)

    # Relationships
    asset_image = relationship("AssetImage", back_populates="history")

    def __repr__(self):
        return f"<AssetImageHistory {self.action} at {self.timestamp}>"
