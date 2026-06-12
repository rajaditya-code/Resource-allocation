"""
Maintenance routes — API endpoints for maintenance requests and health logs.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.auth.models import User
from app.auth.permissions import require_role
from app.maintenance import service
from app.maintenance.schemas import (
    MaintenanceCreate, MaintenanceUpdate,
    MaintenanceResponse, MaintenanceListResponse,
    HealthLogResponse,
)

router = APIRouter(prefix="/api/v1/maintenance", tags=["Maintenance"])


@router.post("/", response_model=MaintenanceResponse, status_code=201)
def create_request(
    data: MaintenanceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a maintenance request for a unit. Any authenticated user."""
    return service.create_maintenance_request(data, current_user, db)


@router.get("/", response_model=MaintenanceListResponse)
def list_requests(
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List maintenance requests. Users see own, admins see all."""
    return service.list_maintenance_requests(db, user=current_user, status_filter=status)


@router.get("/{request_id}", response_model=MaintenanceResponse)
def get_request(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific maintenance request."""
    return service.get_maintenance_request(request_id, db)


@router.put("/{request_id}", response_model=MaintenanceResponse)
def update_request(
    request_id: UUID,
    data: MaintenanceUpdate,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Update a maintenance request (status, priority, assignment). Admin only."""
    return service.update_maintenance_request(request_id, data, admin, db)


@router.get("/units/{unit_id}/health", response_model=list[HealthLogResponse])
def unit_health_log(
    unit_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the full health log for a specific asset unit."""
    return service.get_unit_health_logs(unit_id, db)
