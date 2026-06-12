"""
Queue routes — join, leave, and view waitlists.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.auth.models import User
from app.queue import service
from app.queue.schemas import QueueJoinRequest, QueueResponse, QueueListResponse

router = APIRouter(prefix="/api/v1/queue", tags=["Queue"])


@router.post("/join", response_model=QueueResponse)
def join_queue(
    data: QueueJoinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Join the queue for an asset.
    Requires reliability score >= 50.
    """
    return service.join_queue(data.asset_model_id, current_user, db)


@router.post("/leave/{queue_id}")
def leave_queue(
    queue_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Leave the queue or give up your reserved spot."""
    return service.leave_queue(queue_id, current_user, db)


@router.get("/my", response_model=List[QueueResponse])
def get_my_queue(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """View all waitlists you are currently in."""
    return service.get_my_queue_entries(current_user.id, db)


@router.get("/{model_id}", response_model=QueueListResponse)
def get_queue(
    model_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """View the active waitlist for a specific asset model."""
    return service.get_queue(model_id, db)
