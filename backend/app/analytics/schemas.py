"""
Analytics schemas — chart-ready response models for the dashboard.

Every response is structured to plug directly into a frontend chart
library (Chart.js, Recharts, etc.) without transformation.
"""

from typing import List, Optional, Dict, Any
from app.schemas_base import BaseModel


# ──────────────────────────────────────────────
# Summary Cards
# ──────────────────────────────────────────────

class SummaryCard(BaseModel):
    """Single dashboard summary card."""
    label: str
    value: Any
    change: Optional[float] = None  # percentage change from last period
    icon: Optional[str] = None


class DashboardSummary(BaseModel):
    """Collection of summary cards for the dashboard overview."""
    cards: List[SummaryCard]


# ──────────────────────────────────────────────
# Chart Data
# ──────────────────────────────────────────────

class ChartDataPoint(BaseModel):
    """Generic data point for charts."""
    label: str
    value: float


class BarChartData(BaseModel):
    """Bar chart data — e.g., most/least utilized assets."""
    title: str
    labels: List[str]
    values: List[float]


class PieChartData(BaseModel):
    """Pie chart data — e.g., category distribution."""
    title: str
    labels: List[str]
    values: List[float]


class LineChartData(BaseModel):
    """Line chart data — e.g., monthly booking trends."""
    title: str
    labels: List[str]         # x-axis labels (months, dates, etc.)
    datasets: List[dict]      # [{label, data: [...]}]


# ──────────────────────────────────────────────
# Heatmap Data
# ──────────────────────────────────────────────

class HeatmapCell(BaseModel):
    """Single cell in a heatmap."""
    x: str  # column label
    y: str  # row label
    value: float


class HeatmapData(BaseModel):
    """Full heatmap dataset."""
    title: str
    x_labels: List[str]
    y_labels: List[str]
    cells: List[HeatmapCell]


# ──────────────────────────────────────────────
# Advanced Analytics
# ──────────────────────────────────────────────

class AssetUtilizationItem(BaseModel):
    """Utilization data for a single asset model."""
    asset_name: str
    category: str
    total_bookings: int
    utilization_rate: float  # percentage
    avg_booking_duration: float  # days


class AssetUtilizationResponse(BaseModel):
    """Most and least utilized assets."""
    most_utilized: List[AssetUtilizationItem]
    least_utilized: List[AssetUtilizationItem]


class MaintenanceStatsResponse(BaseModel):
    """Maintenance statistics breakdown."""
    total_requests: int
    open: int
    in_progress: int
    resolved: int
    closed: int
    by_priority: List[ChartDataPoint]


class DemandPrediction(BaseModel):
    """Predicted demand for an asset model."""
    asset_name: str
    predicted_bookings: List[ChartDataPoint]  # next 3 months
    confidence: float


class DemandPredictionResponse(BaseModel):
    """ML-based demand predictions."""
    predictions: List[DemandPrediction]


# ──────────────────────────────────────────────
# New Analytics Models (Phase 6)
# ──────────────────────────────────────────────

class OverdueUserItem(BaseModel):
    """User with overdue bookings."""
    user_name: str
    club: Optional[str]
    overdue_count: int


class OverdueUsersResponse(BaseModel):
    """List of most overdue users."""
    users: List[OverdueUserItem]


class AssetMaintenanceFrequencyItem(BaseModel):
    """Asset model requiring frequent maintenance."""
    asset_name: str
    total_maintenance_requests: int


class AssetMaintenanceFrequencyResponse(BaseModel):
    """List of assets requiring most maintenance."""
    assets: List[AssetMaintenanceFrequencyItem]


class ClubUsageItem(BaseModel):
    """Usage stats by club."""
    club: str
    total_bookings: int


class ClubUsageResponse(BaseModel):
    """Booking counts grouped by user club."""
    clubs: List[ClubUsageItem]


class HistogramData(BaseModel):
    """Histogram data for reliability scores."""
    title: str
    bins: List[str]
    counts: List[int]


class QueueStatsResponse(BaseModel):
    """Queue usage statistics."""
    total_people_waiting: int
    total_reservations_active: int
    total_reservations_expired: int
    most_queued_assets: List[ChartDataPoint]
