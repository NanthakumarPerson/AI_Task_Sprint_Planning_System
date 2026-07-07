# app/models/mixins.py
# --------------------------------------------------------------------------------
# Defines reusable database columns (mixins) to avoid repeating timestamp columns.
# Add TimestampMixin to any model class to automatically track creation and edits.
# --------------------------------------------------------------------------------

from sqlalchemy import Column, DateTime
from sqlalchemy.sql import func


class TimestampMixin:
    # Records date & time when the row is first created; defaults to current database time
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    
    # Records date & time of the latest update; automatically sets to current time on changes
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
