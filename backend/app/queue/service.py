"""
Queue service — waitlist logic for unavailable assets.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.queue.models import AssetQueue
from app.auth.models import User
from app.assets.models import AssetModel, AssetUnit
from app.bookings.models import Booking


from app.utils.time import get_ist_now


def _log_action(db: Session, user_id: UUID, action: str, entity_type: str, entity_id: UUID, metadata: dict = None):
    from app.audit.models import AuditLog
    log = AuditLog(user_id=user_id, action=action, entity_type=entity_type, entity_id=entity_id, metadata_=metadata)
    db.add(log)
    db.flush()


def _notify(db: Session, user_id: UUID, title: str, message: str, notif_type: str):
    from app.notifications.models import Notification
    from app.utils.email import send_notification_email
    notif = Notification(user_id=user_id, title=title, message=message, type=notif_type)
    db.add(notif)
    db.flush()

    user = db.query(User).filter(User.id == user_id).first()
    if user:
        try:
            send_notification_email(user.email, title, message)
        except Exception:
            pass


def _update_reliability(db: Session, user_id: UUID, old_score: float, new_score: float, reason: str, details: str = None):
    from app.reliability.models import ReliabilityHistory
    new_score = max(0.0, min(100.0, new_score))
    history = ReliabilityHistory(
        user_id=user_id, old_score=old_score, new_score=new_score,
        reason=reason, details=details
    )
    db.add(history)
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.reliability_score = new_score
    db.flush()


def expire_reservations(db: Session):
    """
    Find any Reserved queue entries that have passed their 4-hour window
    without the user making a booking.
    Mark them as Expired, deduct 5 reliability points, and trigger the queue
    for the next person.
    """
    expired = db.query(AssetQueue).filter(
        AssetQueue.status == "Reserved",
        AssetQueue.expires_at < get_ist_now()
    ).all()

    for item in expired:
        item.status = "Expired"
        user = db.query(User).filter(User.id == item.user_id).first()
        if user:
            old_score = user.reliability_score
            new_score = old_score - 5.0
            _update_reliability(db, user.id, old_score, new_score, "QUEUE_TIMEOUT", "Failed to book asset within the 4-hour reservation window")

            _notify(db, user.id, "Queue Reservation Expired",
                    "Your 4-hour window to book the asset has expired. You have been removed from the queue and your reliability score has dropped.",
                    "queue_expired")

        db.commit()

        # Trigger the next person in line
        process_queue_for_asset(item.asset_model_id, db)


def join_queue(asset_model_id: UUID, user: User, db: Session) -> AssetQueue:
    """Join the waitlist for an asset."""
    # Run expiry check first to free up spots
    expire_reservations(db)

    # Check reliability score
    if user.reliability_score < 50:
        raise HTTPException(status_code=403, detail="Your reliability score must be at least 50 to join the queue")

    # Ensure asset exists
    model = db.query(AssetModel).filter(AssetModel.id == asset_model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Check if already in queue
    existing = db.query(AssetQueue).filter(
        AssetQueue.asset_model_id == asset_model_id,
        AssetQueue.user_id == user.id,
        AssetQueue.status.in_(["Waiting", "Reserved"])
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You are already in the queue for this asset")

    # Calculate position
    current_max = db.query(AssetQueue).filter(
        AssetQueue.asset_model_id == asset_model_id,
        AssetQueue.status == "Waiting"
    ).count()

    queue_item = AssetQueue(
        asset_model_id=asset_model_id,
        user_id=user.id,
        position=current_max + 1,
        status="Waiting"
    )
    db.add(queue_item)

    _log_action(db, user.id, "QUEUE_JOINED", "asset_queue", queue_item.id, {"asset_name": model.name})

    db.commit()
    db.refresh(queue_item)
    return queue_item


def leave_queue(queue_id: UUID, user: User, db: Session) -> dict:
    """User voluntarily leaves the queue or gives up their reservation."""
    item = db.query(AssetQueue).filter(AssetQueue.id == queue_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue entry not found")

    if item.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only manage your own queue entries")

    if item.status not in ["Waiting", "Reserved"]:
        raise HTTPException(status_code=400, detail=f"Cannot leave a queue that is {item.status}")

    was_reserved = item.status == "Reserved"
    item.status = "Completed" # Voluntarily left

    # Shift everyone else up
    later_items = db.query(AssetQueue).filter(
        AssetQueue.asset_model_id == item.asset_model_id,
        AssetQueue.status == "Waiting",
        AssetQueue.position > item.position
    ).all()

    for later in later_items:
        later.position -= 1

    db.commit()

    if was_reserved:
        # Pass the reservation to the next person
        process_queue_for_asset(item.asset_model_id, db)

    return {"message": "You have left the queue"}


def process_queue_for_asset(asset_model_id: UUID, db: Session):
    """
    Check if an asset has available inventory and if there is someone
    waiting in the queue. If so, give the first person in line a 4-hour reservation.
    Called when an asset is returned or a reservation expires.
    """
    total_units = db.query(AssetUnit).filter(
        AssetUnit.asset_model_id == asset_model_id,
        AssetUnit.status != "Retired"
    ).count()

    active_bookings_qty = 0
    bookings = db.query(Booking).filter(
        Booking.asset_model_id == asset_model_id,
        Booking.status.in_(["Pending", "Approved", "Issued"])
    ).all()
    for b in bookings:
        active_bookings_qty += b.quantity

    reserved_spots = db.query(AssetQueue).filter(
        AssetQueue.asset_model_id == asset_model_id,
        AssetQueue.status == "Reserved"
    ).count()

    available_capacity = total_units - active_bookings_qty - reserved_spots

    if available_capacity > 0:
        # Find next in line
        next_in_line = db.query(AssetQueue).filter(
            AssetQueue.asset_model_id == asset_model_id,
            AssetQueue.status == "Waiting"
        ).order_by(AssetQueue.position.asc()).first()

        if next_in_line:
            next_in_line.status = "Reserved"
            now = get_ist_now()
            next_in_line.reserved_at = now
            next_in_line.expires_at = now + timedelta(hours=4)

            model = db.query(AssetModel).filter(AssetModel.id == asset_model_id).first()
            asset_name = model.name if model else "Asset"

            _notify(db, next_in_line.user_id, "Asset Available - Action Required!",
                    f"{asset_name} is now available! You have 4 hours to make a booking. If you do not book within 4 hours, your reservation will expire and your reliability score will decrease by 5 points.",
                    "queue_turn")

            db.commit()


def get_queue(asset_model_id: UUID, db: Session) -> dict:
    """View the waitlist for a specific asset model."""
    expire_reservations(db)

    items = db.query(AssetQueue).filter(
        AssetQueue.asset_model_id == asset_model_id,
        AssetQueue.status.in_(["Waiting", "Reserved"])
    ).order_by(
        AssetQueue.status.desc(), # Reserved first
        AssetQueue.position.asc()
    ).all()

    waiting = sum(1 for x in items if x.status == "Waiting")
    reserved = sum(1 for x in items if x.status == "Reserved")

    return {
        "items": items,
        "total_waiting": waiting,
        "total_reserved": reserved
    }


def get_my_queue_entries(user_id: UUID, db: Session) -> List[AssetQueue]:
    """Get all active queue spots for a user."""
    expire_reservations(db)
    return db.query(AssetQueue).filter(
        AssetQueue.user_id == user_id,
        AssetQueue.status.in_(["Waiting", "Reserved"])
    ).all()
