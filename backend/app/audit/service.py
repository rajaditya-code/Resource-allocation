"""
Audit service — logging and querying audit events.

The log_action() function is the single entry point — call it from any
module whenever a critical action occurs.

The activity feed transforms raw audit logs into human-readable descriptions
for the dashboard.
"""

from datetime import datetime
from typing import Optional, List, Any
from uuid import UUID

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.audit.models import AuditLog
from app.audit.schemas import ActivityFeedItem
from app.auth.models import User


def log_action(
    db: Session,
    user_id: Optional[UUID],
    action: str,
    entity_type: str,
    entity_id: Optional[UUID] = None,
    metadata: Optional[dict] = None,
) -> AuditLog:
    """
    Create an audit log entry.

    Call this from any service function when something important happens.
    Examples:
        log_action(db, admin.id, "asset_created", "asset_model", model.id, {"name": "Canon EOS 90D"})
        log_action(db, admin.id, "booking_approved", "booking", booking.booking_id)
        log_action(db, user.id, "booking_requested", "booking", booking.booking_id)
    """
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_=metadata,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_audit_logs(
    db: Session,
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    action: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Query audit logs with optional filtering and pagination."""
    query = db.query(AuditLog)

    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    if action:
        query = query.filter(AuditLog.action == action)

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(page_size).all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_entity_logs(entity_type: str, entity_id: UUID, db: Session) -> List[AuditLog]:
    """Get all audit logs for a specific entity."""
    return db.query(AuditLog).filter(
        AuditLog.entity_type == entity_type,
        AuditLog.entity_id == entity_id,
    ).order_by(desc(AuditLog.timestamp)).all()


def get_activity_feed(db: Session, limit: int = 20, user_id: Optional[UUID] = None) -> List[ActivityFeedItem]:
    """
    Get the recent activity feed — human-readable descriptions of system events.
    Powers the "Recent Activity" section on the dashboard.
    """
    query = db.query(AuditLog)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
        
    logs = query.order_by(desc(AuditLog.timestamp)).limit(limit).all()

    feed = []
    for log in logs:
        # Get the actor's name
        actor_name = None
        if log.user_id:
            user = db.query(User).filter(User.id == log.user_id).first()
            actor_name = user.full_name if user else "Unknown"

        # Build human-readable description
        description = _format_activity(log, actor_name)

        feed.append(ActivityFeedItem(
            id=log.id,
            description=description,
            action=log.action,
            entity_type=log.entity_type,
            actor_name=actor_name,
            timestamp=log.timestamp,
        ))

    return feed


def _format_activity(log: AuditLog, actor_name: Optional[str]) -> str:
    """Convert a raw audit log into a human-readable activity description."""
    actor = actor_name or "System"
    meta = log.metadata_ or {}

    # Map action types to readable descriptions
    descriptions = {
        "asset_created": f"{actor} created asset '{meta.get('name', 'N/A')}'",
        "asset_updated": f"{actor} updated asset '{meta.get('name', 'N/A')}'",
        "asset_deleted": f"{actor} deleted asset '{meta.get('name', 'N/A')}'",
        "units_added": f"{actor} added {meta.get('count', '?')} units to '{meta.get('name', 'N/A')}'",
        "booking_requested": f"{actor} requested booking for '{meta.get('asset_name', 'N/A')}'",
        "booking_approved": f"{actor} approved a booking for '{meta.get('asset_name', 'N/A')}'",
        "booking_rejected": f"{actor} rejected a booking for '{meta.get('asset_name', 'N/A')}'",
        "booking_cancelled": f"{actor} cancelled a booking",
        "asset_issued": f"{actor} issued assets for a booking",
        "asset_returned": f"{actor} processed asset return",
        "maintenance_created": f"{actor} reported a maintenance issue",
        "maintenance_updated": f"{actor} updated maintenance request",
        "image_uploaded": f"{actor} uploaded an asset image",
        "image_replaced": f"{actor} replaced an asset image",
        "image_deleted": f"{actor} deleted an asset image",
        "qr_generated": f"{actor} generated QR code for '{meta.get('unit_code', 'N/A')}'",
        "bulk_import": f"{actor} bulk imported {meta.get('count', '?')} assets",
        "user_registered": f"New user '{meta.get('name', 'N/A')}' registered",
        "ADMIN_PRIVILEGE_GRANTED": f"{actor} granted admin privileges to '{meta.get('approved_admin_name', 'N/A')}'",
    }

    return descriptions.get(log.action, f"{actor} performed {log.action} on {log.entity_type}")

def get_admin_approval_logs(db: Session):
    """
    Get all dedicated AdminApprovalAuditLog entries, properly hydrated 
    with user details via relationships.
    """
    from app.audit.models import AdminApprovalAuditLog
    from sqlalchemy.orm import joinedload
    
    logs = db.query(AdminApprovalAuditLog).options(
        joinedload(AdminApprovalAuditLog.approved_admin),
        joinedload(AdminApprovalAuditLog.approving_admin),
    ).order_by(desc(AdminApprovalAuditLog.timestamp)).all()
    
    results = []
    for log in logs:
        # Construct the response matching AdminApprovalAuditLogResponse schema
        results.append({
            "id": log.id,
            "approved_admin_id": log.approved_admin_id,
            "approving_admin_id": log.approving_admin_id,
            "action": log.action,
            "timestamp": log.timestamp,
            "approved_admin_name": log.approved_admin.full_name if log.approved_admin else "Unknown",
            "approved_admin_email": log.approved_admin.email if log.approved_admin else "Unknown",
            "approving_admin_name": log.approving_admin.full_name if log.approving_admin else "Unknown",
            "approving_admin_email": log.approving_admin.email if log.approving_admin else "Unknown",
        })
    return results
