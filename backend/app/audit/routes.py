"""
Audit routes — endpoints for viewing audit logs and the activity feed.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.auth.models import User
from app.auth.permissions import require_role, require_any_authenticated
from app.audit import service
from app.audit.schemas import (
    AuditLogResponse, AuditLogListResponse,
    ActivityFeedResponse, AdminApprovalAuditLogResponse
)

router = APIRouter(prefix="/api/v1/audit", tags=["Audit Logs"])


@router.get("/", response_model=AuditLogListResponse)
def list_audit_logs(
    entity_type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """List audit logs with optional filtering. Admin only."""
    return service.get_audit_logs(db, entity_type=entity_type, action=action, page=page, page_size=page_size)


@router.get("/entity/{entity_type}/{entity_id}", response_model=list[AuditLogResponse])
def entity_logs(
    entity_type: str,
    entity_id: UUID,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Get all audit logs for a specific entity. Admin only."""
    return service.get_entity_logs(entity_type, entity_id, db)


@router.get("/admin-approvals", response_model=list[AdminApprovalAuditLogResponse])
def get_admin_approval_logs(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """
    Get the dedicated audit logs for admin approvals. Admin only.
    """
    return service.get_admin_approval_logs(db)


@router.get("/activity-feed", response_model=ActivityFeedResponse)
def activity_feed(
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(require_any_authenticated()),
    db: Session = Depends(get_db),
):
    """
    Recent system activity feed — human-readable activity stream.
    Powered by audit logs. Available to all authenticated users.
    Filtered to show only the current user's activity.
    """
    items = service.get_activity_feed(db, limit=limit, user_id=current_user.id)
    return ActivityFeedResponse(items=items)
