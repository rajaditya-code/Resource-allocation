"""
Asset routes — API endpoints for managing assets, units, images,
QR scanning, damage reporting, and availability calendars.

Admin-only endpoints use require_role("admin") as a dependency.
Browse/search endpoints are available to any authenticated user.
"""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, File, Query, Form
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.auth.models import User
from app.auth.permissions import require_role
from app.assets import service
from app.assets.schemas import (
    AssetModelCreate, AssetModelUpdate, AssetModelResponse, AssetModelListResponse,
    AssetUnitCreate, AssetUnitBatchCreate, AssetUnitUpdate, AssetUnitResponse, AssetUnitListResponse,
    AssetImageResponse, AssetImageHistoryResponse,
    AssetSearchParams, BulkImportResult, BatchAssetCreate,
)
from app.utils.supabase_client import upload_file as upload_to_supabase
from app.utils.validators import validate_image, validate_image_with_size

router = APIRouter(prefix="/api/v1/assets", tags=["Assets"])


# ──────────────────────────────────────────────
# Asset Model Endpoints
# ──────────────────────────────────────────────

@router.get("/", response_model=AssetModelListResponse)
def browse_assets(
    search: Optional[str] = Query(None, description="Search name, category, description"),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    condition: Optional[str] = Query(None),
    available_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Browse and search asset models with filtering and pagination."""
    params = AssetSearchParams(
        search=search, category=category, status=status,
        condition=condition, available_only=available_only,
        page=page, page_size=page_size,
    )
    return service.search_assets(params, db)


@router.get("/categories", response_model=list[str])
def list_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all unique asset categories."""
    return service.get_all_categories(db)


@router.get("/{model_id}", response_model=AssetModelResponse)
def get_asset_model(
    model_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get detailed info about a specific asset model."""
    return service.get_asset_model(model_id, db)


@router.post("/", response_model=AssetModelResponse, status_code=201)
def create_asset_model(
    data: AssetModelCreate,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Create a new asset model. Admin only."""
    return service.create_asset_model(data, admin.id, db)


@router.post("/batch", status_code=201)
def create_multiple_assets(
    data: BatchAssetCreate,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Manual batch creation of multiple asset models and their units. Admin only."""
    return service.create_multiple_assets_manual(data, admin.id, db)


@router.put("/{model_id}", response_model=AssetModelResponse)
def update_asset_model(
    model_id: UUID,
    data: AssetModelUpdate,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Update an asset model. Admin only."""
    return service.update_asset_model(model_id, data, admin.id, db)


@router.delete("/{model_id}")
def delete_asset_model(
    model_id: UUID,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Soft-delete an asset model and retire all its units. Admin only."""
    service.delete_asset_model(model_id, admin.id, db)
    return {"message": "Asset model deleted successfully"}


# ──────────────────────────────────────────────
# QR Code Scan
# ──────────────────────────────────────────────

@router.get("/scan/{unit_code}")
def scan_qr(
    unit_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Scan a QR code to get unit info.
    Returns asset details, condition, status, current holder, and availability.
    """
    return service.scan_unit(unit_code, db)


# ──────────────────────────────────────────────
# Availability Calendar
# ──────────────────────────────────────────────

@router.get("/{model_id}/availability")
def get_availability(
    model_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get availability calendar for an asset model.
    Returns booked dates, maintenance dates, and queue reservations.
    """
    return service.get_availability_calendar(model_id, db)


# ──────────────────────────────────────────────
# Damage Reporting
# ──────────────────────────────────────────────

@router.post("/report-damage")
async def report_damage(
    asset_unit_id: UUID = Form(...),
    remarks: str = Form(...),
    photos: List[UploadFile] = File(default=[]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Report damage on a unit. Automatically creates a maintenance request,
    health log, audit log, and notifies admins.
    """
    photo_urls = []
    for photo in photos:
        validate_image(photo)
        contents = await photo.read()
        url = upload_to_supabase(
            file_bytes=contents,
            filename=photo.filename or "damage.png",
            folder=f"damage/{asset_unit_id}",
            content_type=photo.content_type or "image/png",
        )
        photo_urls.append(url)

    return service.report_damage(asset_unit_id, remarks, photo_urls, current_user, db)


# ──────────────────────────────────────────────
# Asset Unit Endpoints
# ──────────────────────────────────────────────

@router.post("/{model_id}/units", response_model=list[AssetUnitResponse], status_code=201)
def add_units(
    model_id: UUID,
    data: AssetUnitBatchCreate,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Add physical units to an asset model. Admin only."""
    return service.add_units(model_id, data.units, db)


@router.get("/{model_id}/units", response_model=AssetUnitListResponse)
def list_units(
    model_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all units of a specific asset model."""
    units = service.get_units(model_id, db)
    return AssetUnitListResponse(items=units, total=len(units))


@router.put("/units/{unit_id}", response_model=AssetUnitResponse)
def update_unit(
    unit_id: UUID,
    data: AssetUnitUpdate,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Update a specific unit. Admin only."""
    return service.update_unit(unit_id, data, db)


@router.delete("/units/{unit_id}")
def retire_unit(
    unit_id: UUID,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Retire a unit (soft delete). Admin only."""
    service.delete_unit(unit_id, db)
    return {"message": "Unit retired successfully"}


# ──────────────────────────────────────────────
# Asset Image Endpoints
# ──────────────────────────────────────────────

@router.post("/{model_id}/images", response_model=AssetImageResponse, status_code=201)
async def upload_image(
    model_id: UUID,
    file: UploadFile = File(...),
    is_primary: bool = Form(False),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Upload an image for an asset model. Admin only."""
    contents = await validate_image_with_size(file)
    image_url = upload_to_supabase(
        file_bytes=contents,
        filename=file.filename or "asset.png",
        folder=f"assets/{model_id}",
        content_type=file.content_type or "image/png",
    )
    return service.add_image(model_id, image_url, admin.id, is_primary, db)


@router.put("/{model_id}/images/{image_id}", response_model=AssetImageResponse)
async def replace_image(
    model_id: UUID,
    image_id: UUID,
    file: UploadFile = File(...),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Replace an existing asset image. Admin only."""
    contents = await validate_image_with_size(file)
    new_url = upload_to_supabase(
        file_bytes=contents,
        filename=file.filename or "asset.png",
        folder=f"assets/{model_id}",
        content_type=file.content_type or "image/png",
    )
    return service.replace_image(model_id, image_id, new_url, admin.id, db)


@router.delete("/{model_id}/images/{image_id}")
def delete_image(
    model_id: UUID,
    image_id: UUID,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Delete an asset image. Admin only."""
    service.delete_image(model_id, image_id, admin.id, db)
    return {"message": "Image deleted successfully"}


@router.get("/{model_id}/images/history", response_model=list[AssetImageHistoryResponse])
def image_history(
    model_id: UUID,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """View the full image change history for an asset model. Admin only."""
    return service.get_image_history(model_id, db)


# ──────────────────────────────────────────────
# Bulk Import
# ──────────────────────────────────────────────

@router.post("/bulk-import", response_model=BulkImportResult)
async def bulk_import(
    file: UploadFile = File(...),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """
    Bulk import assets from a CSV file. Admin only.

    CSV format:
        name,category,quantity,location,description
        Camera,DSLR,10,Room A,Canon EOS 90D
    """
    contents = await file.read()
    csv_text = contents.decode("utf-8")
    return service.bulk_import_assets(csv_text, db)
