"""
Booking service — the heart of the asset management system.

Handles the reservation conflict engine, approval workflow,
asset issuance with unit selection, return processing with condition tracking,
overdue detection, and user reliability scoring.

Audit logs and notifications are created automatically — no manual calls needed.
"""

import math
from datetime import datetime, date, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session

from app.bookings.models import (
    Booking, BookingUnitAssignment, ReturnPhoto, AssetAssignmentHistory,
)
from app.bookings.schemas import (
    BookingCreate, BookingIssue, BookingReturn,
    UnitReturn, ReliabilityScoreResponse,
)
from app.assets.models import AssetModel, AssetUnit
from app.auth.models import User


from app.utils.time import get_ist_now




# ──────────────────────────────────────────────
# Internal Helpers (Audit + Notifications)
# ──────────────────────────────────────────────

def _log_action(db: Session, user_id, action: str, entity_type: str, entity_id=None, metadata: dict = None):
    """Create an audit log entry."""
    from app.audit.models import AuditLog
    log = AuditLog(user_id=user_id, action=action, entity_type=entity_type, entity_id=entity_id, metadata_=metadata)
    db.add(log)
    db.flush()


def _notify(db: Session, user_id, title: str, message: str, notif_type: str):
    """Create an in-app notification and try to send email."""
    from app.notifications.models import Notification
    notif = Notification(user_id=user_id, title=title, message=message, type=notif_type)
    db.add(notif)
    db.flush()
    # Email is best-effort
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            from app.utils.email import send_notification_email
            send_notification_email(user.email, title, message)
    except Exception:
        pass


def _update_reliability(db: Session, user_id: UUID, old_score: float, new_score: float, reason: str, details: str = None, admin_id=None):
    """Update a user's reliability score and log the change."""
    from app.reliability.models import ReliabilityHistory
    new_score = max(0.0, min(100.0, new_score))
    history = ReliabilityHistory(
        user_id=user_id, old_score=old_score, new_score=new_score,
        reason=reason, details=details, admin_id=admin_id,
    )
    db.add(history)
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.reliability_score = new_score
    db.flush()


# ──────────────────────────────────────────────
# Reservation Conflict Engine
# ──────────────────────────────────────────────

def check_availability(
    asset_model_id: UUID,
    requested_qty: int,
    start_date: date,
    end_date: date,
    db: Session,
    exclude_booking_id: Optional[UUID] = None,
) -> bool:
    """
    Check if the requested quantity is available for the given date range.

    The conflict engine finds all overlapping active bookings and checks
    that the total reserved quantity never exceeds available units on any day.
    """
    total_units = db.query(AssetUnit).filter(
        AssetUnit.asset_model_id == asset_model_id,
        AssetUnit.status != "Retired",
    ).count()

    # Subtract units that are currently reserved for users in the queue
    from app.queue.models import AssetQueue
    reserved_queue_spots = db.query(AssetQueue).filter(
        AssetQueue.asset_model_id == asset_model_id,
        AssetQueue.status == "Reserved"
    ).count()
    
    available_units = total_units - reserved_queue_spots

    if requested_qty > available_units:
        return False

    # Find all overlapping bookings that are still active
    overlap_query = db.query(Booking).filter(
        Booking.asset_model_id == asset_model_id,
        Booking.status.in_(["Pending", "Approved", "Issued"]),
        Booking.start_date < end_date,
        Booking.end_date > start_date,
    )

    if exclude_booking_id:
        overlap_query = overlap_query.filter(Booking.booking_id != exclude_booking_id)

    overlapping = overlap_query.all()

    # Day-by-day check to catch edge cases
    current_day = start_date
    while current_day < end_date:
        reserved_on_day = 0
        for booking in overlapping:
            if booking.start_date <= current_day < booking.end_date:
                reserved_on_day += booking.quantity

        if reserved_on_day + requested_qty > available_units:
            return False

        current_day += timedelta(days=1)

    return True


# ──────────────────────────────────────────────
# Create Booking
# ──────────────────────────────────────────────

def create_booking(data: BookingCreate, user: User, db: Session) -> Booking:
    """
    Create a new booking request.
    Validates dates and checks inventory availability via the conflict engine.
    """
    if data.start_date >= data.end_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    if data.start_date < get_ist_now().date():
        raise HTTPException(status_code=400, detail="Start date cannot be in the past")

    model = db.query(AssetModel).filter(AssetModel.id == data.asset_model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Asset model not found")

    if model.status != "Available":
        raise HTTPException(status_code=400, detail="This asset model is not currently available")

    if not check_availability(data.asset_model_id, data.quantity, data.start_date, data.end_date, db):
        raise HTTPException(
            status_code=409,
            detail="Insufficient inventory for the requested dates. "
                   "The requested quantity conflicts with existing bookings.",
        )

    # If the user requested a specific unit, validate it
    if data.asset_unit_id:
        unit = db.query(AssetUnit).filter(AssetUnit.id == data.asset_unit_id).first()
        if not unit:
            raise HTTPException(status_code=404, detail="Requested unit not found")
        if unit.asset_model_id != data.asset_model_id:
            raise HTTPException(status_code=400, detail="Requested unit does not belong to the selected asset model")
        if unit.status != "Available":
            raise HTTPException(status_code=400, detail="Requested unit is not currently available")

    booking = Booking(
        user_id=user.id,
        asset_model_id=data.asset_model_id,
        preferred_unit_id=data.asset_unit_id,
        quantity=data.quantity,
        purpose=data.purpose,
        start_date=data.start_date,
        end_date=data.end_date,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    _log_action(db, user.id, "BOOKING_CREATED", "booking", booking.booking_id, {
        "asset_name": model.name, "quantity": data.quantity, "purpose": data.purpose,
    })
    db.commit()

    return booking


# ──────────────────────────────────────────────
# Booking Retrieval
# ──────────────────────────────────────────────

def get_booking(booking_id: UUID, db: Session) -> Booking:
    """Fetch a single booking by ID."""
    booking = db.query(Booking).filter(Booking.booking_id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


def list_bookings(
    db: Session,
    user: Optional[User] = None,
    status_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """
    List bookings with optional filtering.
    Regular users only see their own; admins see everything.
    """
    query = db.query(Booking)

    if user and user.role != "admin":
        query = query.filter(Booking.user_id == user.id)

    if status_filter:
        query = query.filter(Booking.status == status_filter)

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(Booking.created_at.desc()).offset(offset).limit(page_size).all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_user_bookings(user_id: UUID, db: Session) -> List[Booking]:
    """Get all bookings for a specific user."""
    return db.query(Booking).filter(
        Booking.user_id == user_id,
    ).order_by(Booking.created_at.desc()).all()


def get_pending_bookings(db: Session) -> List[Booking]:
    """Get all pending bookings for admin review."""
    return db.query(Booking).filter(Booking.status == "Pending").order_by(Booking.created_at.asc()).all()


def get_overdue_bookings(db: Session) -> List[Booking]:
    """
    Find all bookings that are overdue (issued but past end_date).
    Marks them as overdue and sends notifications.
    """
    overdue = db.query(Booking).filter(
        Booking.status == "Issued",
        Booking.end_date < get_ist_now().date(),
    ).all()

    for booking in overdue:
        booking.status = "Overdue"

        # Get the asset name for a useful notification
        model = db.query(AssetModel).filter(AssetModel.id == booking.asset_model_id).first()
        asset_name = model.name if model else "Unknown Asset"

        _notify(db, booking.user_id, "Asset Overdue",
                f"Your booking for {asset_name} is OVERDUE. Please return it right away.",
                "asset_overdue")

        _log_action(db, None, "BOOKING_OVERDUE", "booking", booking.booking_id, {"asset_name": asset_name})

    if overdue:
        db.commit()

    return overdue


# ──────────────────────────────────────────────
# Approval Workflow
# ──────────────────────────────────────────────

def approve_booking(booking_id: UUID, admin: User, notes: Optional[str], db: Session) -> Booking:
    """Admin approves a pending booking."""
    booking = get_booking(booking_id, db)

    if booking.status != "Pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve a {booking.status} booking")

    # Re-check availability at approval time
    if not check_availability(
        booking.asset_model_id, booking.quantity,
        booking.start_date, booking.end_date, db,
        exclude_booking_id=booking.booking_id,
    ):
        raise HTTPException(status_code=409, detail="Inventory is no longer available for this booking")

    booking.status = "Approved"
    booking.approval_notes = notes
    booking.approved_by = admin.id

    model = db.query(AssetModel).filter(AssetModel.id == booking.asset_model_id).first()
    asset_name = model.name if model else "Unknown Asset"

    _log_action(db, admin.id, "BOOKING_APPROVED", "booking", booking.booking_id, {"asset_name": asset_name})
    _notify(db, booking.user_id, "Booking Approved",
            f"Your booking for {asset_name} has been approved. Wait for issuance.",
            "booking_approved")

    db.commit()
    db.refresh(booking)
    return booking


def reject_booking(booking_id: UUID, admin: User, notes: str, db: Session) -> Booking:
    """Admin rejects a pending booking with a reason."""
    booking = get_booking(booking_id, db)

    if booking.status != "Pending":
        raise HTTPException(status_code=400, detail=f"Cannot reject a {booking.status} booking")

    booking.status = "Rejected"
    booking.approval_notes = notes
    booking.approved_by = admin.id

    model = db.query(AssetModel).filter(AssetModel.id == booking.asset_model_id).first()
    asset_name = model.name if model else "Unknown Asset"

    _log_action(db, admin.id, "BOOKING_REJECTED", "booking", booking.booking_id, {
        "asset_name": asset_name, "reason": notes,
    })
    _notify(db, booking.user_id, "Booking Rejected",
            f"Your booking for {asset_name} was rejected. Reason: {notes}",
            "booking_rejected")

    db.commit()
    db.refresh(booking)
    return booking


def cancel_booking(booking_id: UUID, user: User, db: Session) -> Booking:
    """User cancels their own pending booking."""
    booking = get_booking(booking_id, db)

    if booking.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only cancel your own bookings")

    if booking.status != "Pending":
        raise HTTPException(status_code=400, detail="Only pending bookings can be cancelled")

    booking.status = "Cancelled"

    _log_action(db, user.id, "BOOKING_CANCELLED", "booking", booking.booking_id)

    db.commit()
    db.refresh(booking)
    return booking


# ──────────────────────────────────────────────
# Asset Issuance
# ──────────────────────────────────────────────

def issue_booking(booking_id: UUID, issue_data: BookingIssue, admin: User, db: Session) -> Booking:
    """
    Issue specific units for an approved booking.
    Admin picks actual physical units to hand to the user.
    """
    booking = get_booking(booking_id, db)

    if booking.status != "Approved":
        raise HTTPException(status_code=400, detail=f"Cannot issue a {booking.status} booking")

    if len(issue_data.unit_assignments) != booking.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Must assign exactly {booking.quantity} units, got {len(issue_data.unit_assignments)}",
        )

    unit_codes = []
    for assignment in issue_data.unit_assignments:
        unit = db.query(AssetUnit).filter(AssetUnit.id == assignment.asset_unit_id).first()
        if not unit:
            raise HTTPException(status_code=404, detail=f"Unit {assignment.asset_unit_id} not found")

        if unit.asset_model_id != booking.asset_model_id:
            raise HTTPException(
                status_code=400,
                detail=f"Unit {unit.unit_code} does not belong to the booked asset model",
            )

        if unit.status != "Available":
            raise HTTPException(
                status_code=400,
                detail=f"Unit {unit.unit_code} is not available (current status: {unit.status})",
            )

        unit_assignment = BookingUnitAssignment(
            booking_id=booking.booking_id,
            asset_unit_id=unit.id,
            condition_before=unit.condition,
        )
        db.add(unit_assignment)

        history = AssetAssignmentHistory(
            asset_unit_id=unit.id,
            user_id=booking.user_id,
            booking_id=booking.booking_id,
            condition_before=unit.condition,
            issued_at=get_ist_now(),
        )
        db.add(history)

        unit.status = "Issued"
        unit_codes.append(unit.unit_code)

    booking.status = "Issued"
    booking.issued_at = get_ist_now()

    model = db.query(AssetModel).filter(AssetModel.id == booking.asset_model_id).first()
    asset_name = model.name if model else "Unknown Asset"

    _log_action(db, admin.id, "ASSET_ISSUED", "booking", booking.booking_id, {
        "asset_name": asset_name, "units": unit_codes,
    })
    _notify(db, booking.user_id, "Assets Issued",
            f"You've been issued {asset_name} units: {', '.join(unit_codes)}. Please collect them.",
            "asset_issued")

    db.commit()
    db.refresh(booking)
    return booking


# ──────────────────────────────────────────────
# Asset Return
# ──────────────────────────────────────────────

def return_booking(booking_id: UUID, return_data: BookingReturn, admin: User, db: Session) -> Booking:
    """
    Process the return of all units in a booking.
    Records condition for each unit, updates reliability score.
    """
    booking = get_booking(booking_id, db)

    if booking.status not in ("Issued", "Overdue"):
        raise HTTPException(status_code=400, detail=f"Cannot return a {booking.status} booking")

    for unit_return in return_data.unit_returns:
        assignment = db.query(BookingUnitAssignment).filter(
            BookingUnitAssignment.booking_id == booking.booking_id,
            BookingUnitAssignment.asset_unit_id == unit_return.asset_unit_id,
        ).first()

        if not assignment:
            raise HTTPException(
                status_code=404,
                detail=f"Unit {unit_return.asset_unit_id} was not assigned to this booking",
            )

        assignment.condition_after = unit_return.condition_after
        assignment.return_remarks = unit_return.return_remarks
        assignment.returned_at = get_ist_now()

        unit = db.query(AssetUnit).filter(AssetUnit.id == unit_return.asset_unit_id).first()
        unit.condition = unit_return.condition_after
        unit.status = "Available"

        history = db.query(AssetAssignmentHistory).filter(
            AssetAssignmentHistory.booking_id == booking.booking_id,
            AssetAssignmentHistory.asset_unit_id == unit_return.asset_unit_id,
        ).first()

        if history:
            history.condition_after = unit_return.condition_after
            history.returned_at = get_ist_now()
            history.remarks = unit_return.return_remarks

    booking.status = "Returned"
    booking.returned_at = get_ist_now()

    # Update reliability score
    _process_return_reliability(booking, db)

    _log_action(db, admin.id, "ASSET_RETURNED", "booking", booking.booking_id)

    db.commit()
    db.refresh(booking)

    # Check if anyone is waiting in the queue for this asset
    _trigger_queue_on_return(booking.asset_model_id, db)

    return booking


def _process_return_reliability(booking: Booking, db: Session):
    """Calculate and apply reliability score changes after a return."""
    user = db.query(User).filter(User.id == booking.user_id).first()
    if not user:
        return

    old_score = user.reliability_score

    # Check if late — -1 point per extra day
    was_late = False
    if booking.returned_at and booking.end_date:
        returned_date = booking.returned_at.date() if hasattr(booking.returned_at, 'date') else booking.returned_at
        days_late = (returned_date - booking.end_date).days
        if days_late > 0:
            was_late = True
            penalty = days_late * 1.0
            new_score = max(0.0, old_score - penalty)
            _update_reliability(db, user.id, old_score, new_score, "LATE_RETURN",
                                f"Returned {days_late} days late")
            old_score = new_score

    # Check for damage
    has_damage = False
    for assignment in booking.unit_assignments:
        if assignment.condition_after in ("Poor", "Damaged"):
            has_damage = True
            break

    if has_damage:
        new_score = max(0.0, old_score - 5.0)
        _update_reliability(db, user.id, old_score, new_score, "DAMAGE",
                            "Returned with damage")
    elif not was_late:
        # On-time return in good condition — small bonus
        new_score = min(100.0, old_score + 1.0)
        _update_reliability(db, user.id, old_score, new_score, "ON_TIME_RETURN",
                            "On-time return in good condition")


def _trigger_queue_on_return(asset_model_id: UUID, db: Session):
    """When an asset is returned, check if anyone in the queue should be notified."""
    try:
        from app.queue.service import process_queue_for_asset
        process_queue_for_asset(asset_model_id, db)
    except ImportError:
        pass


def add_return_photos(
    booking_id: UUID,
    photos: List[dict],
    db: Session,
) -> List[ReturnPhoto]:
    """Add return photos to a booking (evidence for damage disputes)."""
    booking = get_booking(booking_id, db)
    created = []

    for photo_data in photos:
        photo = ReturnPhoto(
            booking_id=booking.booking_id,
            asset_unit_id=photo_data.get("asset_unit_id"),
            image_url=photo_data["image_url"],
            caption=photo_data.get("caption"),
        )
        db.add(photo)
        created.append(photo)

    db.commit()
    for p in created:
        db.refresh(p)

    return created


# ──────────────────────────────────────────────
# Assignment History
# ──────────────────────────────────────────────

def get_unit_assignment_history(unit_id: UUID, db: Session) -> List[AssetAssignmentHistory]:
    """Get the full borrowing history for a specific unit."""
    return db.query(AssetAssignmentHistory).filter(
        AssetAssignmentHistory.asset_unit_id == unit_id,
    ).order_by(AssetAssignmentHistory.issued_at.desc()).all()


# ──────────────────────────────────────────────
# User Reliability Score
# ──────────────────────────────────────────────

def get_reliability_score(user_id: UUID, db: Session) -> ReliabilityScoreResponse:
    """Get a detailed breakdown of a user's reliability score."""
    bookings = db.query(Booking).filter(Booking.user_id == user_id).all()

    on_time = 0
    late = 0
    damaged = 0
    cancelled = 0

    for booking in bookings:
        if booking.status == "Returned":
            if booking.returned_at and booking.returned_at.date() <= booking.end_date:
                on_time += 1
            else:
                late += 1
            for assignment in booking.unit_assignments:
                if assignment.condition_after in ("Poor", "Damaged"):
                    damaged += 1
                    break
        elif booking.status == "Cancelled":
            cancelled += 1
        elif booking.status == "Overdue":
            late += 1

    user = db.query(User).filter(User.id == user_id).first()

    return ReliabilityScoreResponse(
        user_id=user_id,
        score=user.reliability_score if user else 100.0,
        total_bookings=len(bookings),
        on_time_returns=on_time,
        late_returns=late,
        damaged_returns=damaged,
        cancelled_bookings=cancelled,
    )
