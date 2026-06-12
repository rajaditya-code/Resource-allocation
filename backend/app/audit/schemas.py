"""
Audit schemas — response models for audit logs and activity feed.
"""

from datetime import datetime
from typing import Optional, List, Any
from uuid import UUID

from pydantic import Field
from app.schemas_base import BaseModel


class AuditLogResponse(BaseModel):
    """Response for a single audit log entry."""
    id: UUID
    user_id: Optional[UUID] = None
    action: str
    entity_type: str
    entity_id: Optional[UUID] = None
    metadata_: Optional[dict] = Field(None, alias="metadata_")
    timestamp: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class AuditLogListResponse(BaseModel):
    """Paginated list of audit logs."""
    items: List[AuditLogResponse]
    total: int
    page: int
    page_size: int


class ActivityFeedItem(BaseModel):
    """Human-readable activity feed entry powered by audit logs."""
    id: UUID
    description: str
    action: str
    entity_type: str
    actor_name: Optional[str] = None
    timestamp: datetime


class ActivityFeedResponse(BaseModel):
    """Recent system activity feed."""
    items: List[ActivityFeedItem]


class AdminApprovalAuditLogResponse(BaseModel):
    """Specific response for admin approval audit logs."""
    id: UUID
    approved_admin_id: UUID
    approving_admin_id: UUID
    action: str
    timestamp: datetime
    
    # We will populate these fields in the service layer using the relationships
    approved_admin_name: str
    approved_admin_email: str
    approving_admin_name: str
    approving_admin_email: str

    model_config = {"from_attributes": True}
