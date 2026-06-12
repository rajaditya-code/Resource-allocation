"""
Alembic environment configuration.

This file is executed by Alembic for both 'online' and 'offline' migration modes.
It reads the DATABASE_URL from environment variables (not from alembic.ini)
so the same codebase works across all environments.
"""

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Add the project root to sys.path so we can import our app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import Base

# Import ALL models here so Alembic can detect them for autogeneration.
# Without these imports, Alembic won't know about the tables.
from app.auth.models import User, OTPVerification, TokenBlacklist
from app.assets.models import AssetModel, AssetUnit, AssetImage, AssetImageHistory
from app.bookings.models import Booking, BookingUnitAssignment, ReturnPhoto, AssetAssignmentHistory
from app.maintenance.models import MaintenanceRequest, AssetHealthLog
from app.notifications.models import Notification
from app.audit.models import AuditLog
from app.queue.models import AssetQueue
from app.reliability.models import ReliabilityHistory
from app.config import settings

# Alembic Config object
config = context.config

# Set up logging from the config file
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set the target metadata for autogeneration
target_metadata = Base.metadata

# Override the database URL from environment variable
# database_url = os.getenv("DATABASE_URL", config.get_main_option("sqlalchemy.url"))
# config.set_main_option("sqlalchemy.url", database_url)
database_url = settings.DATABASE_URL
config.set_main_option(
    "sqlalchemy.url",
    database_url.replace("%", "%%")
)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — generates SQL without connecting to the database."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode — connects to the database and applies changes."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
