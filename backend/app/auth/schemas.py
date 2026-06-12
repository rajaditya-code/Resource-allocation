"""
Auth schemas — request/response models for authentication endpoints.

All validation happens here via Pydantic v2. The API layer
just passes data through; it never does its own validation.
"""

import re
from datetime import datetime
from typing import Optional
from uuid import UUID

from app.schemas_base import BaseModel, EmailStr, Field, field_validator


# ──────────────────────────────────────────────
# Password Strength Validator (shared)
# ──────────────────────────────────────────────

def validate_password_strength(password: str) -> str:
    """
    Enforce password strength rules:
    - At least 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 number
    - At least 1 special character
    """
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?~`]", password):
        raise ValueError("Password must contain at least one special character")
    return password


# ──────────────────────────────────────────────
# Registration
# ──────────────────────────────────────────────

class UserRegister(BaseModel):
    """What a new user submits to create an account."""
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    club: Optional[str] = Field(None, max_length=255)

    @field_validator("password")
    @classmethod
    def check_password(cls, v):
        return validate_password_strength(v)


class AdminRegister(BaseModel):
    """Admin signup — account starts as pending_admin until approved."""
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def check_password(cls, v):
        return validate_password_strength(v)


# ──────────────────────────────────────────────
# Login
# ──────────────────────────────────────────────

class UserLogin(BaseModel):
    """Login credentials."""
    email: EmailStr
    password: str


# ──────────────────────────────────────────────
# Tokens
# ──────────────────────────────────────────────

class TokenResponse(BaseModel):
    """Returned after successful login or token refresh."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefreshRequest(BaseModel):
    """Submit a refresh token to get a new access token."""
    refresh_token: str


# ──────────────────────────────────────────────
# OTP & Password Reset
# ──────────────────────────────────────────────

class VerifyEmailRequest(BaseModel):
    """Verify email with the OTP code sent during registration."""
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6)


class ResendOTPRequest(BaseModel):
    """Request a fresh verification OTP."""
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    """Triggers sending a password-reset OTP to the user's email."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Reset password using the OTP received via email."""
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def check_password(cls, v):
        return validate_password_strength(v)


class ChangePasswordRequest(BaseModel):
    """Request to change password when already logged in."""
    old_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def check_password(cls, v):
        return validate_password_strength(v)


# ──────────────────────────────────────────────
# Admin Approval
# ──────────────────────────────────────────────

class AdminApproveRequest(BaseModel):
    """Approving admin must re-enter their password for verification."""
    password: str


# ──────────────────────────────────────────────
# Logout
# ──────────────────────────────────────────────

class LogoutRequest(BaseModel):
    """Submit the refresh token so both tokens get blacklisted."""
    refresh_token: str


# ──────────────────────────────────────────────
# User Profile
# ──────────────────────────────────────────────

class UserResponse(BaseModel):
    """Public-facing user representation (never exposes password hash)."""
    id: UUID
    full_name: str
    email: str
    role: str
    profile_image: Optional[str] = None
    club: Optional[str] = None
    is_email_verified: bool
    reliability_score: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """Fields a user can update on their own profile."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    club: Optional[str] = Field(None, max_length=255)


class MessageResponse(BaseModel):
    """Generic success message."""
    message: str
