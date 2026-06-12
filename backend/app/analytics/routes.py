"""
Analytics routes — dashboard data, charts, heatmaps, and ML predictions.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.auth.models import User
from app.auth.permissions import require_role
from app.analytics import service
from app.analytics.schemas import (
    DashboardSummary, AssetUtilizationResponse,
    LineChartData, PieChartData, BarChartData,
    HeatmapData, MaintenanceStatsResponse,
    DemandPredictionResponse, OverdueUsersResponse,
    AssetMaintenanceFrequencyResponse, ClubUsageResponse,
    HistogramData, QueueStatsResponse,
)

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Summary cards: total assets, active bookings, overdue returns, etc."""
    return service.get_summary(db)


@router.get("/asset-utilization", response_model=AssetUtilizationResponse)
def asset_utilization(
    limit: int = Query(10, ge=1, le=50),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Most and least utilized assets — for bar charts."""
    return service.get_asset_utilization(db, limit)


@router.get("/booking-trends", response_model=LineChartData)
def booking_trends(
    months: int = Query(12, ge=3, le=24),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Monthly booking trends — for line charts."""
    return service.get_booking_trends(db, months)


@router.get("/category-distribution", response_model=PieChartData)
def category_distribution(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Asset category breakdown — for pie charts."""
    return service.get_category_distribution(db)


@router.get("/maintenance-stats", response_model=MaintenanceStatsResponse)
def maintenance_stats(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Maintenance request statistics breakdown."""
    return service.get_maintenance_stats(db)


@router.get("/peak-usage", response_model=BarChartData)
def peak_usage(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Peak usage periods by month — for bar charts."""
    return service.get_peak_usage(db)


@router.get("/heatmap/bookings-by-day", response_model=HeatmapData)
def bookings_heatmap(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Booking density by day of week — heatmap data."""
    return service.get_bookings_by_day_heatmap(db)


@router.get("/heatmap/categories-by-month", response_model=HeatmapData)
def categories_heatmap(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Category booking density by month — heatmap data."""
    return service.get_categories_by_month_heatmap(db)


@router.get("/demand-prediction", response_model=DemandPredictionResponse)
def demand_prediction(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """ML-based demand forecast for the next 3 months per asset model."""
    return service.get_demand_prediction(db)


# ──────────────────────────────────────────────
# New Analytics Endpoints (Phase 6)
# ──────────────────────────────────────────────

@router.get("/most-booked", response_model=BarChartData)
def most_booked_assets(
    limit: int = Query(10, ge=1, le=50),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Most booked assets by count."""
    return service.get_most_booked_assets(db, limit)


@router.get("/most-overdue", response_model=OverdueUsersResponse)
def most_overdue_users(
    limit: int = Query(10, ge=1, le=50),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Users with the most overdue bookings."""
    return service.get_most_overdue_users(db, limit)


@router.get("/maintenance-frequency", response_model=AssetMaintenanceFrequencyResponse)
def maintenance_frequency(
    limit: int = Query(10, ge=1, le=50),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Assets requiring the most maintenance."""
    return service.get_maintenance_frequency(db, limit)


@router.get("/club-usage", response_model=ClubUsageResponse)
def club_usage(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Booking counts grouped by club."""
    return service.get_club_wise_usage(db)


@router.get("/reliability-distribution", response_model=HistogramData)
def reliability_distribution(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Histogram of user reliability scores."""
    return service.get_reliability_distribution(db)


@router.get("/queue-stats", response_model=QueueStatsResponse)
def queue_stats(
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Queue usage statistics."""
    return service.get_queue_stats(db)
