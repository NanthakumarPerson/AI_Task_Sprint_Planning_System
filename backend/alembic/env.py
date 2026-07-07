"""
alembic/env.py
---------------
Alembic migration environment.

Key things this file does:
1. Reads DATABASE_URL from .env via app.core.config.settings
   → no hardcoded connection strings here.
2. Imports all models via `from app.models import *`
   → Alembic compares Base.metadata against the live DB to detect changes.
3. Runs migrations in "offline" mode (SQL script) or "online" mode (live connection).

Commands you will use during development:
    # Generate a new migration after changing a model:
    alembic revision --autogenerate -m "your description here"

    # Apply all pending migrations:
    alembic upgrade head

    # Roll back the last migration:
    alembic downgrade -1
"""

import os
import sys
from logging.config import fileConfig # to fetch the real DATABASE_URL stored in your environment (.env).

from sqlalchemy import create_engine, pool
from alembic import context

# Make sure `app` is importable from the project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Import settings and all models ──────────────────────────────────────────
from app.core.config import settings      # reads .env
from app.core.database import Base        # declarative base
import app.models                         # registers all models on Base.metadata  # noqa: F401

# Alembic config object
config = context.config

# Override the sqlalchemy.url from alembic.ini with the real value from .env
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Set up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

#This object tells Alembic what the tables should look like according to your Python code.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Offline mode: generate SQL script without a live DB connection.
    Useful for reviewing migrations before applying them.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Online mode: apply migrations against a live DB connection.
    This is the mode used by `alembic upgrade head`.

    FIX: We use create_engine(settings.DATABASE_URL) directly instead of
    engine_from_config() — because engine_from_config reads from alembic.ini
    which only has a placeholder URL. set_main_option() does NOT reliably
    propagate into get_section(), so the real DATABASE_URL from .env was
    being ignored, causing the password authentication failure.
    """
    connectable = create_engine(
        settings.DATABASE_URL,
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
