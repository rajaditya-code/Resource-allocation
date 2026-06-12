"""
Booking routes — API endpoints for the booking system.

Covers the full booking lifecycle: request → approve/reject → issue → return.
Plus booking history, overdue detection, return photos, and reliability scores.
"""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.auth.models import User
from app.auth.permissions import require_role
from app.bookings import service
from app.bookings.schemas import (
    BookingCreate, BookingApprove, BookingReject,
    BookingIssue, BookingReturn,
    BookingResponse, BookingListResponse,
    AssignmentHistoryResponse, ReturnPhotoResponse,
    ReliabilityScoreResponse,
)
from app.utils.supabase_client import upload_file as upload_to_supabase

router = APIRouter(prefix="/api/v1/bookings", tags=["Bookings"])


# ──────────────────────────────────────────────
# Create & List Bookings
# ──────────────────────────────────────────────

@router.post("/", response_model=BookingResponse, status_code=201)
def create_booking(
    data: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Request a booking for an asset model.
    The conflict engine validates availability before accepting.
    """
    return service.create_booking(data, current_user, db)


@router.get("/", response_model=BookingListResponse)
def list_bookings(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List bookings. Users see only their own; admins see all.
    Can filter by status.
    """
    return service.list_bookings(db, user=current_user, status_filter=status, page=page, page_size=page_size)


@router.get("/my", response_model=List[BookingResponse])
def my_bookings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's full booking history."""
    return service.get_user_bookings(current_user.id, db)


@router.get("/pending", response_model=List[BookingResponse])
def pending_bookings(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """List all pending bookings awaiting admin review."""
    return service.get_pending_bookings(db)


@router.get("/overdue", response_model=List[BookingResponse])
def overdue_bookings(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Detect and list overdue bookings (issued but past end_date)."""
    return service.get_overdue_bookings(db)


@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get detailed info about a specific booking."""
    booking = service.get_booking(booking_id, db)
    # Users can only see their own bookings
    if current_user.role != "admin" and booking.user_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")
    return booking


# ──────────────────────────────────────────────
# Approval Workflow
# ──────────────────────────────────────────────

@router.put("/{booking_id}/approve", response_model=BookingResponse)
def approve_booking(
    booking_id: UUID,
    data: BookingApprove,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Approve a pending booking. Admin only."""
    return service.approve_booking(booking_id, admin, data.approval_notes, db)


@router.put("/{booking_id}/reject", response_model=BookingResponse)
def reject_booking(
    booking_id: UUID,
    data: BookingReject,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Reject a pending booking with a reason. Admin only."""
    return service.reject_booking(booking_id, admin, data.approval_notes, db)


@router.put("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel your own pending booking."""
    return service.cancel_booking(booking_id, current_user, db)


# ──────────────────────────────────────────────
# Issuance & Return
# ──────────────────────────────────────────────

@router.put("/{booking_id}/issue", response_model=BookingResponse)
def issue_booking(
    booking_id: UUID,
    data: BookingIssue,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """
    Issue specific units for an approved booking.
    Admin selects which physical units to hand out.
    """
    return service.issue_booking(booking_id, data, admin, db)


@router.put("/{booking_id}/return", response_model=BookingResponse)
def return_booking(
    booking_id: UUID,
    data: BookingReturn,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """
    Process the return of all units in a booking.
    Records condition after return for each unit.
    """
    return service.return_booking(booking_id, data, admin, db)


@router.post("/{booking_id}/return-photos", response_model=List[ReturnPhotoResponse])
async def upload_return_photos(
    booking_id: UUID,
    files: List[UploadFile] = File(...),
    asset_unit_id: Optional[UUID] = Form(None),
    caption: Optional[str] = Form(None),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Upload return photos as evidence (for damage disputes). Admin only."""
    photos = []
    for file in files:
        contents = await file.read()
        image_url = upload_to_supabase(
            file_bytes=contents,
            filename=file.filename or "return.png",
            folder=f"returns/{booking_id}",
            content_type=file.content_type or "image/png",
        )
        photos.append({
            "image_url": image_url,
            "asset_unit_id": asset_unit_id,
            "caption": caption,
        })

    return service.add_return_photos(booking_id, photos, db)


# ──────────────────────────────────────────────
# Assignment History & Reliability
# ──────────────────────────────────────────────

@router.get("/units/{unit_id}/history", response_model=List[AssignmentHistoryResponse])
def unit_assignment_history(
    unit_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the full borrowing history for a specific unit."""
    return service.get_unit_assignment_history(unit_id, db)


@router.get("/users/{user_id}/reliability", response_model=ReliabilityScoreResponse)
def get_reliability(
    user_id: UUID,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Get a user's reliability score breakdown. Admin only."""
    return service.get_reliability_score(user_id, db)
