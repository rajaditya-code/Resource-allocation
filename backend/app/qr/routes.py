"""
QR code routes — generate and scan QR codes for asset units.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from app.dependencies import get_db
from app.auth.models import User
from app.auth.permissions import require_role
from app.qr import service

router = APIRouter(prefix="/api/v1/qr", tags=["QR Codes"])


@router.post("/generate/{unit_id}")
def generate_qr(
    unit_id: UUID,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Generate a QR code for a specific unit. Admin only."""
    url = service.generate_unit_qr(unit_id, db)
    return {"qr_code_url": url}


@router.post("/generate-bulk/{model_id}")
def generate_bulk_qr(
    model_id: UUID,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Generate QR codes for all units of an asset model. Admin only."""
    results = service.generate_bulk_qr_for_model(model_id, db)
    return {"units": results, "count": len(results)}


@router.post("/generate-all")
def generate_all_qr_pdf(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """
    Generate a printable PDF with QR codes for ALL units.
    Returns a downloadable PDF file.
    """
    pdf_bytes = service.generate_all_qr_pdf(db)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=all_qr_codes.pdf"},
    )


@router.get("/scan/{unit_id}")
def scan_qr(
    unit_id: UUID,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """
    Scan a QR code — look up full unit details by ID.
    This endpoint is what gets called when someone scans a QR code
    on a physical asset.
    """
    return service.get_unit_by_qr(unit_id, db)
