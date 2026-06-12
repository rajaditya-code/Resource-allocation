"""
Reliability routes — view history and admin adjustments.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.auth.models import User
from app.auth.permissions import require_role
from app.reliability import service
from app.reliability.schemas import ReliabilityHistoryResponse, ReliabilityAdjustRequest
from app.bookings.schemas import ReliabilityScoreResponse
from app.bookings.service import get_reliability_score

router = APIRouter(prefix="/api/v1/reliability", tags=["Reliability"])


@router.get("/{user_id}", response_model=ReliabilityScoreResponse)
def get_score_breakdown(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a user's reliability score and a breakdown of their booking stats.
    Users can view their own; admins can view anyone's.
    """
    if current_user.role != "admin" and current_user.id != user_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not authorized to view other users' scores")
    return get_reliability_score(user_id, db)


@router.get("/{user_id}/history", response_model=List[ReliabilityHistoryResponse])
def get_score_history(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the full audit log of how a user's score reached its current value."""
    if current_user.role != "admin" and current_user.id != user_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not authorized to view other users' history")
    return service.get_history(user_id, db)


@router.put("/{user_id}/adjust", response_model=ReliabilityHistoryResponse)
def adjust_score(
    user_id: UUID,
    data: ReliabilityAdjustRequest,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Admin manually overrides a user's score with a reason."""
    return service.admin_adjust(user_id, data.new_score, data.reason, admin, db)
