"""
Reliability schemas — models for score history and adjustment.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import Field
from app.schemas_base import BaseModel


class ReliabilityAdjustRequest(BaseModel):
    """Admin manually adjusts a user's score."""
    new_score: float = Field(..., ge=0, le=100)
    reason: str = Field(..., min_length=1)


class ReliabilityHistoryResponse(BaseModel):
    """A single change in the user's score."""
    id: UUID
    user_id: UUID
    old_score: float
    new_score: float
    reason: str
    details: Optional[str] = None
    admin_id: Optional[UUID] = None
    timestamp: datetime

    model_config = {"from_attributes": True}
