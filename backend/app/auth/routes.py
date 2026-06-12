"""
Auth routes — all authentication, admin approval, and profile endpoints.

Every route is thin — it just validates input, calls the service layer,
and returns the response. No business logic lives here.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.auth.models import User
from app.auth.permissions import require_role
from app.auth.schemas import (
    UserRegister, AdminRegister, UserLogin,
    TokenResponse, TokenRefreshRequest,
    VerifyEmailRequest, ResendOTPRequest,
    ForgotPasswordRequest, ResetPasswordRequest,
    AdminApproveRequest, LogoutRequest, ChangePasswordRequest,
    UserResponse, UserUpdate, MessageResponse,
)
from app.auth import service
from app.utils.supabase_client import upload_file as upload_to_supabase
from app.utils.validators import validate_image

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


# ──────────────────────────────────────────────
# Public Endpoints
# ──────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """Create a new user account. Sends a verification OTP to the email."""
    return service.register_user(data, db)


@router.post("/admin-register", response_model=UserResponse, status_code=201)
def admin_register(data: AdminRegister, db: Session = Depends(get_db)):
    """
    Register a new admin account. Starts as pending_admin.
    Needs email verification first, then approval from an existing admin.
    """
    return service.register_admin(data, db)


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """Authenticate with email and password. Returns access + refresh tokens."""
    return service.login_user(data, db)


@router.post("/logout", response_model=MessageResponse)
def logout(
    data: LogoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log out by blacklisting the current tokens."""
    from app.dependencies import _get_raw_token
    access_token = _get_raw_token()
    service.logout_user(access_token, data.refresh_token, db)
    return MessageResponse(message="Logged out successfully")


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(data: TokenRefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new token pair."""
    return service.refresh_access_token(data.refresh_token, db)


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(data: VerifyEmailRequest, db: Session = Depends(get_db)):
    """Verify email address using the OTP sent during registration."""
    service.verify_email(data.email, data.otp_code, db)
    return MessageResponse(message="Email verified successfully")


@router.post("/resend-verification-otp", response_model=MessageResponse)
def resend_otp(data: ResendOTPRequest, db: Session = Depends(get_db)):
    """Resend a fresh verification OTP. Invalidates old unused OTPs."""
    service.resend_verification_otp(data.email, db)
    return MessageResponse(message="If the email exists, a new verification code has been sent")


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Send a password-reset OTP to the user's email."""
    service.forgot_password(data.email, db)
    return MessageResponse(message="If the email exists, a reset code has been sent")


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using the OTP received via email."""
    service.reset_password(data.email, data.otp_code, data.new_password, db)
    return MessageResponse(message="Password has been reset successfully")


# ──────────────────────────────────────────────
# Admin Approval
# ──────────────────────────────────────────────

@router.get("/pending-admins", response_model=list[UserResponse])
def list_pending_admins(
    email: str = Query(None, description="Search by email address"),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """
    List all people pending for admin approval. 
    Can be searched by email address. Admin only.
    """
    return service.get_pending_admins(db, email=email)


@router.post("/approve-admin/{user_id}", response_model=UserResponse)
def approve_admin(
    user_id: UUID,
    data: AdminApproveRequest,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """
    Approve a pending admin account. Only existing admins can do this.
    The approving admin must re-enter their password for verification.
    """
    return service.approve_admin(user_id, admin, data.password, db)


# ──────────────────────────────────────────────
# Protected Endpoints (require login)
# ──────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get the current user's profile."""
    return current_user


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password."""
    service.change_password(current_user, data.old_password, data.new_password, db)
    return MessageResponse(message="Password changed successfully")


@router.put("/me", response_model=UserResponse)
def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's profile (name, club)."""
    return service.update_user_profile(current_user, data, db)


@router.post("/me/profile-image", response_model=UserResponse)
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload or replace the current user's profile image."""
    validate_image(file)
    contents = await file.read()
    image_url = upload_to_supabase(
        file_bytes=contents,
        filename=file.filename or "profile.png",
        folder="profiles",
        content_type=file.content_type or "image/png",
    )
    return service.update_profile_image(current_user, image_url, db)
