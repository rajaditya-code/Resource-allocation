"""
Booking schemas — request/response models for the booking system.

Covers booking creation, approval, issuance with unit selection,
return with condition assessment, and assignment history.
"""

from datetime import datetime, date
from typing import Optional, List
from uuid import UUID

from pydantic import Field
from app.schemas_base import BaseModel


# ──────────────────────────────────────────────
# Booking CRUD
# ──────────────────────────────────────────────

class BookingCreate(BaseModel):
    """User creates a booking request for a quantity of an asset model."""
    asset_model_id: UUID
    asset_unit_id: Optional[UUID] = None
    quantity: int = Field(..., ge=1)
    purpose: str = Field(..., min_length=1, max_length=255, description="e.g. Event, Workshop, Competition, Documentation, Research")
    start_date: date
    end_date: date


class BookingApprove(BaseModel):
    """Admin approves a booking, optionally with notes."""
    approval_notes: Optional[str] = None


class BookingReject(BaseModel):
    """Admin rejects a booking with a reason."""
    approval_notes: str = Field(..., min_length=1)


# ──────────────────────────────────────────────
# Issuance — Admin picks specific units to assign
# ──────────────────────────────────────────────

class UnitAssignment(BaseModel):
    """One unit being assigned during issuance."""
    asset_unit_id: UUID


class BookingIssue(BaseModel):
    """Admin issues specific units for an approved booking."""
    unit_assignments: List[UnitAssignment]


# ──────────────────────────────────────────────
# Return — Admin processes return with per-unit condition
# ──────────────────────────────────────────────

class UnitReturn(BaseModel):
    """Condition assessment for one returned unit."""
    asset_unit_id: UUID
    condition_after: str = Field(..., pattern="^(Excellent|Good|Fair|Poor|Damaged)$")
    return_remarks: Optional[str] = None


class BookingReturn(BaseModel):
    """Admin processes the return of all units in a booking."""
    unit_returns: List[UnitReturn]


# ──────────────────────────────────────────────
# Response Models
# ──────────────────────────────────────────────

class UnitAssignmentResponse(BaseModel):
    """Response for a unit assignment within a booking."""
    id: UUID
    booking_id: UUID
    asset_unit_id: UUID
    condition_before: Optional[str] = None
    condition_after: Optional[str] = None
    return_remarks: Optional[str] = None
    assigned_at: datetime
    returned_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ReturnPhotoResponse(BaseModel):
    """Response for a return photo."""
    id: UUID
    booking_id: UUID
    asset_unit_id: Optional[UUID] = None
    image_url: str
    caption: Optional[str] = None
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class BookingResponse(BaseModel):
    """Full booking response with unit assignments and return photos."""
    booking_id: UUID
    user_id: UUID
    asset_model_id: UUID
    quantity: int
    purpose: str
    start_date: date
    end_date: date
    status: str
    approval_notes: Optional[str] = None
    approved_by: Optional[UUID] = None
    preferred_unit_id: Optional[UUID] = None
    issued_at: Optional[datetime] = None
    returned_at: Optional[datetime] = None
    created_at: datetime
    unit_assignments: List[UnitAssignmentResponse] = []
    return_photos: List[ReturnPhotoResponse] = []

    model_config = {"from_attributes": True}


class BookingListResponse(BaseModel):
    """Paginated list of bookings."""
    items: List[BookingResponse]
    total: int
    page: int
    page_size: int


# ──────────────────────────────────────────────
# Assignment History
# ──────────────────────────────────────────────

class AssignmentHistoryResponse(BaseModel):
    """Historical record of a unit being borrowed."""
    id: UUID
    asset_unit_id: UUID
    user_id: UUID
    booking_id: UUID
    condition_before: Optional[str] = None
    condition_after: Optional[str] = None
    issued_at: datetime
    returned_at: Optional[datetime] = None
    remarks: Optional[str] = None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# User Reliability
# ──────────────────────────────────────────────

class ReliabilityScoreResponse(BaseModel):
    """User's reliability score with breakdown."""
    user_id: UUID
    score: float
    total_bookings: int
    on_time_returns: int
    late_returns: int
    damaged_returns: int
    cancelled_bookings: int
