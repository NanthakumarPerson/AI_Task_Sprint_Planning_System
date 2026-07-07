from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories import requirement_repo
from app.schemas.requirement_schemas import RequirementOut


class RequirementService:

    @staticmethod
    def create(
        db: Session,
        project_id: int,
        title: str,
        description: str,
        priority: str,
        acceptance_criteria: str | None,
        created_by: int,
    ) -> RequirementOut:
        req = requirement_repo.create_requirement(
            db, project_id, title, description, priority, acceptance_criteria, created_by
        )
        return RequirementOut.model_validate(req)

    @staticmethod
    def get_or_404(db: Session, req_id: int) -> RequirementOut:
        req = requirement_repo.get_requirement_by_id(db, req_id)
        if not req:
            raise HTTPException(status_code=404, detail="Requirement not found.")
        return RequirementOut.model_validate(req)

    @staticmethod
    def get_by_project(db: Session, project_id: int) -> list[RequirementOut]:
        reqs = requirement_repo.get_requirements_by_project(db, project_id)
        return [RequirementOut.model_validate(r) for r in reqs]

    @staticmethod
    def update_status(db: Session, req_id: int, status: str) -> RequirementOut:
        req = requirement_repo.get_requirement_by_id(db, req_id)
        if not req:
            raise HTTPException(status_code=404, detail="Requirement not found.")
        updated_req = requirement_repo.update_requirement_status(db, req, status)
        return RequirementOut.model_validate(updated_req)

    @staticmethod
    def update(
        db: Session,
        req_id: int,
        title: str | None = None,
        description: str | None = None,
        priority: str | None = None,
        acceptance_criteria: str | None = None,
    ) -> RequirementOut:
        req = requirement_repo.get_requirement_by_id(db, req_id)
        if not req:
            raise HTTPException(status_code=404, detail="Requirement not found.")
        updated_req = requirement_repo.update_requirement(
            db, req, title=title, description=description, priority=priority, acceptance_criteria=acceptance_criteria
        )
        return RequirementOut.model_validate(updated_req)

    @staticmethod
    def delete(db: Session, req_id: int) -> None:
        req = requirement_repo.get_requirement_by_id(db, req_id)
        if not req:
            raise HTTPException(status_code=404, detail="Requirement not found.")
        requirement_repo.delete_requirement(db, req)
