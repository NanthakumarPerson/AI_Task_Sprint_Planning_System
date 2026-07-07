# app/models/sprint.py
# --------------------------------------------------------------------------------
# Establishes the database model for Sprints.
# A Sprint belongs to a project and represents a fixed-time development loop.
# --------------------------------------------------------------------------------

from sqlalchemy import Column, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Sprint(TimestampMixin, Base):
    # Maps class to 'sprints' table in database
    __tablename__ = "sprints"

    # Unique identification number for the sprint cycle
    id         = Column(Integer, primary_key=True, index=True)
    
    # Points to parent project that owns this sprint cycle
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    # Display name for the sprint (e.g., 'Sprint 1', 'Release Milestone Alpha')
    name       = Column(String(100), nullable=False)
    
    # Text explanation of the target objective/milestone for the sprint
    goal       = Column(Text, nullable=True)
    
    # Start date of the sprint cycle (used for active status validity checks)
    start_date = Column(Date, nullable=False)
    
    # End date of the sprint cycle (used to calculate delays/sprint end warnings)
    end_date   = Column(Date, nullable=False)
    
    # Current status: planning -> active -> completed (or cancelled)
    status     = Column(String(20), nullable=False, default="planning")

    # ── Relationships ──────────────────────────────────────────────────────
    
    # Links to the project parent model
    project = relationship("Project", back_populates="sprints")
    
    # Links to tasks scheduled under this sprint
    tasks   = relationship("Task",    back_populates="sprint")

    def __repr__(self):
        # Python representation to print friendly identifier when logging
        return f"<Sprint id={self.id} name={self.name!r} status={self.status}>"
