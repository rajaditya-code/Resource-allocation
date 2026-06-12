"""
Analytics service — dashboard data aggregation, heatmaps, and ML prediction.

All queries are optimized for frontend charts. Results are structured
to plug directly into Chart.js / Recharts / any charting library.
"""

from datetime import datetime, date, timedelta
from collections import defaultdict
from typing import List

from sqlalchemy import func, extract
from sqlalchemy.orm import Session
from app.utils.time import get_ist_now

from app.assets.models import AssetModel, AssetUnit
from app.bookings.models import Booking
from app.maintenance.models import MaintenanceRequest
from app.auth.models import User
from app.queue.models import AssetQueue
from app.analytics.schemas import (
    SummaryCard, DashboardSummary,
    BarChartData, PieChartData, LineChartData,
    HeatmapCell, HeatmapData,
    AssetUtilizationItem, AssetUtilizationResponse,
    MaintenanceStatsResponse, ChartDataPoint,
    DemandPrediction, DemandPredictionResponse,
    OverdueUserItem, OverdueUsersResponse,
    AssetMaintenanceFrequencyItem, AssetMaintenanceFrequencyResponse,
    ClubUsageItem, ClubUsageResponse,
    HistogramData, QueueStatsResponse,
)


# ──────────────────────────────────────────────
# Dashboard Summary
# ──────────────────────────────────────────────

def get_summary(db: Session) -> DashboardSummary:
    """Generate summary cards for the dashboard overview."""
    total_models = db.query(AssetModel).count()
    total_units = db.query(AssetUnit).filter(AssetUnit.status != "Retired").count()
    available_units = db.query(AssetUnit).filter(AssetUnit.status == "Available").count()
    active_bookings = db.query(Booking).filter(Booking.status.in_(["Approved", "Issued"])).count()
    pending_bookings = db.query(Booking).filter(Booking.status == "Pending").count()
    overdue = db.query(Booking).filter(Booking.status == "Overdue").count()
    categories = db.query(AssetModel.category).distinct().count()
    maintenance_open = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.status.in_(["Open", "In Progress"])
    ).count()

    cards = [
        SummaryCard(label="Total Asset Models", value=total_models, icon="package"),
        SummaryCard(label="Total Units", value=total_units, icon="boxes"),
        SummaryCard(label="Available Units", value=available_units, icon="check-circle"),
        SummaryCard(label="Categories", value=categories, icon="tag"),
        SummaryCard(label="Active Bookings", value=active_bookings, icon="calendar"),
        SummaryCard(label="Pending Requests", value=pending_bookings, icon="clock"),
        SummaryCard(label="Overdue Returns", value=overdue, icon="alert-triangle"),
        SummaryCard(label="Open Maintenance", value=maintenance_open, icon="wrench"),
    ]

    return DashboardSummary(cards=cards)


# ──────────────────────────────────────────────
# Asset Utilization
# ──────────────────────────────────────────────

def get_asset_utilization(db: Session, limit: int = 10) -> AssetUtilizationResponse:
    """Calculate most and least utilized assets based on booking counts."""
    models = db.query(AssetModel).all()

    utilization_data = []
    for model in models:
        bookings = db.query(Booking).filter(
            Booking.asset_model_id == model.id,
            Booking.status.in_(["Issued", "Returned"]),
        ).all()

        total_bookings = len(bookings)
        total_days = 0
        for b in bookings:
            duration = (b.end_date - b.start_date).days
            total_days += duration

        avg_duration = total_days / total_bookings if total_bookings > 0 else 0
        total_units = model.total_units or 1

        # Utilization rate: what percentage of unit-days were booked in the last 90 days
        ninety_days_ago = get_ist_now().date() - timedelta(days=90)
        recent_bookings = [b for b in bookings if b.start_date >= ninety_days_ago]
        recent_days = sum((b.end_date - b.start_date).days * b.quantity for b in recent_bookings)
        max_possible = total_units * 90
        util_rate = (recent_days / max_possible * 100) if max_possible > 0 else 0

        utilization_data.append(AssetUtilizationItem(
            asset_name=model.name,
            category=model.category,
            total_bookings=total_bookings,
            utilization_rate=round(util_rate, 1),
            avg_booking_duration=round(avg_duration, 1),
        ))

    # Sort by utilization rate
    sorted_data = sorted(utilization_data, key=lambda x: x.utilization_rate, reverse=True)

    return AssetUtilizationResponse(
        most_utilized=sorted_data[:limit],
        least_utilized=sorted_data[-limit:][::-1] if len(sorted_data) > limit else sorted_data[::-1],
    )


# ──────────────────────────────────────────────
# Booking Trends (Line Chart)
# ──────────────────────────────────────────────

def get_booking_trends(db: Session, months: int = 12) -> LineChartData:
    """Monthly booking counts for the last N months."""
    labels = []
    values = []

    for i in range(months - 1, -1, -1):
        target_date = get_ist_now().date() - timedelta(days=i * 30)
        month_label = target_date.strftime("%b %Y")
        month_start = target_date.replace(day=1)

        if target_date.month == 12:
            month_end = target_date.replace(year=target_date.year + 1, month=1, day=1)
        else:
            month_end = target_date.replace(month=target_date.month + 1, day=1)

        count = db.query(Booking).filter(
            Booking.created_at >= month_start,
            Booking.created_at < month_end,
        ).count()

        labels.append(month_label)
        values.append(count)

    return LineChartData(
        title="Monthly Booking Trends",
        labels=labels,
        datasets=[{"label": "Bookings", "data": values}],
    )


# ──────────────────────────────────────────────
# Category Distribution (Pie Chart)
# ──────────────────────────────────────────────

def get_category_distribution(db: Session) -> PieChartData:
    """Asset count per category — perfect for a pie chart."""
    results = db.query(
        AssetModel.category,
        func.count(AssetModel.id),
    ).group_by(AssetModel.category).all()

    labels = [r[0] for r in results]
    values = [float(r[1]) for r in results]

    return PieChartData(title="Asset Category Distribution", labels=labels, values=values)


# ──────────────────────────────────────────────
# Maintenance Statistics
# ──────────────────────────────────────────────

def get_maintenance_stats(db: Session) -> MaintenanceStatsResponse:
    """Breakdown of maintenance request statuses and priorities."""
    total = db.query(MaintenanceRequest).count()
    open_count = db.query(MaintenanceRequest).filter(MaintenanceRequest.status == "Open").count()
    in_progress = db.query(MaintenanceRequest).filter(MaintenanceRequest.status == "In Progress").count()
    resolved = db.query(MaintenanceRequest).filter(MaintenanceRequest.status == "Resolved").count()
    closed = db.query(MaintenanceRequest).filter(MaintenanceRequest.status == "Closed").count()

    priority_counts = db.query(
        MaintenanceRequest.priority,
        func.count(MaintenanceRequest.id),
    ).group_by(MaintenanceRequest.priority).all()

    by_priority = [
        ChartDataPoint(label=p[0], value=float(p[1]))
        for p in priority_counts
    ]

    return MaintenanceStatsResponse(
        total_requests=total,
        open=open_count,
        in_progress=in_progress,
        resolved=resolved,
        closed=closed,
        by_priority=by_priority,
    )


# ──────────────────────────────────────────────
# Peak Usage Periods
# ──────────────────────────────────────────────

def get_peak_usage(db: Session) -> BarChartData:
    """Which months have the most bookings — helps plan capacity."""
    results = db.query(
        extract("month", Booking.start_date).label("month"),
        func.count(Booking.booking_id),
    ).group_by("month").order_by("month").all()

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    labels = []
    values = []
    for month_num, count in results:
        month_idx = int(month_num) - 1
        if 0 <= month_idx < 12:
            labels.append(month_names[month_idx])
            values.append(float(count))

    return BarChartData(title="Peak Usage Periods", labels=labels, values=values)


# ──────────────────────────────────────────────
# Heatmaps
# ──────────────────────────────────────────────

def get_bookings_by_day_heatmap(db: Session) -> HeatmapData:
    """
    Heatmap showing booking counts by day of week.
    X-axis: day of week, Y-axis: hour of day (or just counts per day).
    """
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    results = db.query(
        extract("dow", Booking.start_date).label("dow"),
        func.count(Booking.booking_id),
    ).group_by("dow").all()

    # Build counts per day of week
    day_counts = {int(r[0]): float(r[1]) for r in results}

    cells = []
    for i, day_name in enumerate(day_names):
        # PostgreSQL dow: 0=Sunday, 1=Monday, ..., 6=Saturday
        # Remap to Monday=0
        pg_dow = (i + 1) % 7
        count = day_counts.get(pg_dow, 0)
        cells.append(HeatmapCell(x=day_name, y="Bookings", value=count))

    return HeatmapData(
        title="Bookings by Day of Week",
        x_labels=day_names,
        y_labels=["Bookings"],
        cells=cells,
    )


def get_categories_by_month_heatmap(db: Session) -> HeatmapData:
    """
    Heatmap: category × month showing booking density.
    Reveals which categories are popular in which months.
    """
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    # Get all categories
    categories = [r[0] for r in db.query(AssetModel.category).distinct().all()]

    cells = []
    for category in categories:
        # Get models in this category
        model_ids = [m.id for m in db.query(AssetModel).filter(AssetModel.category == category).all()]

        if not model_ids:
            continue

        # Count bookings per month for these models
        results = db.query(
            extract("month", Booking.start_date).label("month"),
            func.count(Booking.booking_id),
        ).filter(
            Booking.asset_model_id.in_(model_ids),
        ).group_by("month").all()

        month_counts = {int(r[0]): float(r[1]) for r in results}

        for month_num in range(1, 13):
            cells.append(HeatmapCell(
                x=month_names[month_num - 1],
                y=category,
                value=month_counts.get(month_num, 0),
            ))

    return HeatmapData(
        title="Category Booking Density by Month",
        x_labels=month_names,
        y_labels=categories,
        cells=cells,
    )


# ──────────────────────────────────────────────
# ML Demand Prediction
# ──────────────────────────────────────────────

def get_demand_prediction(db: Session) -> DemandPredictionResponse:
    """
    Predict future asset demand using a simple linear regression model.
    Uses historical booking data per asset model to forecast the next 3 months.
    """
    try:
        from sklearn.linear_model import LinearRegression
        import numpy as np
    except ImportError:
        # Fallback if scikit-learn isn't available
        return DemandPredictionResponse(predictions=[])

    models = db.query(AssetModel).limit(20).all()  # top 20 models
    predictions = []

    for model in models:
        # Get monthly booking counts for the last 12 months
        monthly_data = []
        for i in range(11, -1, -1):
            target = get_ist_now().date() - timedelta(days=i * 30)
            month_start = target.replace(day=1)
            if target.month == 12:
                month_end = target.replace(year=target.year + 1, month=1, day=1)
            else:
                month_end = target.replace(month=target.month + 1, day=1)

            count = db.query(Booking).filter(
                Booking.asset_model_id == model.id,
                Booking.created_at >= month_start,
                Booking.created_at < month_end,
            ).count()
            monthly_data.append(count)

        # Need at least 3 data points to make a meaningful prediction
        if sum(monthly_data) < 3:
            continue

        # Train a simple linear regression
        X = np.array(range(len(monthly_data))).reshape(-1, 1)
        y = np.array(monthly_data)

        reg = LinearRegression()
        reg.fit(X, y)

        # Predict next 3 months
        future_X = np.array([12, 13, 14]).reshape(-1, 1)
        future_y = reg.predict(future_X)

        # Calculate R² as confidence score
        confidence = max(0, min(1, reg.score(X, y)))

        predicted_points = []
        for j, pred in enumerate(future_y):
            future_date = get_ist_now().date() + timedelta(days=(j + 1) * 30)
            predicted_points.append(ChartDataPoint(
                label=future_date.strftime("%b %Y"),
                value=round(max(0, pred), 1),  # no negative predictions
            ))

        predictions.append(DemandPrediction(
            asset_name=model.name,
            predicted_bookings=predicted_points,
            confidence=round(confidence, 2),
        ))

    # Sort by confidence (most reliable predictions first)
    predictions.sort(key=lambda p: p.confidence, reverse=True)

    return DemandPredictionResponse(predictions=predictions)


# ──────────────────────────────────────────────
# New Analytics Modules
# ──────────────────────────────────────────────

def get_most_booked_assets(db: Session, limit: int = 10) -> BarChartData:
    """Most booked assets by count."""
    results = db.query(
        AssetModel.name,
        func.count(Booking.booking_id).label("total_bookings")
    ).join(
        Booking, Booking.asset_model_id == AssetModel.id
    ).group_by(
        AssetModel.name
    ).order_by(
        func.count(Booking.booking_id).desc()
    ).limit(limit).all()

    labels = [r[0] for r in results]
    values = [float(r[1]) for r in results]

    return BarChartData(title="Most Booked Assets", labels=labels, values=values)


def get_most_overdue_users(db: Session, limit: int = 10) -> OverdueUsersResponse:
    """Users with the most overdue bookings (historical and current)."""
    results = db.query(
        User.full_name,
        User.club,
        func.count(Booking.booking_id).label("overdue_count")
    ).join(
        Booking, Booking.user_id == User.id
    ).filter(
        Booking.status == "Overdue"
    ).group_by(
        User.full_name, User.club
    ).order_by(
        func.count(Booking.booking_id).desc()
    ).limit(limit).all()

    users = []
    for r in results:
        users.append(OverdueUserItem(
            user_name=r[0],
            club=r[1],
            overdue_count=r[2]
        ))
    
    return OverdueUsersResponse(users=users)


def get_maintenance_frequency(db: Session, limit: int = 10) -> AssetMaintenanceFrequencyResponse:
    """Asset models that require the most maintenance."""
    results = db.query(
        AssetModel.name,
        func.count(MaintenanceRequest.id).label("maintenance_count")
    ).join(
        AssetUnit, AssetUnit.asset_model_id == AssetModel.id
    ).join(
        MaintenanceRequest, MaintenanceRequest.asset_unit_id == AssetUnit.id
    ).group_by(
        AssetModel.name
    ).order_by(
        func.count(MaintenanceRequest.id).desc()
    ).limit(limit).all()

    assets = []
    for r in results:
        assets.append(AssetMaintenanceFrequencyItem(
            asset_name=r[0],
            total_maintenance_requests=r[1]
        ))
    
    return AssetMaintenanceFrequencyResponse(assets=assets)


def get_club_wise_usage(db: Session) -> ClubUsageResponse:
    """Booking counts grouped by user club."""
    results = db.query(
        User.club,
        func.count(Booking.booking_id).label("total_bookings")
    ).join(
        Booking, Booking.user_id == User.id
    ).filter(
        User.club.isnot(None)
    ).group_by(
        User.club
    ).order_by(
        func.count(Booking.booking_id).desc()
    ).all()

    clubs = []
    for r in results:
        clubs.append(ClubUsageItem(
            club=r[0],
            total_bookings=r[1]
        ))
    
    return ClubUsageResponse(clubs=clubs)


def get_reliability_distribution(db: Session) -> HistogramData:
    """Histogram of user reliability scores."""
    scores = [u.reliability_score for u in db.query(User).all()]
    
    bins = [
        {"min": 0, "max": 50, "label": "0-50", "count": 0},
        {"min": 50, "max": 75, "label": "50-75", "count": 0},
        {"min": 75, "max": 90, "label": "75-90", "count": 0},
        {"min": 90, "max": 100, "label": "90-100", "count": 0},
    ]
    
    for score in scores:
        for b in bins:
            if b["min"] <= score <= b["max"]:
                # To avoid double counting on boundaries, let's refine
                pass

    # A better approach:
    b0_50 = len([s for s in scores if 0 <= s < 50])
    b50_75 = len([s for s in scores if 50 <= s < 75])
    b75_90 = len([s for s in scores if 75 <= s < 90])
    b90_100 = len([s for s in scores if 90 <= s <= 100])
    
    return HistogramData(
        title="Reliability Score Distribution",
        bins=["0-49", "50-74", "75-89", "90-100"],
        counts=[b0_50, b50_75, b75_90, b90_100]
    )


def get_queue_stats(db: Session) -> QueueStatsResponse:
    """Queue usage statistics."""
    waiting = db.query(AssetQueue).filter(AssetQueue.status == "Waiting").count()
    reserved = db.query(AssetQueue).filter(AssetQueue.status == "Reserved").count()
    expired = db.query(AssetQueue).filter(AssetQueue.status == "Expired").count()
    
    results = db.query(
        AssetModel.name,
        func.count(AssetQueue.id).label("queue_count")
    ).join(
        AssetQueue, AssetQueue.asset_model_id == AssetModel.id
    ).filter(
        AssetQueue.status.in_(["Waiting", "Reserved"])
    ).group_by(
        AssetModel.name
    ).order_by(
        func.count(AssetQueue.id).desc()
    ).limit(5).all()

    top_queued = [ChartDataPoint(label=r[0], value=float(r[1])) for r in results]
    
    return QueueStatsResponse(
        total_people_waiting=waiting,
        total_reservations_active=reserved,
        total_reservations_expired=expired,
        most_queued_assets=top_queued
    )
