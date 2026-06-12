"""
Database setup — SQLAlchemy engine, session factory, and declarative base.

We use synchronous SQLAlchemy here because it's simpler, more widely
compatible, and perfectly fine for a Render deployment.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# Create the engine — the connection pool to PostgreSQL
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"options": "-c timezone=Asia/Kolkata"}, # Force DB session to IST so backend time isn't GMT
    pool_pre_ping=True,      # verify connections are alive before using them
    pool_size=10,             # keep 10 connections in the pool
    max_overflow=20,          # allow up to 20 extra connections under load
    echo=settings.DEBUG,      # log SQL statements in debug mode
)

# Session factory — each request gets its own session
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Base class for all SQLAlchemy models
Base = declarative_base()
