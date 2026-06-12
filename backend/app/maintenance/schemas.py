"""
Maintenance schemas — request/response models for maintenance and health tracking.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import Field
from app.schemas_base import BaseModel


# ──────────────────────────────────────────────
# Maintenance Request
# ──────────────────────────────────────────────

class MaintenanceCreate(BaseModel):
    """Create a new maintenance request for a unit."""
    asset_unit_id: UUID
    issue: str = Field(..., min_length=5)
    priority: str = Field("Medium", pattern="^(Low|Medium|High|Critical)$")


class MaintenanceUpdate(BaseModel):
    """Admin updates a maintenance request."""
    status: Optional[str] = Field(None, pattern="^(Open|In Progress|Resolved|Closed)$")
    priority: Optional[str] = Field(None, pattern="^(Low|Medium|High|Critical)$")
    assigned_to: Optional[UUID] = None


class MaintenanceResponse(BaseModel):
    """Response for a maintenance request."""
    id: UUID
    asset_unit_id: UUID
    issue: str
    priority: str
    status: str
    reported_by: UUID
    assigned_to: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceListResponse(BaseModel):
    """List of maintenance requests."""
    items: List[MaintenanceResponse]
    total: int


# ──────────────────────────────────────────────
# Asset Health Log
# ──────────────────────────────────────────────

class HealthLogResponse(BaseModel):
    """Response for a health log entry."""
    id: UUID
    asset_unit_id: UUID
    previous_condition: Optional[str] = None
    current_condition: str
    remarks: Optional[str] = None
    updated_by: UUID
    timestamp: datetime

    model_config = {"from_attributes": True}
