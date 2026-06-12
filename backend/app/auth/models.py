"""
Auth models — User accounts, OTP verification, and token blacklist.

The User model is the central identity table. Every other table
in the system references it through foreign keys.
"""

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import (
    Column, String, Boolean, Float, DateTime, Enum, Text, ForeignKey, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.time import get_ist_now


class User(Base):
    """
    Core user table — holds credentials, profile, and role.
    The reliability_score starts at 100 and changes based on user behavior.
    """
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    role = Column(
        Enum("admin", "user", "pending_admin", name="user_role"),
        nullable=False,
        default="user",
    )
    profile_image = Column(String(500), nullable=True)
    club = Column(String(255), nullable=True)
    is_email_verified = Column(Boolean, default=False)
    reliability_score = Column(Float, default=100.0)

    created_at = Column(DateTime(timezone=True), default=get_ist_now)
    updated_at = Column(DateTime(timezone=True), default=get_ist_now, onupdate=get_ist_now)

    # Relationships
    bookings = relationship("Booking", back_populates="user", lazy="dynamic", foreign_keys="[Booking.user_id]")
    notifications = relationship("Notification", back_populates="user", lazy="dynamic")
    audit_logs = relationship("AuditLog", back_populates="user", lazy="dynamic")
    otp_verifications = relationship("OTPVerification", back_populates="user", lazy="dynamic")

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"


class OTPVerification(Base):
    """
    Stores OTP codes for email verification and password resets.
    Each code expires after 10 minutes and can only be used once.
    """
    __tablename__ = "otp_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    otp_code = Column(String(6), nullable=False)
    purpose = Column(
        Enum("email_verify", "password_reset", name="otp_purpose"),
        nullable=False,
    )
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_ist_now)

    # Relationship back to user
    user = relationship("User", back_populates="otp_verifications", foreign_keys=[user_id])


class TokenBlacklist(Base):
    """
    Blacklisted JWT tokens — when a user logs out, their token's
    unique ID (jti) gets stored here so it can't be used again.
    Old entries are safe to clean up after they expire naturally.
    """
    __tablename__ = "token_blacklist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jti = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_ist_now)
