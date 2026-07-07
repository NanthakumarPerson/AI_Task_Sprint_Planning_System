from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Project name is required.")
        if len(v) > 200:
            raise ValueError("Project name must be under 200 characters.")
        return v


class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: str
    owner_id: int
    created_at: datetime

    model_config = {"from_attributes": True}