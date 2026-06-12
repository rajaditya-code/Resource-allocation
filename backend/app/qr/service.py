"""
QR code service — generate QR codes for individual asset units.

Each physical unit gets its own QR code containing its unit_id.
Scanning a QR instantly pulls up the unit's full details:
condition, current borrower, history, maintenance status.

Also supports bulk generation of QR codes as a multi-page PDF
for printing and labeling.
"""

import io
import qrcode
from typing import List
from uuid import UUID

from fastapi import HTTPException
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.assets.models import AssetUnit, AssetModel
from app.utils.supabase_client import upload_file


def generate_qr_image(data: str) -> bytes:
    """Generate a QR code image as PNG bytes."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def generate_unit_qr(unit_id: UUID, db: Session) -> str:
    """
    Generate a QR code for a specific unit, upload it to Supabase,
    and store the URL on the unit record.
    """
    unit = db.query(AssetUnit).filter(AssetUnit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    # QR data contains the unit ID — scanning it pulls up the unit's details
    qr_data = str(unit.id)
    qr_bytes = generate_qr_image(qr_data)

    # Upload to Supabase storage
    url = upload_file(
        file_bytes=qr_bytes,
        filename=f"{unit.unit_code}.png",
        folder="qr-codes",
        content_type="image/png",
    )

    # Save the URL on the unit
    unit.qr_code_url = url
    db.commit()
    db.refresh(unit)

    return url


def generate_bulk_qr_for_model(model_id: UUID, db: Session) -> List[dict]:
    """
    Generate QR codes for all units of a specific asset model.
    Returns a list of {unit_code, qr_url} dicts.
    """
    units = db.query(AssetUnit).filter(
        AssetUnit.asset_model_id == model_id,
        AssetUnit.status != "Retired",
    ).all()

    if not units:
        raise HTTPException(status_code=404, detail="No units found for this model")

    results = []
    for unit in units:
        qr_data = str(unit.id)
        qr_bytes = generate_qr_image(qr_data)
        url = upload_file(
            file_bytes=qr_bytes,
            filename=f"{unit.unit_code}.png",
            folder="qr-codes",
            content_type="image/png",
        )
        unit.qr_code_url = url
        results.append({"unit_code": unit.unit_code, "qr_url": url})

    db.commit()
    return results


def generate_all_qr_pdf(db: Session) -> bytes:
    """
    Generate a multi-page PDF containing QR codes for ALL non-retired units.
    Each page has a grid of QR codes with unit codes for printing.
    """
    units = db.query(AssetUnit).filter(
        AssetUnit.status != "Retired",
    ).all()

    if not units:
        raise HTTPException(status_code=404, detail="No units found")

    # Create PDF
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Grid layout: 3 columns x 4 rows per page
    cols = 3
    rows = 4
    per_page = cols * rows
    qr_size = 1.8 * inch
    margin_x = 0.5 * inch
    margin_y = 0.5 * inch
    col_width = (width - 2 * margin_x) / cols
    row_height = (height - 2 * margin_y) / rows

    for i, unit in enumerate(units):
        # New page if needed
        if i > 0 and i % per_page == 0:
            c.showPage()

        # Calculate position in grid
        pos = i % per_page
        col = pos % cols
        row = pos // cols

        x = margin_x + col * col_width + (col_width - qr_size) / 2
        y = height - margin_y - (row + 1) * row_height + (row_height - qr_size) / 2

        # Generate QR code image
        qr_bytes = generate_qr_image(str(unit.id))
        qr_image = io.BytesIO(qr_bytes)

        # Draw QR code
        from reportlab.lib.utils import ImageReader
        img = ImageReader(qr_image)
        c.drawImage(img, x, y + 15, width=qr_size, height=qr_size)

        # Draw unit code label below
        c.setFont("Helvetica-Bold", 9)
        label_x = x + qr_size / 2
        c.drawCentredString(label_x, y + 5, unit.unit_code)

        # Draw model name if available
        if unit.asset_model:
            c.setFont("Helvetica", 7)
            c.drawCentredString(label_x, y - 5, unit.asset_model.name[:30])

    c.save()
    return buffer.getvalue()


def get_unit_by_qr(unit_id: UUID, db: Session) -> dict:
    """
    'Scan' a QR code — look up the unit by its ID and return full details.
    This is what happens when someone scans a QR code on a physical asset.
    """
    unit = db.query(AssetUnit).filter(AssetUnit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    # Load the model info
    model = db.query(AssetModel).filter(AssetModel.id == unit.asset_model_id).first()

    # Load ongoing maintenance requests
    from app.maintenance.models import MaintenanceRequest
    ongoing_requests = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.asset_unit_id == unit.id,
        MaintenanceRequest.status.in_(["Open", "In Progress"])
    ).all()

    # Load last maintenance done
    last_maintenance = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.asset_unit_id == unit.id,
        MaintenanceRequest.status.in_(["Resolved", "Closed"])
    ).order_by(MaintenanceRequest.updated_at.desc()).first()

    return {
        "unit_id": str(unit.id),
        "unit_code": unit.unit_code,
        "serial_number": unit.serial_number,
        "condition": unit.condition,
        "status": unit.status,
        "qr_code_url": unit.qr_code_url,
        "asset_model": {
            "id": str(model.id) if model else None,
            "name": model.name if model else None,
            "category": model.category if model else None,
            "location": model.location if model else None,
        },
        "ongoing_maintenance_requests": len(ongoing_requests),
        "last_maintenance_done": last_maintenance.updated_at.isoformat() if last_maintenance else None,
    }
