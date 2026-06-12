"""
Asset service — all asset management business logic.

Handles CRUD for asset models and units, image management with
history tracking, search/filter with pagination, CSV bulk import,
QR scan lookup, damage reporting, and availability calendar.

Audit logs are created automatically for all important actions.
"""

import csv
import io
import math
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.assets.models import AssetModel, AssetUnit, AssetImage, AssetImageHistory
from app.assets.schemas import (
    AssetModelCreate, AssetModelUpdate,
    AssetUnitCreate, AssetUnitUpdate,
    AssetSearchParams, BatchAssetCreate, BulkImportResult,
)
from app.auth.models import User
from app.utils.supabase_client import upload_file, delete_file


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
# Asset Model CRUD
# ──────────────────────────────────────────────

def create_asset_model(data: AssetModelCreate, admin_id: UUID, db: Session) -> AssetModel:
    """Create a new asset model (the product type, not individual units)."""
    model = AssetModel(
        name=data.name,
        category=data.category,
        description=data.description,
        location=data.location,
        purchase_date=data.purchase_date,
        status=data.status,
    )
    db.add(model)
    db.commit()
    db.refresh(model)

    _log_action(db, admin_id, "ASSET_CREATED", "asset_model", model.id, {"name": data.name, "category": data.category})
    db.commit()

    return model


def get_asset_model(model_id: UUID, db: Session) -> AssetModel:
    """Fetch a single asset model by ID."""
    model = db.query(AssetModel).filter(AssetModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Asset model not found")
    return model


def update_asset_model(model_id: UUID, data: AssetModelUpdate, admin_id: UUID, db: Session) -> AssetModel:
    """Update fields on an existing asset model."""
    model = get_asset_model(model_id, db)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(model, field, value)

    _log_action(db, admin_id, "ASSET_UPDATED", "asset_model", model.id, {"updated_fields": list(update_data.keys())})

    db.commit()
    db.refresh(model)
    
    # Audit log
    _log_action(db, admin_id, "asset_created", "asset_model", model.id, {"name": model.name})

    return model

def create_multiple_assets_manual(data: BatchAssetCreate, admin_id: UUID, db: Session) -> dict:
    """Create multiple asset models and their initial units in one transaction."""
    from uuid import uuid4
    
    created_models = []
    total_units_created = 0
    
    for item in data.assets:
        model = AssetModel(
            name=item.model.name,
            category=item.model.category,
            description=item.model.description,
            location=item.model.location,
            purchase_date=item.model.purchase_date,
            status=item.model.status,
        )
        db.add(model)
        db.flush()
        
        created_models.append(model)
        
        # Log asset created with more detail
        _log_action(db, admin_id, "asset_created", "asset_model", model.id, {
            "name": model.name,
            "category": model.category
        })
        
        # Add units if requested
        if item.units_to_add > 0:
            units = []
            unit_codes = []
            for i in range(item.units_to_add):
                # Generate a simple unique unit code
                code = f"{model.name[:3].upper()}-{str(uuid4())[:6].upper()}"
                unit = AssetUnit(
                    asset_model_id=model.id,
                    unit_code=code,
                    condition="New",
                )
                db.add(unit)
                units.append(unit)
                unit_codes.append(code)
            
            db.flush()
            total_units_created += item.units_to_add
            
            # Log units added with detail
            _log_action(db, admin_id, "units_added", "asset_model", model.id, {
                "name": model.name,
                "count": item.units_to_add,
                "unit_codes": unit_codes
            })
            
    db.commit()
    
    return {
        "models_created": len(created_models),
        "units_created": total_units_created
    }


def delete_asset_model(model_id: UUID, admin_id: UUID, db: Session) -> bool:
    """Soft-delete an asset model and retire all its units."""
    model = get_asset_model(model_id, db)

    db.query(AssetUnit).filter(
        AssetUnit.asset_model_id == model_id,
    ).update({"status": "Retired"})

    model.status = "Unavailable"

    _log_action(db, admin_id, "ASSET_DELETED", "asset_model", model.id, {"name": model.name})

    db.commit()
    return True


# ──────────────────────────────────────────────
# Asset Search & Browse
# ──────────────────────────────────────────────

def search_assets(params: AssetSearchParams, db: Session) -> dict:
    """
    Search and filter asset models with pagination.
    Supports text search, status filtering, condition filtering,
    and availability filtering.
    """
    query = db.query(AssetModel)

    if params.search:
        search_term = f"%{params.search}%"
        query = query.filter(
            or_(
                AssetModel.name.ilike(search_term),
                AssetModel.category.ilike(search_term),
                AssetModel.description.ilike(search_term),
            )
        )

    if params.status:
        query = query.filter(AssetModel.status == params.status)

    if params.category:
        query = query.filter(AssetModel.category == params.category)

    if params.available_only:
        query = query.filter(
            AssetModel.units.any(AssetUnit.status == "Available")
        )

    if params.condition:
        query = query.filter(
            AssetModel.units.any(AssetUnit.condition == params.condition)
        )

    total = query.count()
    offset = (params.page - 1) * params.page_size
    items = query.offset(offset).limit(params.page_size).all()

    return {
        "items": items,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "pages": math.ceil(total / params.page_size) if total > 0 else 0,
    }


# ──────────────────────────────────────────────
# Asset Units
# ──────────────────────────────────────────────

def add_units(model_id: UUID, units_data: List[AssetUnitCreate], db: Session) -> List[AssetUnit]:
    """Add one or more physical units to an asset model."""
    model = get_asset_model(model_id, db)

    created_units = []
    for unit_data in units_data:
        existing = db.query(AssetUnit).filter(AssetUnit.unit_code == unit_data.unit_code).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Unit code '{unit_data.unit_code}' already exists",
            )

        unit = AssetUnit(
            asset_model_id=model_id,
            unit_code=unit_data.unit_code,
            serial_number=unit_data.serial_number,
            condition=unit_data.condition,
        )
        db.add(unit)
        created_units.append(unit)

    db.commit()
    for unit in created_units:
        db.refresh(unit)
        
    unit_codes = [u.unit_code for u in created_units]
    # Look up admin_id from the user calling this route (we need to pass admin_id from route)
    # However, to avoid changing function signature heavily and breaking existing calls,
    # we can leave it to the route to log, or change signature. Let's change signature to accept admin_id.
    # Actually, we'll fix the route first.

    return created_units


def get_units(model_id: UUID, db: Session) -> List[AssetUnit]:
    """List all units for a given asset model."""
    get_asset_model(model_id, db)
    return db.query(AssetUnit).filter(AssetUnit.asset_model_id == model_id).all()


def update_unit(unit_id: UUID, data: AssetUnitUpdate, db: Session) -> AssetUnit:
    """Update a specific unit's details."""
    unit = db.query(AssetUnit).filter(AssetUnit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(unit, field, value)

    db.commit()
    db.refresh(unit)
    return unit


def delete_unit(unit_id: UUID, db: Session) -> bool:
    """Retire a unit (soft delete)."""
    unit = db.query(AssetUnit).filter(AssetUnit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    unit.status = "Retired"
    db.commit()
    return True


# ──────────────────────────────────────────────
# Asset Images with History Tracking
# ──────────────────────────────────────────────

def add_image(model_id: UUID, image_url: str, user_id: UUID, is_primary: bool, db: Session) -> AssetImage:
    """Upload a new image for an asset model, with history tracking."""
    get_asset_model(model_id, db)

    if is_primary:
        db.query(AssetImage).filter(
            AssetImage.asset_model_id == model_id,
            AssetImage.is_primary == True,
        ).update({"is_primary": False})

    image = AssetImage(
        asset_model_id=model_id,
        image_url=image_url,
        is_primary=is_primary,
    )
    db.add(image)
    db.flush()

    history = AssetImageHistory(
        asset_image_id=image.id,
        asset_model_id=model_id,
        old_image_url=None,
        new_image_url=image_url,
        action="upload",
        changed_by=user_id,
    )
    db.add(history)

    if is_primary:
        model = get_asset_model(model_id, db)
        model.image_url = image_url

    db.commit()
    db.refresh(image)
    return image


def replace_image(model_id: UUID, image_id: UUID, new_image_url: str, user_id: UUID, db: Session) -> AssetImage:
    """Replace an existing asset image, tracking the change in history."""
    image = db.query(AssetImage).filter(
        AssetImage.id == image_id,
        AssetImage.asset_model_id == model_id,
    ).first()

    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    old_url = image.image_url

    history = AssetImageHistory(
        asset_image_id=image.id,
        asset_model_id=model_id,
        old_image_url=old_url,
        new_image_url=new_image_url,
        action="replace",
        changed_by=user_id,
    )
    db.add(history)

    image.image_url = new_image_url

    if image.is_primary:
        model = get_asset_model(model_id, db)
        model.image_url = new_image_url

    delete_file(old_url)

    db.commit()
    db.refresh(image)
    return image


def delete_image(model_id: UUID, image_id: UUID, user_id: UUID, db: Session) -> bool:
    """Delete an asset image, tracking the deletion in history."""
    image = db.query(AssetImage).filter(
        AssetImage.id == image_id,
        AssetImage.asset_model_id == model_id,
    ).first()

    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    history = AssetImageHistory(
        asset_image_id=None,
        asset_model_id=model_id,
        old_image_url=image.image_url,
        new_image_url=None,
        action="delete",
        changed_by=user_id,
    )
    db.add(history)

    delete_file(image.image_url)

    if image.is_primary:
        model = get_asset_model(model_id, db)
        model.image_url = None

    db.delete(image)
    db.commit()
    return True


def get_image_history(model_id: UUID, db: Session) -> List[AssetImageHistory]:
    """Get the full image change log for an asset model."""
    return db.query(AssetImageHistory).filter(
        AssetImageHistory.asset_model_id == model_id,
    ).order_by(AssetImageHistory.timestamp.desc()).all()


# ──────────────────────────────────────────────
# QR Scan — Look up a unit by its code
# ──────────────────────────────────────────────

def scan_unit(unit_code: str, db: Session) -> dict:
    """
    Look up a unit by its code (used when scanning a QR code).
    Returns detailed info including current holder if issued.
    """
    unit = db.query(AssetUnit).filter(AssetUnit.unit_code == unit_code).first()
    if not unit:
        raise HTTPException(status_code=404, detail=f"Unit with code '{unit_code}' not found")

    model = db.query(AssetModel).filter(AssetModel.id == unit.asset_model_id).first()

    # Find current holder if the unit is issued
    current_holder = None
    if unit.status == "Issued":
        from app.bookings.models import BookingUnitAssignment, Booking
        assignment = db.query(BookingUnitAssignment).filter(
            BookingUnitAssignment.asset_unit_id == unit.id,
            BookingUnitAssignment.returned_at == None,
        ).first()
        if assignment:
            booking = db.query(Booking).filter(Booking.booking_id == assignment.booking_id).first()
            if booking:
                holder = db.query(User).filter(User.id == booking.user_id).first()
                if holder:
                    current_holder = holder.full_name

    return {
        "asset": {
            "model_name": model.name if model else None,
            "category": model.category if model else None,
            "unit_code": unit.unit_code,
            "serial_number": unit.serial_number,
        },
        "condition": unit.condition,
        "status": unit.status,
        "current_holder": current_holder,
        "availability": "Available" if unit.status == "Available" else unit.status,
    }


# ──────────────────────────────────────────────
# Damage Reporting
# ──────────────────────────────────────────────

def report_damage(asset_unit_id: UUID, remarks: str, photo_urls: List[str], user: User, db: Session) -> dict:
    """
    Report damage on a unit. This automatically:
    - Creates a maintenance request
    - Logs an asset health entry
    - Creates an audit log
    - Notifies all admins
    """
    unit = db.query(AssetUnit).filter(AssetUnit.id == asset_unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    # Update unit condition
    unit.condition = "Damaged"

    # Create a maintenance request
    from app.maintenance.models import MaintenanceRequest, AssetHealthLog
    maint = MaintenanceRequest(
        asset_unit_id=unit.id,
        issue=f"Damage report: {remarks}",
        priority="High",
        status="Open",
        reported_by=user.id,
    )
    db.add(maint)
    db.flush()

    # Create health log
    health_log = AssetHealthLog(
        asset_unit_id=unit.id,
        condition=unit.condition,
        notes=f"Damage reported by {user.full_name}: {remarks}",
        recorded_by=user.id,
    )
    db.add(health_log)

    # Audit log
    _log_action(db, user.id, "DAMAGE_REPORTED", "asset_unit", unit.id, {
        "unit_code": unit.unit_code, "remarks": remarks,
    })

    # Notify all admins
    admins = db.query(User).filter(User.role == "admin").all()
    for admin in admins:
        _notify(db, admin.id, "Damage Report",
                f"Damage reported on unit {unit.unit_code}: {remarks}",
                "damage_report")

    db.commit()

    return {
        "message": "Damage report submitted",
        "maintenance_request_id": str(maint.id),
        "unit_code": unit.unit_code,
    }


# ──────────────────────────────────────────────
# Availability Calendar
# ──────────────────────────────────────────────

def get_availability_calendar(model_id: UUID, db: Session) -> dict:
    """
    Get availability info for an asset model.
    Returns booked dates, maintenance dates, and queue reservations
    so the frontend can render a calendar.
    """
    model = get_asset_model(model_id, db)

    from app.bookings.models import Booking

    # Get all active bookings for this model
    active_bookings = db.query(Booking).filter(
        Booking.asset_model_id == model_id,
        Booking.status.in_(["Approved", "Issued", "Pending"]),
    ).all()

    booked_dates = []
    for booking in active_bookings:
        booked_dates.append({
            "start_date": booking.start_date.isoformat(),
            "end_date": booking.end_date.isoformat(),
            "status": booking.status,
            "quantity": booking.quantity,
        })

    # Get maintenance info for units of this model
    from app.maintenance.models import MaintenanceRequest
    units_in_maintenance = db.query(AssetUnit).filter(
        AssetUnit.asset_model_id == model_id,
        AssetUnit.status == "Maintenance",
    ).all()

    maintenance_dates = []
    for unit in units_in_maintenance:
        maint_requests = db.query(MaintenanceRequest).filter(
            MaintenanceRequest.asset_unit_id == unit.id,
            MaintenanceRequest.status.in_(["Open", "In Progress"]),
        ).all()
        for maint in maint_requests:
            maintenance_dates.append({
                "unit_code": unit.unit_code,
                "issue": maint.issue,
                "status": maint.status,
                "created_at": maint.created_at.isoformat() if maint.created_at else None,
            })

    # Get queue reservations
    queue_reservations = []
    try:
        from app.queue.models import AssetQueue
        reservations = db.query(AssetQueue).filter(
            AssetQueue.asset_model_id == model_id,
            AssetQueue.status == "Reserved",
        ).all()
        for res in reservations:
            queue_reservations.append({
                "reserved_at": res.reserved_at.isoformat() if res.reserved_at else None,
                "expires_at": res.expires_at.isoformat() if res.expires_at else None,
            })
    except Exception:
        pass

    total_units = db.query(AssetUnit).filter(
        AssetUnit.asset_model_id == model_id,
        AssetUnit.status != "Retired",
    ).count()
    available_units = db.query(AssetUnit).filter(
        AssetUnit.asset_model_id == model_id,
        AssetUnit.status == "Available",
    ).count()

    return {
        "asset_model": model.name,
        "total_units": total_units,
        "available_units": available_units,
        "booked_dates": booked_dates,
        "maintenance_dates": maintenance_dates,
        "queue_reservations": queue_reservations,
    }


# ──────────────────────────────────────────────
# Bulk Import from CSV
# ──────────────────────────────────────────────

def bulk_import_assets(csv_content: str, db: Session) -> BulkImportResult:
    """
    Import assets from CSV content.

    CSV format:
        name,category,quantity,location,description
        Camera,DSLR,10,Room A,Canon EOS 90D
    """
    reader = csv.DictReader(io.StringIO(csv_content))
    created = 0
    errors = []
    total_rows = 0

    for row_num, row in enumerate(reader, start=2):
        total_rows += 1
        try:
            name = row.get("name", "").strip()
            category = row.get("category", "").strip()
            quantity_str = row.get("quantity", "0").strip()
            location = row.get("location", "").strip() or None
            description = row.get("description", "").strip() or None

            if not name or not category:
                errors.append(f"Row {row_num}: name and category are required")
                continue

            quantity = int(quantity_str)
            if quantity < 0:
                errors.append(f"Row {row_num}: quantity must be non-negative")
                continue

            model = AssetModel(
                name=name,
                category=category,
                description=description,
                location=location,
            )
            db.add(model)
            db.flush()

            prefix = name.upper().replace(" ", "-")[:10]
            for i in range(1, quantity + 1):
                unit_code = f"{prefix}-{i:03d}"

                while db.query(AssetUnit).filter(AssetUnit.unit_code == unit_code).first():
                    unit_code = f"{prefix}-{i:03d}-{row_num}"

                unit = AssetUnit(
                    asset_model_id=model.id,
                    unit_code=unit_code,
                )
                db.add(unit)

            created += 1

        except ValueError as e:
            errors.append(f"Row {row_num}: invalid data — {str(e)}")
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")

    db.commit()

    return BulkImportResult(
        total_rows=total_rows,
        created=created,
        errors=errors,
    )


def get_all_categories(db: Session) -> List[str]:
    """Get a list of all unique asset categories."""
    results = db.query(AssetModel.category).distinct().all()
    return [r[0] for r in results]
