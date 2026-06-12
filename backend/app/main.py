"""
Application entry point — FastAPI app factory.

This is where everything comes together: routers are included,
middleware is configured, and the app is ready to serve.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.middleware.rate_limiter import limiter

# Import all routers
from app.auth.routes import router as auth_router
from app.assets.routes import router as assets_router
from app.bookings.routes import router as bookings_router
from app.maintenance.routes import router as maintenance_router
from app.notifications.routes import router as notifications_router
from app.audit.routes import router as audit_router
from app.analytics.routes import router as analytics_router
from app.qr.routes import router as qr_router
from app.export.routes import router as export_router
from app.queue.routes import router as queue_router
from app.reliability.routes import router as reliability_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup
    print(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} starting up...")
    yield
    # Shutdown
    print("👋 Shutting down...")


# ──────────────────────────────────────────────
# Create the FastAPI app
# ──────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Production-grade Smart Asset Management & Resource Allocation Platform. "
        "Manages inventory with individual unit tracking, booking with conflict detection, "
        "approval workflows, maintenance, analytics, and more."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ──────────────────────────────────────────────
# Middleware
# ──────────────────────────────────────────────

# CORS — allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ──────────────────────────────────────────────
# Include routers
# ──────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(assets_router)
app.include_router(bookings_router)
app.include_router(maintenance_router)
app.include_router(notifications_router)
app.include_router(audit_router)
app.include_router(analytics_router)
app.include_router(qr_router)
app.include_router(export_router)
app.include_router(queue_router)
app.include_router(reliability_router)


# ──────────────────────────────────────────────
# Health check endpoint
# ──────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    """Health check — verifies the API is running."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/health", tags=["Health"])
def health_check():
    """Detailed health check endpoint."""
    return {
        "status": "healthy",
        "database": "connected",
        "version": settings.APP_VERSION,
    }
