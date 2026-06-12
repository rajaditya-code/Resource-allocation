"""
Audit log model — enterprise-grade action tracking.

Every critical action in the system (asset creation, booking approval,
issuance, returns, etc.) creates an audit log entry. This provides
full traceability and also powers the system activity feed.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.time import get_ist_now


class AuditLog(Base):
    """
    Immutable audit trail. Records who did what, to which entity, and when.
    The metadata field stores additional context (old values, new values, etc.).
    """
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # null for system actions
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)  # e.g., 'asset', 'booking', 'user'
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)  # extra context (Python reserved word workaround)
    timestamp = Column(DateTime, default=get_ist_now, index=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    def __repr__(self):
        return f"<AuditLog {self.action} on {self.entity_type} at {self.timestamp}>"


class AdminApprovalAuditLog(Base):
    """
    Dedicated audit log specifically for admin approvals.
    Records the approved admin user, the approving admin user, and the timestamp.
    """
    __tablename__ = "admin_approval_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    approved_admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    approving_admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String(100), nullable=False, default="ADMIN_PRIVILEGE_GRANTED")
    timestamp = Column(DateTime(timezone=True), default=get_ist_now, index=True)

    # Relationships
    approved_admin = relationship("User", foreign_keys=[approved_admin_id])
    approving_admin = relationship("User", foreign_keys=[approving_admin_id])

    def __repr__(self):
        return f"<AdminApprovalAuditLog approved={self.approved_admin_id} by={self.approving_admin_id} at={self.timestamp}>"
