"""
app/schemas/sprint_schemas.py
"""
from pydantic import BaseModel, field_validator, model_validator
from datetime import date, datetime
from typing import Optional


VALID_SPRINT_STATUSES = {"planning", "active", "completed", "cancelled"}


class SprintCreate(BaseModel):
    project_id: int
    name:       str
    goal:       Optional[str] = None
    start_date: date
    end_date:   date

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Sprint name is required.")
        return v

    @model_validator(mode="after")
    def end_after_start(self) -> "SprintCreate":
        if self.end_date <= self.start_date:
            raise ValueError("Sprint end date must be after the start date.")
        return self


class SprintOut(BaseModel):
    id:         int
    project_id: int
    name:       str
    goal:       Optional[str]
    start_date: date
    end_date:   date
    status:     str

    model_config = {"from_attributes": True}


class SprintUpdate(BaseModel):
    name:       Optional[str] = None
    goal:       Optional[str] = None
    start_date: Optional[date] = None
    end_date:   Optional[date] = None
    project_id: Optional[int] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Sprint name cannot be empty.")
        return v

class CompleteSprintRequest(BaseModel):
    move_unfinished_to_backlog: bool = False