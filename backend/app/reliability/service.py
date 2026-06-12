"""
Reliability service — tracks changes to user reliability scores.
"""

from typing import List
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.reliability.models import ReliabilityHistory
from app.auth.models import User


def _log_action(db: Session, user_id: UUID, action: str, entity_type: str, entity_id: UUID, metadata: dict = None):
    from app.audit.models import AuditLog
    log = AuditLog(user_id=user_id, action=action, entity_type=entity_type, entity_id=entity_id, metadata_=metadata)
    db.add(log)
    db.flush()


def change_score(user_id: UUID, new_score: float, reason: str, details: str, db: Session, admin_id: UUID = None):
    """Internal function to handle a score change. Usually called by other services."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return

    old_score = user.reliability_score
    new_score = max(0.0, min(100.0, new_score))

    history = ReliabilityHistory(
        user_id=user_id,
        old_score=old_score,
        new_score=new_score,
        reason=reason,
        details=details,
        admin_id=admin_id
    )
    db.add(history)
    
    user.reliability_score = new_score
    db.commit()


def get_history(user_id: UUID, db: Session) -> List[ReliabilityHistory]:
    """Get the full log of score changes for a user."""
    return db.query(ReliabilityHistory).filter(
        ReliabilityHistory.user_id == user_id
    ).order_by(ReliabilityHistory.timestamp.desc()).all()


def admin_adjust(user_id: UUID, new_score: float, details: str, admin: User, db: Session) -> ReliabilityHistory:
    """An admin manually overrides a user's score."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_score = user.reliability_score
    new_score = max(0.0, min(100.0, new_score))

    history = ReliabilityHistory(
        user_id=user_id,
        old_score=old_score,
        new_score=new_score,
        reason="ADMIN_ADJUSTMENT",
        details=details,
        admin_id=admin.id
    )
    db.add(history)

    user.reliability_score = new_score

    _log_action(db, admin.id, "RELIABILITY_ADJUSTED", "user", user.id, {
        "old_score": old_score,
        "new_score": new_score,
        "reason": details
    })

    db.commit()
    db.refresh(history)
    return history
