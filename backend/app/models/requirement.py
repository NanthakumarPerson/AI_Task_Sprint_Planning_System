# app/models/requirement.py
# --------------------------------------------------------------------------------
# Establishes the database model for product Requirements.
# Requirements serve as inputs for the Google Gemini AI task breakdown generator.
# --------------------------------------------------------------------------------

from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Requirement(TimestampMixin, Base):
    # Maps class to 'requirements' table in database
    __tablename__ = "requirements"

    # Unique identification number for the requirement
    id = Column(Integer, primary_key=True, index=True)
    
    # Points to parent project that owns this requirement record
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    # Clear requirement headline (maximum of 200 characters)
    title = Column(String(200), nullable=False)
    
    # Text content explaining feature scope, constraints, and business logic
    description = Column(Text, nullable=False)
    
    # Priority classification: defaults to medium (low, medium, high, critical)
    priority = Column(String(10), nullable=False, default="medium")
    
    # Status tracking lifecycle: Draft -> Planned -> Done
    status = Column(String(20), nullable=False, default="DRAFT")
    
    # PM defined checklist that must be met to mark feature as completed
    acceptance_criteria = Column(Text, nullable=True)
    
    # References the user account (PM) who created this requirement record
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # ── Relationships ──────────────────────────────────────────────────────
    
    # Links to the project parent model
    project = relationship("Project", back_populates="requirements")
    
    # Links to the user profile representing the creating Project Manager
    creator = relationship("User", back_populates="requirements_created")
    
    # Links to tasks generated from or linked to this requirement
    tasks = relationship("Task", back_populates="requirement")
    
    # Links to Gemini AI suggestions history. Cascade deletes logs if requirement is deleted
    ai_suggestions = relationship(
        "AITaskSuggestion", back_populates="requirement", cascade="all, delete-orphan"
    )

    def __repr__(self):
        # Python representation to print friendly identifier when logging
        return f"<Requirement id={self.id} title={self.title!r}>"
