"""
Auth service — all authentication business logic lives here.

Handles registration, login, JWT tokens with blacklist support,
email verification, password reset, admin approval workflow,
and profile management.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from jose import jwt, JWTError
from passlib.hash import argon2
from sqlalchemy.orm import Session

from app.config import settings
from app.auth.models import User, OTPVerification, TokenBlacklist
from app.auth.schemas import (
    UserRegister, AdminRegister, UserLogin, TokenResponse,
    UserUpdate,
)
from app.utils.email import generate_otp, send_otp_email


from zoneinfo import ZoneInfo
from app.utils.time import get_ist_now




# ──────────────────────────────────────────────
# Password Hashing (Argon2)
# ──────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Hash a password with Argon2."""
    return argon2.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Check a plain password against its Argon2 hash."""
    return argon2.verify(plain, hashed)


# ──────────────────────────────────────────────
# JWT Token Management
# ──────────────────────────────────────────────

def create_access_token(user_id: UUID, role: str) -> str:
    """Create a short-lived access token with a unique jti for blacklisting."""
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "jti": uuid.uuid4().hex,
        "exp": get_ist_now() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: UUID, role: str) -> str:
    """Create a long-lived refresh token with a unique jti for blacklisting."""
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "refresh",
        "jti": uuid.uuid4().hex,
        "exp": get_ist_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.JWT_REFRESH_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate an access token. Raises HTTPException if invalid."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def decode_refresh_token(token: str) -> dict:
    """Decode and validate a refresh token."""
    try:
        payload = jwt.decode(
            token, settings.JWT_REFRESH_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")


def is_token_blacklisted(jti: str, db: Session) -> bool:
    """Check if a token has been blacklisted (user logged out)."""
    return db.query(TokenBlacklist).filter(TokenBlacklist.jti == jti).first() is not None


# ──────────────────────────────────────────────
# User Registration
# ──────────────────────────────────────────────

def register_user(data: UserRegister, db: Session) -> User:
    """
    Register a new user account.
    Creates the user, hashes the password, and sends a verification OTP.
    """
    # Make sure the email isn't already taken
    email_lower = data.email.lower()
    existing = db.query(User).filter(User.email == email_lower).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        full_name=data.full_name,
        email=email_lower,
        password_hash=hash_password(data.password),
        club=data.club,
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Send verification OTP
    _create_and_send_otp(user, "email_verify", db)

    # Audit log
    _log_action(db, user.id, "USER_REGISTERED", "user", user.id, {"email": user.email})

    return user


# ──────────────────────────────────────────────
# Admin Registration
# ──────────────────────────────────────────────

def register_admin(data: AdminRegister, db: Session) -> User:
    """
    Register a new admin account. The account starts as pending_admin
    and needs email verification + approval from an existing admin.
    """
    email_lower = data.email.lower()
    existing = db.query(User).filter(User.email == email_lower).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        full_name=data.full_name,
        email=email_lower,
        password_hash=hash_password(data.password),
        club=None,
        role="pending_admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Send verification OTP
    _create_and_send_otp(user, "email_verify", db)

    # Audit log
    _log_action(db, user.id, "ADMIN_REGISTERED", "user", user.id, {"email": user.email, "club": None})

    return user


# ──────────────────────────────────────────────
# Admin Approval
# ──────────────────────────────────────────────

def approve_admin(user_id: UUID, approving_admin: User, admin_password: str, db: Session) -> User:
    """
    Approve a pending admin account.
    The approving admin must re-enter their password for extra security.
    """
    # Verify the approving admin's password
    if not verify_password(admin_password, approving_admin.password_hash):
        raise HTTPException(status_code=403, detail="Incorrect password")

    # Find the pending admin
    pending_user = db.query(User).filter(User.id == user_id).first()
    if not pending_user:
        raise HTTPException(status_code=404, detail="User not found")

    if pending_user.role != "pending_admin":
        raise HTTPException(status_code=400, detail="This user is not a pending admin")

    if not pending_user.is_email_verified:
        raise HTTPException(status_code=400, detail="This user hasn't verified their email yet")

    # Grant admin role
    pending_user.role = "admin"
    db.commit()
    db.refresh(pending_user)

    # Audit log with full context (legacy JSON metadata table for activity feed)
    _log_action(db, approving_admin.id, "ADMIN_PRIVILEGE_GRANTED", "user", pending_user.id, {
        "approved_admin_email": pending_user.email,
        "approved_admin_name": pending_user.full_name,
        "approving_admin_email": approving_admin.email,
        "approving_admin_name": approving_admin.full_name,
    })

    # Record in the dedicated AdminApprovalAuditLog table
    from app.audit.models import AdminApprovalAuditLog
    approval_log = AdminApprovalAuditLog(
        approved_admin_id=pending_user.id,
        approving_admin_id=approving_admin.id,
    )
    db.add(approval_log)
    db.commit()

    # Notify the newly approved admin
    _send_notification(
        db, pending_user.id,
        "Admin Access Granted",
        f"Your admin access has been approved by {approving_admin.full_name}. You can now log in as an admin.",
        "admin_approved",
    )

    return pending_user


# ──────────────────────────────────────────────
# Pending Admins
# ──────────────────────────────────────────────

def get_pending_admins(db: Session, email: Optional[str] = None):
    """List all users pending for admin approval, optionally filtered by email."""
    query = db.query(User).filter(User.role == "pending_admin")
    if email:
        query = query.filter(User.email.ilike(f"%{email}%"))
    return query.order_by(User.created_at.desc()).all()


# ──────────────────────────────────────────────
# Login
# ──────────────────────────────────────────────

def login_user(data: UserLogin, db: Session) -> TokenResponse:
    """
    Authenticate a user and return access + refresh tokens.
    Blocks unverified emails and pending admins.
    """
    email_lower = data.email.lower()
    user = db.query(User).filter(User.email == email_lower).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Block users who haven't verified their email
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in",
        )

    # Block pending admins who haven't been approved yet
    if user.role == "pending_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your admin account is awaiting approval from an existing admin",
        )

    # Generate tokens
    access = create_access_token(user.id, user.role)
    refresh = create_refresh_token(user.id, user.role)

    # Audit log
    _log_action(db, user.id, "USER_LOGIN", "user", user.id)

    return TokenResponse(access_token=access, refresh_token=refresh)


# ──────────────────────────────────────────────
# Logout (Token Blacklist)
# ──────────────────────────────────────────────

def logout_user(access_token: str, refresh_token: str, db: Session) -> None:
    """
    Blacklist both the access and refresh tokens so they can't be used again.
    """
    # Blacklist the access token
    try:
        access_payload = jwt.decode(
            access_token, settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        access_jti = access_payload.get("jti")
        access_exp = datetime.fromtimestamp(access_payload["exp"], tz=ZoneInfo("Asia/Kolkata"))
        if access_jti:
            blacklist_entry = TokenBlacklist(jti=access_jti, expires_at=access_exp)
            db.add(blacklist_entry)
    except JWTError:
        pass  # token might already be expired, that's fine

    # Blacklist the refresh token
    try:
        refresh_payload = jwt.decode(
            refresh_token, settings.JWT_REFRESH_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        refresh_jti = refresh_payload.get("jti")
        refresh_exp = datetime.fromtimestamp(refresh_payload["exp"], tz=ZoneInfo("Asia/Kolkata"))
        if refresh_jti:
            blacklist_entry = TokenBlacklist(jti=refresh_jti, expires_at=refresh_exp)
            db.add(blacklist_entry)
    except JWTError:
        pass

    db.commit()


# ──────────────────────────────────────────────
# Token Refresh
# ──────────────────────────────────────────────

def refresh_access_token(refresh_token: str, db: Session) -> TokenResponse:
    """Validate a refresh token and issue a new token pair."""
    payload = decode_refresh_token(refresh_token)

    # Check if this refresh token has been blacklisted
    jti = payload.get("jti")
    if jti and is_token_blacklisted(jti, db):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    user_id = payload["sub"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access = create_access_token(user.id, user.role)
    refresh = create_refresh_token(user.id, user.role)

    return TokenResponse(access_token=access, refresh_token=refresh)


# ──────────────────────────────────────────────
# Email Verification
# ──────────────────────────────────────────────

def verify_email(email: str, otp_code: str, db: Session) -> bool:
    """Verify a user's email address using the OTP they received."""
    email_lower = email.lower()
    user = db.query(User).filter(User.email == email_lower).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_email_verified:
        raise HTTPException(status_code=400, detail="Email already verified")

    _validate_otp(user.id, otp_code, "email_verify", db)

    user.is_email_verified = True
    db.commit()

    return True


def resend_verification_otp(email: str, db: Session) -> bool:
    """
    Resend a verification OTP. Invalidates any old unused OTPs first,
    then generates and sends a fresh one.
    """
    email_lower = email.lower()
    user = db.query(User).filter(User.email == email_lower).first()
    if not user:
        # Don't reveal whether the email exists
        return True

    if user.is_email_verified:
        raise HTTPException(status_code=400, detail="Email is already verified")

    _create_and_send_otp(user, "email_verify", db)
    return True


# ──────────────────────────────────────────────
# Password Reset Flow
# ──────────────────────────────────────────────

def forgot_password(email: str, db: Session) -> bool:
    """
    Send a password-reset OTP to the user's email.
    We don't reveal whether the email exists (security best practice).
    """
    email_lower = email.lower()
    user = db.query(User).filter(User.email == email_lower).first()
    if not user:
        return True

    _create_and_send_otp(user, "password_reset", db)
    return True


def reset_password(email: str, otp_code: str, new_password: str, db: Session) -> bool:
    """Reset a user's password after validating the OTP."""
    email_lower = email.lower()
    user = db.query(User).filter(User.email == email_lower).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    _validate_otp(user.id, otp_code, "password_reset", db)

    user.password_hash = hash_password(new_password)
    db.commit()

    return True


def change_password(user: User, old_password: str, new_password: str, db: Session) -> bool:
    """Change the user's password when they are already logged in."""
    if not verify_password(old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")
        
    user.password_hash = hash_password(new_password)
    db.commit()
    
    # Audit log
    _log_action(db, user.id, "PASSWORD_CHANGED", "user", user.id)
    
    return True


# ──────────────────────────────────────────────
# Profile Management
# ──────────────────────────────────────────────

def update_user_profile(user: User, data: UserUpdate, db: Session) -> User:
    """Update the current user's profile fields."""
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.club is not None:
        user.club = data.club

    db.commit()
    db.refresh(user)
    return user


def update_profile_image(user: User, image_url: str, db: Session) -> User:
    """Set or replace the user's profile image URL."""
    user.profile_image = image_url
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(user_id: UUID, db: Session) -> Optional[User]:
    """Fetch a user by their UUID."""
    return db.query(User).filter(User.id == user_id).first()


# ──────────────────────────────────────────────
# Internal OTP Helpers
# ──────────────────────────────────────────────

def _create_and_send_otp(user: User, purpose: str, db: Session) -> None:
    """Generate an OTP, store it in the database, and email it to the user."""
    # Invalidate any existing unused OTPs for this purpose
    db.query(OTPVerification).filter(
        OTPVerification.user_id == user.id,
        OTPVerification.purpose == purpose,
        OTPVerification.is_used == False,
    ).update({"is_used": True})

    # Create a fresh OTP (10 minute window)
    otp_code = generate_otp()
    otp = OTPVerification(
        user_id=user.id,
        otp_code=otp_code,
        purpose=purpose,
        expires_at=get_ist_now() + timedelta(minutes=10),
    )
    db.add(otp)
    db.commit()

    # Send the email
    send_otp_email(user.email, otp_code, purpose)


def _validate_otp(user_id: UUID, otp_code: str, purpose: str, db: Session) -> None:
    """Validate an OTP code. Raises HTTPException if invalid or expired."""
    otp = db.query(OTPVerification).filter(
        OTPVerification.user_id == user_id,
        OTPVerification.otp_code == otp_code,
        OTPVerification.purpose == purpose,
        OTPVerification.is_used == False,
    ).first()

    if not otp:
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    # Compare with timezone-aware UTC time
    now = get_ist_now()
    expiry = otp.expires_at
    # Handle case where stored expiry might not be timezone-aware
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=ZoneInfo("Asia/Kolkata"))

    if expiry < now:
        raise HTTPException(status_code=400, detail="OTP has expired")

    # Mark as used
    otp.is_used = True
    db.commit()


# ──────────────────────────────────────────────
# Internal Helpers (Audit + Notifications)
# ──────────────────────────────────────────────

def _log_action(db: Session, user_id, action: str, entity_type: str, entity_id=None, metadata: dict = None):
    """Create an audit log entry. Imported late to avoid circular imports."""
    from app.audit.models import AuditLog
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_=metadata,
    )
    db.add(log)
    db.flush()


def _send_notification(db: Session, user_id, title: str, message: str, notif_type: str):
    """Create an in-app notification. Imported late to avoid circular imports."""
    from app.notifications.models import Notification
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type,
    )
    db.add(notif)
    db.flush()
