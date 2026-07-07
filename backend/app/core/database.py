"""
app/core/database.py
---------------------
This file sets up SQLAlchemy (the ORM) to connect your FastAPI app to the PostgreSQL database.

SQLAlchemy setup:
  - engine        : single connection pool to PostgreSQL
  - SessionLocal  : factory that creates one DB session per request
  - Base          : all models inherit from this — Alembic reads it to generate migrations
  - get_db()      : FastAPI dependency — yields a session and always closes it when the
                    request is done (even on errors)
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
# pool_pre_ping=True tells SQLAlchemy to check the connection is alive before
# using it — prevents "server closed connection" errors after idle periods.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,  #keeps 10 open connections ready to use
    max_overflow=20,
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
# autocommit=False  → we call session.commit() explicitly in services
# autoflush=False   → prevents surprise flushes mid-transaction
SessionLocal = sessionmaker( #A factory used to create individual database transaction sessions.
    bind=engine,
    autocommit=False,
    autoflush=False,
)

# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------
# All SQLAlchemy model classes inherit from Base.
# Alembic's env.py imports Base.metadata to detect schema changes.
Base = declarative_base()


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------
def get_db():
    """
    Yields a SQLAlchemy session and guarantees it is closed after each request.

    Usage in a router:
        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
