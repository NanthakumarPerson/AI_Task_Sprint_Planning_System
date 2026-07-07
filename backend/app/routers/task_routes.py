# app/routers/task_routes.py
# --------------------------------------------------------------------------------
# Routing controller for all Task-related API endpoints.
# This router defines endpoints for creating, retrieving, updating status,
# deleting, and commenting on tasks. It uses FastAPI dependencies to handle
# database session loading and JWT authentication / role verification.
# --------------------------------------------------------------------------------

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.repositories import task_repo
from app.schemas.task_schemas import (
    TaskCreateSingle,
    TaskBulkCreate,
    TaskStatusUpdate,
    TaskUpdate,
    TaskReassign,
    TaskCommentCreate,
)
from app.schemas.common import APIResponse
from app.services.task_service import TaskService


# ── AssignSprintPayload (Request schema) ──────────────────────────────────────
# Exclusively used by the `/tasks/{task_id}/assign-sprint` route to validate that
# the client sends a JSON body containing a valid integer `sprint_id`.
# ──────────────────────────────────────────────────────────────────────────────
class AssignSprintPayload(BaseModel):
    sprint_id: int


# APIRouter groups all these routes under a clean FastAPI namespace
router = APIRouter()


@router.post("/single", response_model=APIResponse)
def create_single_task(
    payload: TaskCreateSingle,
    db: Session = Depends(get_db),                # Injects the active SQLite database transaction session
    current_user=Depends(require_role(1, 2)),   # Security Guard: Only Admin (1) or PM (2) can execute this route
):
    """
    POST /tasks/single
    Creates a new standalone task. The parent sprint must be in 'planning' status.
    """
    task_data = payload.model_dump()
    result = TaskService.create_single(db, task_data, current_user)
    return APIResponse.ok(
        data=result.model_dump(),
        message="Task created.",
    )


@router.post("", response_model=APIResponse)
def bulk_create_tasks(
    payload: TaskBulkCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(2)),   # Security Guard: Only PM (2) can perform bulk imports
):
    """
    POST /tasks
    Performs a bulk creation of tasks. Used during requirements decomposition or imports.
    """
    tasks_data = [t.model_dump() for t in payload.tasks]
    result = TaskService.bulk_create(db, tasks_data)
    return APIResponse.ok(
        data={"tasks": [t.model_dump() for t in result]},
        message=f"{len(result)} tasks created.",
    )


@router.get("/my-tasks", response_model=APIResponse)
def get_my_tasks(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),     # Injects user details parsed from their JWT bearer token
):
    """
    GET /tasks/my-tasks
    Returns a list of all tasks assigned to the currently logged-in user.
    """
    tasks = TaskService.get_my_tasks(db, current_user)
    return APIResponse.ok(data={"tasks": tasks})


@router.get("/by-sprint/{sprint_id}/my-tasks", response_model=APIResponse)
def get_my_tasks_by_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    GET /tasks/by-sprint/{sprint_id}/my-tasks
    Filters tasks assigned to the logged-in user restricted to a single sprint.
    """
    tasks = TaskService.get_my_tasks_by_sprint(db, sprint_id, current_user)
    return APIResponse.ok(data={"tasks": tasks})


@router.get("/by-sprint/{sprint_id}", response_model=APIResponse)
def get_tasks_by_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    GET /tasks/by-sprint/{sprint_id}
    Retrieves all tasks associated with a given sprint ID, regardless of who is assigned.
    """
    tasks = TaskService.get_by_sprint(db, sprint_id)
    return APIResponse.ok(data={"tasks": tasks})


@router.get("/backlog", response_model=APIResponse)
def get_backlog_tasks(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    GET /tasks/backlog
    Returns all tasks that are currently unassigned to any sprint (sprint_id is NULL).
    """
    tasks = TaskService.get_backlog_tasks(db, current_user)
    return APIResponse.ok(data={"tasks": tasks})


@router.get("", response_model=APIResponse)
def list_tasks(
    sprint_id: int = Query(..., description="Required — filters tasks by sprint"),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    GET /tasks
    Fetches filtered, paginated tasks for a given sprint ID.
    Enforces role visibility bounds: Developers only see their tasks,
    Testers see their tasks OR tasks under 'IN_REVIEW' state.
    """
    result = TaskService.get_filtered(db, sprint_id, status, priority, assignee_id, page, limit, current_user)
    return APIResponse.ok(data=result)


@router.patch("/{task_id}/status", response_model=APIResponse)
def update_task_status(
    task_id: int,
    payload: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    PATCH /tasks/{task_id}/status
    Updates a task's status (To Do, In Progress, Review, Done).
    This path enforces strict role permissions and logical transition validation 
    (e.g., must step forward sequentially, developers can only modify their own tasks).
    """
    result = TaskService.update_status(
        db, task_id, payload.status, current_user
    )
    return APIResponse.ok(
        data={"id": result.id, "status": result.status, "updated_at": str(result.updated_at)},
        message="Task status updated.",
    )


@router.put("/{task_id}", response_model=APIResponse)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),
):
    """
    PUT /tasks/{task_id}
    Updates details (title, description, points) of an existing task.
    Allowed for Project Managers (2) and Admins (1) only.
    """
    result = TaskService.update_task(db, task_id, payload.model_dump(exclude_unset=True), current_user)
    return APIResponse.ok(data=result.model_dump(), message="Task updated.")


@router.patch("/{task_id}/assignee", response_model=APIResponse)
def reassign_task(
    task_id: int,
    payload: TaskReassign,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),
):
    """
    PATCH /tasks/{task_id}/assignee
    Reassigns a task to a different user. PM/Admin only.
    """
    result = TaskService.reassign_task(db, task_id, payload.assignee_id, current_user)
    return APIResponse.ok(data=result.model_dump(), message="Task reassigned.")


@router.delete("/{task_id}", response_model=APIResponse)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),
):
    """
    DELETE /tasks/{task_id}
    Performs a soft delete on a task by toggling `is_deleted = True`. PM/Admin only.
    """
    TaskService.delete_task(db, task_id, current_user)
    return APIResponse.ok(data=None, message="Task deleted.")


@router.patch("/{task_id}/assign-sprint", response_model=APIResponse)
def assign_sprint(
    task_id: int,
    payload: AssignSprintPayload,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),
):
    """
    PATCH /tasks/{task_id}/assign-sprint
    Moves a backlog task into a sprint planning cycle. PM/Admin only.
    """
    result = TaskService.assign_sprint(db, task_id, payload.sprint_id, current_user)
    return APIResponse.ok(data=result.model_dump(), message="Task assigned to sprint.")


@router.patch("/{task_id}/remove-from-sprint", response_model=APIResponse)
def remove_task_from_sprint(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),
):
    """
    PATCH /tasks/{task_id}/remove-from-sprint
    Removes a task from a sprint, returning it to the project backlog. PM/Admin only.
    """
    result = TaskService.remove_from_sprint(db, task_id, current_user)
    return APIResponse.ok(data=result.model_dump(), message="Task removed from sprint.")


@router.post("/{task_id}/comments", response_model=APIResponse)
def add_task_comment(
    task_id: int,
    payload: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    POST /tasks/{task_id}/comments
    Appends a new progress comment/note to a task.
    Developers and Testers can only comment on tasks explicitly assigned to them.
    PMs and Admins can comment globally.
    """
    # 1. Fetch task model from database
    task = task_repo.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # 2. Enforce Developer (3) / Tester (4) validation checks
    if current_user.role_id in (3, 4) and task.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only add notes to tasks assigned to you.")

    # 3. Save comment into database
    comment = task_repo.add_task_comment(db, task_id, current_user.id, payload.comment)

    # 4. Return serialized comment data back to frontend
    return APIResponse.ok(
        data={"id": comment.id, "comment": comment.comment, "created_at": str(comment.created_at)},
        message="Progress note added.",
    )