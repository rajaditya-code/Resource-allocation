"""
Queue schemas — request/response models for the asset waitlist system.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import Field
from app.schemas_base import BaseModel


class QueueJoinRequest(BaseModel):
    """Payload to join an asset waitlist."""
    asset_model_id: UUID


class QueueResponse(BaseModel):
    """Details of a user's spot in the waitlist."""
    id: UUID
    asset_model_id: UUID
    user_id: UUID
    position: int
    status: str
    reserved_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class QueueListResponse(BaseModel):
    """A list of people in a waitlist, mostly for admins or general status."""
    items: List[QueueResponse]
    total_waiting: int
    total_reserved: int
