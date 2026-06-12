"""
Maintenance models — maintenance requests and asset health logs.

These track the physical condition of individual asset units over time.
MaintenanceRequest is a ticket system for reporting and fixing issues.
AssetHealthLog is a changelog for condition transitions.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.time import get_ist_now


class MaintenanceRequest(Base):
    """
    A maintenance ticket for a specific asset unit.
    Users can report issues; admins can assign, prioritize, and resolve.
    """
    __tablename__ = "maintenance_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_unit_id = Column(UUID(as_uuid=True), ForeignKey("asset_units.id"), nullable=False, index=True)
    issue = Column(Text, nullable=False)
    priority = Column(
        Enum("Low", "Medium", "High", "Critical", name="maintenance_priority"),
        nullable=False,
        default="Medium",
    )
    status = Column(
        Enum("Open", "In Progress", "Resolved", "Closed", name="maintenance_status"),
        nullable=False,
        default="Open",
    )
    reported_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=get_ist_now)
    updated_at = Column(DateTime, default=get_ist_now, onupdate=get_ist_now)

    # Relationships
    asset_unit = relationship("AssetUnit", back_populates="maintenance_requests")

    def __repr__(self):
        return f"<Maintenance {self.id} ({self.priority}/{self.status})>"


class AssetHealthLog(Base):
    """
    Tracks condition changes for individual asset units.
    Every time a unit's condition changes (via return, maintenance, manual update),
    a record is created here for full audit trail.
    """
    __tablename__ = "asset_health_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_unit_id = Column(UUID(as_uuid=True), ForeignKey("asset_units.id"), nullable=False, index=True)
    previous_condition = Column(
        Enum("Excellent", "Good", "Fair", "Poor", "Damaged", name="asset_condition"),
        nullable=True,
    )
    current_condition = Column(
        Enum("Excellent", "Good", "Fair", "Poor", "Damaged", name="asset_condition"),
        nullable=False,
    )
    remarks = Column(Text, nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime, default=get_ist_now)

    # Relationships
    asset_unit = relationship("AssetUnit", back_populates="health_logs")

    def __repr__(self):
        return f"<HealthLog {self.previous_condition} → {self.current_condition}>"
