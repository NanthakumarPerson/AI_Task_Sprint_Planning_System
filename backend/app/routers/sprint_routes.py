# app/routers/sprint_routes.py
# --------------------------------------------------------------------------------
# Routing controller for all Sprint-related API endpoints.
# Exposes routes to list, create, update, complete, and compile sprint reports.
# Enforces role restrictions (mostly PM/Admin only) using require_role dependency.
# --------------------------------------------------------------------------------

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.sprint import Sprint
from app.repositories.sprint_repo import get_sprint_by_id, get_sprints_by_project
from app.schemas.sprint_schemas import SprintCreate, SprintOut, SprintUpdate, CompleteSprintRequest
from app.schemas.common import APIResponse
from app.services.sprint_service import SprintService
from app.services.task_service import TaskService

# Create router instance
router = APIRouter()


@router.get("", response_model=APIResponse)
def list_sprints(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    GET /sprints
    Returns all sprints, optionally filtered by project_id query parameter.
    """
    if project_id:
        sprints = get_sprints_by_project(db, project_id)
    else:
        sprints = db.query(Sprint).all()
    # Serialize sprints database list to SprintOut schema list
    return APIResponse.ok(data=[SprintOut.model_validate(s).model_dump() for s in sprints])


@router.get("/my-sprints", response_model=APIResponse)
def get_my_sprints(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    GET /sprints/my-sprints
    Returns sprints that contain tasks assigned to the logged-in user.
    """
    sprints = SprintService.get_my_sprints(db, current_user.id)
    return APIResponse.ok(data=[s.model_dump() for s in sprints])


@router.post("", response_model=APIResponse)
def create_sprint(
    payload: SprintCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),  # Gated to PM/Admin roles
):
    """
    POST /sprints
    Creates a new sprint cycle in 'planning' state after running date checks.
    """
    result = SprintService.create(
        db,
        payload.project_id,
        payload.name,
        payload.goal,
        payload.start_date,
        payload.end_date,
    )
    return APIResponse.ok(data=result.model_dump(), message="Sprint created.")


@router.get("/{sprint_id}", response_model=APIResponse)
def get_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    GET /sprints/{sprint_id}
    Retrieves detailed attributes of a single sprint by ID.
    """
    sprint = get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found.")
    return APIResponse.ok(data=SprintOut.model_validate(sprint).model_dump())


@router.put("/{sprint_id}", response_model=APIResponse)
def update_sprint(
    sprint_id: int,
    payload: SprintUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),  # Gated to PM/Admin roles
):
    """
    PUT /sprints/{sprint_id}
    Modifies sprint details. Locked properties are checked by the service layer.
    """
    result = SprintService.update_sprint(db, sprint_id, payload.model_dump())
    return APIResponse.ok(data=result.model_dump(), message="Sprint updated.")


@router.patch("/{sprint_id}/complete", response_model=APIResponse)
def complete_sprint(
    sprint_id: int,
    payload: CompleteSprintRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),  # Gated to PM/Admin roles
):
    """
    PATCH /sprints/{sprint_id}/complete
    Completes an active sprint and shifts unfinished tasks to backlog if requested.
    """
    result = SprintService.complete_sprint(db, sprint_id, payload.move_unfinished_to_backlog)
    return APIResponse.ok(data=result.model_dump(), message="Sprint completed.")


@router.patch("/{sprint_id}/cancel", response_model=APIResponse)
def cancel_sprint(
    sprint_id: int,
    payload: CompleteSprintRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),  # Gated to PM/Admin roles
):
    """
    PATCH /sprints/{sprint_id}/cancel
    Cancels a sprint and redirects active tasks back to the backlog if requested.
    """
    result = SprintService.cancel_sprint(db, sprint_id, payload.move_unfinished_to_backlog)
    return APIResponse.ok(data=result.model_dump(), message="Sprint cancelled.")


@router.patch("/{sprint_id}/start", response_model=APIResponse)
def start_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),  # Gated to PM/Admin roles
):
    """
    PATCH /sprints/{sprint_id}/start
    Starts a planning sprint, changing status to 'active'.
    """
    result = SprintService.start_sprint(db, sprint_id)
    return APIResponse.ok(data=result.model_dump(), message="Sprint started.")


@router.get("/{sprint_id}/report", response_model=APIResponse)
def sprint_report(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),   # Allowed for any authenticated user
):
    """
    GET /sprints/{sprint_id}/report
    Compiles summary velocity, workload breakdown, and status counts for reports.
    """
    result = TaskService.get_sprint_report(db, sprint_id)
    return APIResponse.ok(data=result)