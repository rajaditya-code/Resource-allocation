"""
Export service — generate downloadable CSV and PDF reports.

Supports exporting:
    - Inventory (asset models + unit counts)
    - Bookings
    - Audit logs
    - Maintenance requests
"""

import csv
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from sqlalchemy.orm import Session
from app.utils.time import get_ist_now, format_to_ist

from app.assets.models import AssetModel, AssetUnit
from app.bookings.models import Booking
from app.audit.models import AuditLog
from app.maintenance.models import MaintenanceRequest


# ──────────────────────────────────────────────
# CSV Exports
# ──────────────────────────────────────────────

def export_inventory_csv(db: Session) -> str:
    """Export all asset models and their unit counts to CSV."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Name", "Category", "Location", "Status",
        "Total Units", "Available Units", "Purchase Date",
    ])

    models = db.query(AssetModel).all()
    for model in models:
        total = db.query(AssetUnit).filter(
            AssetUnit.asset_model_id == model.id,
            AssetUnit.status != "Retired",
        ).count()
        available = db.query(AssetUnit).filter(
            AssetUnit.asset_model_id == model.id,
            AssetUnit.status == "Available",
        ).count()

        writer.writerow([
            model.name, model.category, model.location or "",
            model.status, total, available,
            model.purchase_date.isoformat() if model.purchase_date else "",
        ])

    return output.getvalue()


def export_bookings_csv(db: Session) -> str:
    """Export all bookings to CSV."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Booking ID", "User ID", "Asset Model ID",
        "Quantity", "Start Date", "End Date", "Status",
        "Approval Notes", "Created At",
    ])

    bookings = db.query(Booking).order_by(Booking.created_at.desc()).all()
    for b in bookings:
        writer.writerow([
            str(b.booking_id), str(b.user_id), str(b.asset_model_id),
            b.quantity, b.start_date.isoformat(), b.end_date.isoformat(),
            b.status, b.approval_notes or "",
            format_to_ist(b.created_at) if b.created_at else "",
        ])

    return output.getvalue()


def export_audit_logs_csv(db: Session) -> str:
    """Export audit logs to CSV."""
    from app.auth.models import User
    from app.utils.time import format_to_ist
    
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["ID", "Action", "Actor Name", "Actor Email", "Entity Type", "Entity ID", "Details", "Timestamp"])

    logs = db.query(AuditLog, User).outerjoin(User, AuditLog.user_id == User.id).order_by(AuditLog.timestamp.desc()).all()
    
    for log, user in logs:
        details = ""
        meta = log.metadata_ or {}
        if log.action == "asset_created":
            details = f"Asset Name: {meta.get('name', 'N/A')}"
        elif log.action == "units_added":
            details = f"Added {meta.get('count', '?')} units to '{meta.get('name', 'N/A')}'. Unit Codes: {', '.join(meta.get('unit_codes', []))}"
        else:
            details = str(meta) if meta else ""

        writer.writerow([
            str(log.id),
            log.action,
            user.full_name if user else "System",
            user.email if user else "",
            log.entity_type,
            str(log.entity_id) if log.entity_id else "",
            details,
            format_to_ist(log.timestamp) if log.timestamp else "",
        ])

    return output.getvalue()


def export_maintenance_csv(db: Session) -> str:
    """Export maintenance requests to CSV."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "ID", "Unit ID", "Issue", "Priority",
        "Status", "Reported By", "Assigned To", "Created At",
    ])

    requests = db.query(MaintenanceRequest).order_by(MaintenanceRequest.created_at.desc()).all()
    for r in requests:
        writer.writerow([
            str(r.id), str(r.asset_unit_id), r.issue,
            r.priority, r.status, str(r.reported_by),
            str(r.assigned_to) if r.assigned_to else "",
            format_to_ist(r.created_at) if r.created_at else "",
        ])

    return output.getvalue()


# ──────────────────────────────────────────────
# PDF Exports
# ──────────────────────────────────────────────

def _build_pdf(title: str, headers: list, rows: list) -> bytes:
    """Helper to build a PDF table from headers and rows."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    styles = getSampleStyleSheet()

    elements = []

    # Title
    elements.append(Paragraph(title, styles["Title"]))
    elements.append(Spacer(1, 0.25 * inch))
    elements.append(Paragraph(
        f"Generated: {get_ist_now().strftime('%Y-%m-%d %H:%M IST')}",
        styles["Normal"],
    ))
    elements.append(Spacer(1, 0.25 * inch))

    # Table
    table_data = [headers] + rows

    # Truncate cell contents to prevent overflow
    truncated_data = []
    for row in table_data:
        truncated_row = [str(cell)[:40] for cell in row]
        truncated_data.append(truncated_row)

    table = Table(truncated_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 7),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5f5")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    elements.append(table)
    doc.build(elements)
    return buffer.getvalue()


def export_inventory_pdf(db: Session) -> bytes:
    """Export inventory to a styled PDF report."""
    headers = ["Name", "Category", "Location", "Status", "Total Units", "Available"]

    models = db.query(AssetModel).all()
    rows = []
    for model in models:
        total = db.query(AssetUnit).filter(
            AssetUnit.asset_model_id == model.id,
            AssetUnit.status != "Retired",
        ).count()
        available = db.query(AssetUnit).filter(
            AssetUnit.asset_model_id == model.id,
            AssetUnit.status == "Available",
        ).count()
        rows.append([model.name, model.category, model.location or "-", model.status, total, available])

    return _build_pdf("Inventory Report", headers, rows)


def export_bookings_pdf(db: Session) -> bytes:
    """Export bookings to a styled PDF report."""
    headers = ["Booking ID", "Quantity", "Start", "End", "Status", "Notes"]

    bookings = db.query(Booking).order_by(Booking.created_at.desc()).limit(500).all()
    rows = []
    for b in bookings:
        rows.append([
            str(b.booking_id)[:8], b.quantity,
            b.start_date.isoformat(), b.end_date.isoformat(),
            b.status, b.approval_notes or "-",
        ])

    return _build_pdf("Bookings Report", headers, rows)


def export_audit_logs_pdf(db: Session) -> bytes:
    """Export audit logs to a styled PDF report."""
    from app.auth.models import User
    from app.utils.time import format_to_ist
    
    headers = ["Action", "Actor Name", "Actor Email", "Entity Type", "Entity ID", "Details", "Timestamp"]

    logs = db.query(AuditLog, User).outerjoin(User, AuditLog.user_id == User.id).order_by(AuditLog.timestamp.desc()).limit(500).all()
    rows = []
    
    for log, user in logs:
        details = ""
        meta = log.metadata_ or {}
        if log.action == "asset_created":
            details = f"Asset Name: {meta.get('name', 'N/A')}"
        elif log.action == "units_added":
            details = f"Added {meta.get('count', '?')} units to '{meta.get('name', 'N/A')}'"
        else:
            details = str(meta)[:30] + "..." if meta else ""
            
        rows.append([
            log.action,
            user.full_name[:20] if user else "System",
            user.email[:25] if user else "",
            log.entity_type,
            str(log.entity_id)[:8] if log.entity_id else "-",
            details[:30],
            format_to_ist(log.timestamp, "%Y-%m-%d %H:%M") if log.timestamp else "-",
        ])

    return _build_pdf("Audit Logs Report", headers, rows)


def export_maintenance_pdf(db: Session) -> bytes:
    """Export maintenance requests to a styled PDF report."""
    headers = ["Issue", "Priority", "Status", "Unit ID", "Created"]

    requests = db.query(MaintenanceRequest).order_by(MaintenanceRequest.created_at.desc()).limit(500).all()
    rows = []
    for r in requests:
        rows.append([
            r.issue[:30], r.priority, r.status,
            str(r.asset_unit_id)[:8],
            format_to_ist(r.created_at, "%Y-%m-%d") if r.created_at else "-",
        ])

    return _build_pdf("Maintenance Report", headers, rows)


# ──────────────────────────────────────────────
# New Export Functions (Phase 6)
# ──────────────────────────────────────────────

def export_reliability_csv(db: Session) -> str:
    """Export reliability history logs to CSV."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "ID", "User ID", "User Name", "Old Score", "New Score", 
        "Reason", "Details", "Admin ID", "Timestamp",
    ])

    from app.reliability.models import ReliabilityHistory
    from app.auth.models import User
    
    logs = db.query(ReliabilityHistory, User).join(
        User, ReliabilityHistory.user_id == User.id
    ).order_by(ReliabilityHistory.timestamp.desc()).all()
    
    for history, user in logs:
        writer.writerow([
            str(history.id), str(history.user_id), user.full_name,
            history.old_score, history.new_score,
            history.reason, history.details or "",
            str(history.admin_id) if history.admin_id else "",
            format_to_ist(history.timestamp) if history.timestamp else "",
        ])

    return output.getvalue()


def export_admin_approvals_csv(db: Session) -> str:
    """Export admin approval audit logs to CSV."""
    from app.audit.models import AdminApprovalAuditLog
    from app.utils.time import format_to_ist
    from sqlalchemy.orm import joinedload
    
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["ID", "Approving Admin Name", "Approving Admin Email", "Approved Admin Name", "Approved Admin Email", "Timestamp", "Action"])

    logs = db.query(AdminApprovalAuditLog).options(
        joinedload(AdminApprovalAuditLog.approved_admin),
        joinedload(AdminApprovalAuditLog.approving_admin),
    ).order_by(AdminApprovalAuditLog.timestamp.desc()).all()
    
    for log in logs:
        writer.writerow([
            str(log.id),
            log.approving_admin.full_name if log.approving_admin else "Unknown",
            log.approving_admin.email if log.approving_admin else "Unknown",
            log.approved_admin.full_name if log.approved_admin else "Unknown",
            log.approved_admin.email if log.approved_admin else "Unknown",
            format_to_ist(log.timestamp) if log.timestamp else "",
            log.action,
        ])

    return output.getvalue()


def export_reliability_pdf(db: Session) -> bytes:
    """Export reliability history to a styled PDF report."""
    headers = ["User Name", "Old Score", "New Score", "Reason", "Timestamp"]

    from app.reliability.models import ReliabilityHistory
    from app.auth.models import User

    logs = db.query(ReliabilityHistory, User).join(
        User, ReliabilityHistory.user_id == User.id
    ).order_by(ReliabilityHistory.timestamp.desc()).limit(500).all()
    
    rows = []
    for history, user in logs:
        rows.append([
            user.full_name[:20], history.old_score, history.new_score,
            history.reason,
            format_to_ist(history.timestamp, "%Y-%m-%d %H:%M") if history.timestamp else "-",
        ])

    return _build_pdf("Reliability History Report", headers, rows)


def export_admin_approvals_pdf(db: Session) -> bytes:
    """Export admin approval audit logs to a styled PDF report."""
    from app.audit.models import AdminApprovalAuditLog
    from app.utils.time import format_to_ist
    from sqlalchemy.orm import joinedload
    
    headers = ["Approving Admin", "Approving Email", "Approved User", "Approved Email", "Timestamp"]

    logs = db.query(AdminApprovalAuditLog).options(
        joinedload(AdminApprovalAuditLog.approved_admin),
        joinedload(AdminApprovalAuditLog.approving_admin),
    ).order_by(AdminApprovalAuditLog.timestamp.desc()).limit(500).all()
    
    rows = []
    for log in logs:
        approving_name = log.approving_admin.full_name if log.approving_admin else "Unknown"
        approving_email = log.approving_admin.email if log.approving_admin else "Unknown"
        approved_name = log.approved_admin.full_name if log.approved_admin else "Unknown"
        approved_email = log.approved_admin.email if log.approved_admin else "Unknown"
            
        rows.append([
            approving_name[:20],
            approving_email[:25],
            approved_name[:20],
            approved_email[:25],
            format_to_ist(log.timestamp, "%Y-%m-%d %H:%M") if log.timestamp else "-",
        ])

    return _build_pdf("Admin Approvals Report", headers, rows)
