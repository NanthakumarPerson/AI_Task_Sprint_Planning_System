# app/models/project.py
# --------------------------------------------------------------------------------
# Establishes the database model for Projects.
# A Project acts as the root container containing Sprints, Requirements, and Tasks.
# --------------------------------------------------------------------------------

from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Project(TimestampMixin, Base):
    # Maps class to the 'projects' table in SQLite/PostgreSQL
    __tablename__ = "projects"

    # Unique identification number for the project
    id = Column(Integer, primary_key=True, index=True)
    
    # Simple project display name (maximum of 200 characters)
    name = Column(String(200), nullable=False)
    
    # Detailed project scope explanation or summary details
    description = Column(Text, nullable=True)
    
    # References the user account (typically PM) who created and manages this project
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Current project status: defaults to Active. Can be changed to Completed or On Hold
    status = Column(String(20), nullable=False, default="Active")

    # ── Relationships ──────────────────────────────────────────────────────
    
    # Links to the User model representing the project manager/owner
    owner = relationship("User", back_populates="projects_owned", foreign_keys=[owner_id])
    
    # Links to Sprints. Cascade delete ensures deleting a project cleans up its sprints
    sprints = relationship("Sprint", back_populates="project", cascade="all, delete-orphan")
    
    # Links to Requirements. Cleans up requirements automatically upon project deletion
    requirements = relationship("Requirement", back_populates="project", cascade="all, delete-orphan")
    
    # Links to Tasks associated directly with this project
    tasks = relationship("Task", back_populates="project")

    def __repr__(self):
        # Python representation to print friendly identifier when logging
        return f"<Project id={self.id} name={self.name!r} status={self.status}>"
