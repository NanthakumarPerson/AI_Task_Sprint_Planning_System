# app/schemas/requirement_schemas.py
# --------------------------------------------------------------------------------
# Defines Pydantic validation schemas for Requirement records.
# Ensures clean validation when parsing JSON requests and serializing responses.
# --------------------------------------------------------------------------------

from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

# Set of allowed priority classifications
VALID_PRIORITIES = {"low", "medium", "high", "critical"}


class RequirementCreate(BaseModel):
    """Schema representing JSON payload required to create a new requirement."""
    project_id: int
    title: str
    description: str
    priority: str
    acceptance_criteria: Optional[str] = None

    @field_validator("title")
    @classmethod
    def title_valid(cls, v: str) -> str:
        """Sanitizes text and verifies requirement title length constraints."""
        v = v.strip()
        if not v:
            raise ValueError("Requirement title is required.")
        if len(v) > 200:
            raise ValueError("Title must be under 200 characters.")
        return v

    @field_validator("description")
    @classmethod
    def description_valid(cls, v: str) -> str:
        """Ensures the description details cannot be blank."""
        v = v.strip()
        if not v:
            raise ValueError("Requirement description is required.")
        return v

    @field_validator("priority")
    @classmethod
    def priority_valid(cls, v: str) -> str:
        """Enforces that the priority matches allowed types."""
        if v not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}")
        return v


class RequirementStatusUpdate(BaseModel):
    """Schema validating status updates for a requirement."""
    status: str

    @field_validator("status")
    @classmethod
    def status_valid(cls, v: str) -> str:
        """Limits updates to standard workflow states."""
        if v not in {"DRAFT", "TASKS_CREATED"}:
            raise ValueError("Invalid status")
        return v


class RequirementUpdate(BaseModel):
    """Schema representing JSON payload required to update an existing requirement."""
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    acceptance_criteria: Optional[str] = None

    @field_validator("title")
    @classmethod
    def title_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Requirement title is required.")
        if len(v) > 200:
            raise ValueError("Title must be under 200 characters.")
        return v

    @field_validator("description")
    @classmethod
    def description_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Requirement description is required.")
        return v

    @field_validator("priority")
    @classmethod
    def priority_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}")
        return v


class RequirementOut(BaseModel):
    """Schema detailing output serialized values returned by endpoints."""
    id: int
    project_id: int
    title: str
    description: str
    priority: str
    status: str
    acceptance_criteria: Optional[str]
    created_by: int
    created_at: datetime
    updated_at: datetime

    # Instructs Pydantic to read parameters directly from SQLAlchemy object attributes
    model_config = {"from_attributes": True}
