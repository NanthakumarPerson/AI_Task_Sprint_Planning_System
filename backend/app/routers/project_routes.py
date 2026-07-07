from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.schemas.project_schemas import ProjectCreate
from app.schemas.common import APIResponse
from app.services.project_service import ProjectService

router = APIRouter()


@router.post("", response_model=APIResponse)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),   # Admin or PM only
):
    result = ProjectService.create(db, payload.name, payload.description, current_user.id)
    return APIResponse.ok(data=result.model_dump(), message="Project created.")


@router.get("", response_model=APIResponse)
def list_projects(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = ProjectService.get_all(db)
    return APIResponse.ok(data=[p.model_dump() for p in result])


@router.get("/{project_id}", response_model=APIResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = ProjectService.get_or_404(db, project_id)
    return APIResponse.ok(data=result.model_dump())