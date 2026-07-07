from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import project_repo
from app.schemas.project_schemas import ProjectOut


class ProjectService:

    @staticmethod
    def create(db: Session, name: str, description: str | None, owner_id: int) -> ProjectOut:
        project = project_repo.create_project(db, name, description, owner_id)
        return ProjectOut.model_validate(project)

    @staticmethod
    def get_all(db: Session) -> list[ProjectOut]:
        projects = project_repo.get_all_projects(db)
        return [ProjectOut.model_validate(p) for p in projects]

    @staticmethod
    def get_or_404(db: Session, project_id: int) -> ProjectOut:
        project = project_repo.get_project_by_id(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found.")
        return ProjectOut.model_validate(project)