"""
Maintenance service — business logic for maintenance requests and health logs.

Audit logs and notifications fire automatically when maintenance
tickets are created, updated, or resolved.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.maintenance.models import MaintenanceRequest, AssetHealthLog
from app.maintenance.schemas import MaintenanceCreate, MaintenanceUpdate
from app.assets.models import AssetUnit
from app.auth.models import User


def _log_action(db: Session, user_id, action: str, entity_type: str, entity_id=None, metadata: dict = None):
    """Create an audit log entry."""
    from app.audit.models import AuditLog
    log = AuditLog(user_id=user_id, action=action, entity_type=entity_type, entity_id=entity_id, metadata_=metadata)
    db.add(log)
    db.flush()


def _notify(db: Session, user_id, title: str, message: str, notif_type: str):
    """Create an in-app notification."""
    from app.notifications.models import Notification
    notif = Notification(user_id=user_id, title=title, message=message, type=notif_type)
    db.add(notif)
    db.flush()


# ──────────────────────────────────────────────
# Maintenance Requests
# ──────────────────────────────────────────────

def create_maintenance_request(
    data: MaintenanceCreate,
    user: User,
    db: Session,
) -> MaintenanceRequest:
    """Create a new maintenance request for a specific asset unit."""
    unit = db.query(AssetUnit).filter(AssetUnit.id == data.asset_unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Asset unit not found")

    request = MaintenanceRequest(
        asset_unit_id=data.asset_unit_id,
        issue=data.issue,
        priority=data.priority,
        reported_by=user.id,
    )
    db.add(request)
    db.flush()

    _log_action(db, user.id, "MAINTENANCE_CREATED", "maintenance", request.id, {
        "unit_code": unit.unit_code, "issue": data.issue, "priority": data.priority,
    })

    db.commit()
    db.refresh(request)
    return request


def get_maintenance_request(request_id: UUID, db: Session) -> MaintenanceRequest:
    """Fetch a single maintenance request."""
    request = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Maintenance request not found")
    return request


def list_maintenance_requests(
    db: Session,
    user: Optional[User] = None,
    status_filter: Optional[str] = None,
) -> dict:
    """
    List maintenance requests.
    Regular users see only their own; admins see all.
    """
    query = db.query(MaintenanceRequest)

    if user and user.role != "admin":
        query = query.filter(MaintenanceRequest.reported_by == user.id)

    if status_filter:
        query = query.filter(MaintenanceRequest.status == status_filter)

    items = query.order_by(MaintenanceRequest.created_at.desc()).all()

    return {
        "items": items,
        "total": len(items),
    }


def update_maintenance_request(
    request_id: UUID,
    data: MaintenanceUpdate,
    admin: User,
    db: Session,
) -> MaintenanceRequest:
    """
    Admin updates a maintenance request (status, priority, assignment).
    When resolved, unit goes back to available and the reporter gets notified.
    """
    request = get_maintenance_request(request_id, db)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(request, field, value)

    # If resolving, mark the unit as available again and notify the reporter
    if data.status == "Resolved":
        unit = db.query(AssetUnit).filter(AssetUnit.id == request.asset_unit_id).first()
        if unit and unit.status == "Maintenance":
            unit.status = "Available"

        _log_action(db, admin.id, "MAINTENANCE_COMPLETED", "maintenance", request.id, {
            "unit_id": str(request.asset_unit_id),
        })

        _notify(db, request.reported_by, "Maintenance Completed",
                f"Maintenance request for your reported issue has been resolved.",
                "maintenance_completed")
    else:
        _log_action(db, admin.id, "MAINTENANCE_UPDATED", "maintenance", request.id, {
            "updated_fields": list(update_data.keys()),
        })

    db.commit()
    db.refresh(request)
    return request


# ──────────────────────────────────────────────
# Asset Health Logs
# ──────────────────────────────────────────────

def create_health_log(
    asset_unit_id: UUID,
    previous_condition: Optional[str],
    current_condition: str,
    remarks: Optional[str],
    updated_by: UUID,
    db: Session,
) -> AssetHealthLog:
    """Create a health log entry when a unit's condition changes."""
    log = AssetHealthLog(
        asset_unit_id=asset_unit_id,
        previous_condition=previous_condition,
        current_condition=current_condition,
        remarks=remarks,
        updated_by=updated_by,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_unit_health_logs(unit_id: UUID, db: Session) -> List[AssetHealthLog]:
    """Get the full health log history for a specific unit."""
    return db.query(AssetHealthLog).filter(
        AssetHealthLog.asset_unit_id == unit_id,
    ).order_by(AssetHealthLog.timestamp.desc()).all()
