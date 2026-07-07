"""
app/schemas/task_schemas.py
----------------------------
Pydantic v2 schemas for task CRUD.

Enums used (must match DB values exactly):
  task_type : development | testing | bug | documentation
  priority  : low | medium | high | critical
  status    : TODO | IN_PROGRESS | IN_REVIEW | DONE
"""

from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, datetime


VALID_TASK_TYPES = {"development", "testing", "bug", "documentation"}
VALID_PRIORITIES = {"low", "medium", "high", "critical"}
VALID_STATUSES   = {"TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"}

class TaskReassign(BaseModel):
    assignee_id: Optional[int]

class TaskCommentCreate(BaseModel):
    comment: str

class TaskUpdate(BaseModel):
    title:           Optional[str]   = None
    description:     Optional[str]   = None
    task_type:       Optional[str]   = None
    priority:        Optional[str]   = None
    assignee_id:     Optional[int]   = None
    due_date:        Optional[date]  = None
    estimated_hours: Optional[float] = None
    status:          Optional[str]   = None
    sprint_id:       Optional[int]   = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Task title cannot be empty.")
            if len(v) > 250:
                raise ValueError("Task title must be under 250 characters.")
        return v

    @field_validator("task_type")
    @classmethod
    def valid_task_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_TASK_TYPES:
            raise ValueError(f"task_type must be one of: {', '.join(sorted(VALID_TASK_TYPES))}")
        return v

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}")
        return v

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v

class TaskCreateSingle(BaseModel):
    """
    Input validation model for creating a single task.
    This schema dictates exactly what fields must/can be sent by the frontend React client
    during task creation. Pydantic automatically parses types and handles validation.
    """
    sprint_id:       Optional[int]  = None   # Optional. If None, task sits in the backlog.
    project_id:      int                    # Required. References the parent Project table ID.
    title:           str                    # Required. Task name.
    description:     Optional[str]   = None  # Optional markdown/text details.
    task_type:       str                    # Required. E.g., 'feature', 'bug', 'story', 'task'.
    priority:        str                    # Required. E.g., 'low', 'medium', 'high', 'critical'.
    assignee_id:     Optional[int]   = None  # Optional user database ID.
    due_date:        Optional[date]  = None  # Optional due date validation.
    estimated_hours: Optional[float] = None  # Optional timing estimates.
    requirement_id:  Optional[int]   = None  # Optional link to parent requirement.

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        """Sanitizes whitespace and checks length limits for the task title."""
        v = v.strip()
        if not v:
            raise ValueError("Task title is required.")
        if len(v) > 250:
            raise ValueError("Task title must be under 250 characters.")
        return v

    @field_validator("task_type")
    @classmethod
    def valid_task_type(cls, v: str) -> str:
        """Validates that the task type is within the globally configured options."""
        if v not in VALID_TASK_TYPES:
            raise ValueError(f"task_type must be one of: {', '.join(sorted(VALID_TASK_TYPES))}")
        return v

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, v: str) -> str:
        if v not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}")
        return v


# ── Legacy bulk create (kept to not break CreateRequirementPage) ────────────
class TaskCreate(BaseModel):
    sprint_id:       Optional[int]   = None
    requirement_id:  Optional[int]   = None
    project_id:      int
    title:           str
    description:     Optional[str]   = None
    task_type:       str
    priority:        str
    effort_points:   Optional[int]   = None
    estimated_hours: Optional[float] = None
    due_date:        Optional[date]  = None
    acceptance_criteria: Optional[str] = None
    risk_notes:      Optional[str]   = None
    assignee_id:     Optional[int]   = None


class TaskBulkCreate(BaseModel):
    tasks: list[TaskCreate]


# ── Status update ────────────────────────────────────────────────────────────
class TaskStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v


# ── Output schema ────────────────────────────────────────────────────────────
class TaskOut(BaseModel):
    id:              int
    task_key:        str              = ""   # computed: TASK-{id}
    project_id:      int
    sprint_id:       Optional[int]
    requirement_id:  Optional[int]
    title:           str
    description:     Optional[str]
    task_type:       str
    priority:        str
    status:          str
    assignee_id:     Optional[int]
    created_by:      Optional[int]
    due_date:        Optional[date]
    estimated_hours: Optional[float]
    effort_points:   Optional[int]
    acceptance_criteria: Optional[str]
    risk_notes:      Optional[str]
    created_at:      datetime
    updated_at:      datetime

    # Enriched fields (joined from other tables by repo layer)
    assignee_name:  Optional[str] = None
    sprint_name:    Optional[str] = None
    project_name:   Optional[str] = None

    model_config = {"from_attributes": True}