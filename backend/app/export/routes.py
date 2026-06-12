"""
Export routes — downloadable CSV and PDF reports. Admin only.
"""

import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.auth.models import User
from app.auth.permissions import require_role
from app.export import service

router = APIRouter(prefix="/api/v1/export", tags=["Export"])


@router.get("/inventory")
def export_inventory(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Export inventory report as CSV or PDF."""
    if format == "pdf":
        pdf_bytes = service.export_inventory_pdf(db)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=inventory_report.pdf"},
        )
    else:
        csv_content = service.export_inventory_csv(db)
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=inventory_report.csv"},
        )


@router.get("/bookings")
def export_bookings(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Export bookings report as CSV or PDF."""
    if format == "pdf":
        pdf_bytes = service.export_bookings_pdf(db)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=bookings_report.pdf"},
        )
    else:
        csv_content = service.export_bookings_csv(db)
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=bookings_report.csv"},
        )


@router.get("/audit-logs")
def export_audit_logs(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Export audit logs as CSV or PDF."""
    if format == "pdf":
        pdf_bytes = service.export_audit_logs_pdf(db)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=audit_logs_report.pdf"},
        )
    else:
        csv_content = service.export_audit_logs_csv(db)
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=audit_logs_report.csv"},
        )


@router.get("/maintenance")
def export_maintenance(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Export maintenance report as CSV or PDF."""
    if format == "pdf":
        pdf_bytes = service.export_maintenance_pdf(db)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=maintenance_report.pdf"},
        )
    else:
        csv_content = service.export_maintenance_csv(db)
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=maintenance_report.csv"},
        )


@router.get("/reliability")
def export_reliability(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Export reliability history report as CSV or PDF."""
    if format == "pdf":
        pdf_bytes = service.export_reliability_pdf(db)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=reliability_report.pdf"},
        )
    else:
        csv_content = service.export_reliability_csv(db)
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=reliability_report.csv"},
        )


@router.get("/admin-approvals")
def export_admin_approvals(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Export admin approval audit logs as CSV or PDF."""
    if format == "pdf":
        pdf_bytes = service.export_admin_approvals_pdf(db)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=admin_approvals_report.pdf"},
        )
    else:
        csv_content = service.export_admin_approvals_csv(db)
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=admin_approvals_report.csv"},
        )
