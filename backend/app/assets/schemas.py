"""
Asset schemas — request/response models for the assets module.

Covers asset models, units, images, image history, search/filter,
pagination, and bulk CSV import.
"""

from datetime import datetime, date
from typing import Optional, List
from uuid import UUID

from pydantic import Field
from app.schemas_base import BaseModel


# ──────────────────────────────────────────────
# Asset Model CRUD
# ──────────────────────────────────────────────

class AssetModelCreate(BaseModel):
    """Create a new asset model (the SKU/type, not individual units)."""
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    purchase_date: Optional[date] = None
    status: str = Field("Available", pattern="^(Available|Unavailable|Maintenance|Damaged)$")


class BatchAssetItem(BaseModel):
    """An asset model to create, along with the number of units."""
    model: AssetModelCreate
    units_to_add: int = Field(0, ge=0)

class BatchAssetCreate(BaseModel):
    """Manual batch creation of multiple asset models."""
    assets: List[BatchAssetItem]


class AssetModelUpdate(BaseModel):
    """Partial update fields for an asset model."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    purchase_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern="^(Available|Unavailable|Maintenance|Damaged)$")


class AssetUnitResponse(BaseModel):
    """Response for an individual physical unit."""
    id: UUID
    asset_model_id: UUID
    unit_code: str
    serial_number: Optional[str] = None
    condition: str
    status: str
    qr_code_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssetImageResponse(BaseModel):
    """Response for an asset image."""
    id: UUID
    asset_model_id: UUID
    image_url: str
    is_primary: bool
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class AssetModelResponse(BaseModel):
    """Full response for an asset model, including unit counts and images."""
    id: UUID
    name: str
    category: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    location: Optional[str] = None
    purchase_date: Optional[date] = None
    status: str
    total_units: int = 0
    available_units: int = 0
    images: List[AssetImageResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssetModelListResponse(BaseModel):
    """Paginated list of asset models."""
    items: List[AssetModelResponse]
    total: int
    page: int
    page_size: int
    pages: int


# ──────────────────────────────────────────────
# Asset Units
# ──────────────────────────────────────────────

class AssetUnitCreate(BaseModel):
    """Create one or more units for an asset model."""
    unit_code: str = Field(..., min_length=1, max_length=50)
    serial_number: Optional[str] = Field(None, max_length=100)
    condition: str = Field("Good", pattern="^(Excellent|Good|Fair|Poor|Damaged)$")


class AssetUnitBatchCreate(BaseModel):
    """Create multiple units at once."""
    units: List[AssetUnitCreate]


class AssetUnitUpdate(BaseModel):
    """Update a specific unit."""
    serial_number: Optional[str] = Field(None, max_length=100)
    condition: Optional[str] = Field(None, pattern="^(Excellent|Good|Fair|Poor|Damaged)$")
    status: Optional[str] = Field(None, pattern="^(Available|Issued|Maintenance|Retired)$")


class AssetUnitListResponse(BaseModel):
    """List of units for a model."""
    items: List[AssetUnitResponse]
    total: int


# ──────────────────────────────────────────────
# Image History
# ──────────────────────────────────────────────

class AssetImageHistoryResponse(BaseModel):
    """One entry in the image change log."""
    id: UUID
    asset_image_id: Optional[UUID] = None
    asset_model_id: UUID
    old_image_url: Optional[str] = None
    new_image_url: Optional[str] = None
    action: str
    changed_by: UUID
    timestamp: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Bulk Import
# ──────────────────────────────────────────────

class BulkImportResult(BaseModel):
    """Result of a CSV bulk import operation."""
    total_rows: int
    created: int
    errors: List[str]


# ──────────────────────────────────────────────
# Search & Filter
# ──────────────────────────────────────────────

class AssetSearchParams(BaseModel):
    """Query parameters for browsing/searching assets."""
    search: Optional[str] = None       # searches name, category, description
    category: Optional[str] = None
    status: Optional[str] = None
    condition: Optional[str] = None    # filter units by condition
    available_only: bool = False       # only models with available units
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
