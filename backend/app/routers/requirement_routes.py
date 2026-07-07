"""
app/routers/requirement_routes.py
-----------------------------------
Requirements API — PM/Admin only for create; any authenticated user can read.

Routes:
  POST   /requirements                     → Create a new requirement
  GET    /requirements?project_id={id}     → List requirements for a project
  GET    /requirements/{req_id}            → Get a single requirement
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.schemas.requirement_schemas import RequirementCreate, RequirementStatusUpdate, RequirementUpdate
from app.schemas.common import APIResponse
from app.services.requirement_service import RequirementService

router = APIRouter()


@router.post("", response_model=APIResponse)
def create_requirement(
    payload: RequirementCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),   # Admin (1) or PM (2)
):
    result = RequirementService.create(
        db,
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        acceptance_criteria=payload.acceptance_criteria,
        created_by=current_user.id,
    )
    return APIResponse.ok(data=result.model_dump(), message="Requirement saved.")


@router.get("", response_model=APIResponse)
def list_requirements(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if project_id:
        results = RequirementService.get_by_project(db, project_id)
    else:
        results = []
    return APIResponse.ok(data=[r.model_dump() for r in results])


@router.get("/{req_id}", response_model=APIResponse)
def get_requirement(
    req_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = RequirementService.get_or_404(db, req_id)
    return APIResponse.ok(data=result.model_dump())


@router.patch("/{req_id}/status", response_model=APIResponse)
def update_requirement_status(
    req_id: int,
    payload: RequirementStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),
):
    result = RequirementService.update_status(db, req_id, payload.status)
    return APIResponse.ok(data=result.model_dump(), message=f"Requirement status updated to {payload.status}.")


@router.put("/{req_id}", response_model=APIResponse)
def update_requirement(
    req_id: int,
    payload: RequirementUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),   # Admin (1) or PM (2)
):
    result = RequirementService.update(
        db,
        req_id=req_id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        acceptance_criteria=payload.acceptance_criteria,
    )
    return APIResponse.ok(data=result.model_dump(), message="Requirement updated.")


@router.delete("/{req_id}", response_model=APIResponse)
def delete_requirement(
    req_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),   # Admin (1) or PM (2)
):
    RequirementService.delete(db, req_id)
    return APIResponse.ok(message="Requirement deleted.")
