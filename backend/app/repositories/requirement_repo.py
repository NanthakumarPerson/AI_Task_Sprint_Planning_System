# app/repositories/requirement_repo.py
# --------------------------------------------------------------------------------
# Handles database queries and mutations for Requirements.
# --------------------------------------------------------------------------------

from sqlalchemy.orm import Session
from app.models.requirement import Requirement


def create_requirement(
    db: Session,
    project_id: int,
    title: str,
    description: str,
    priority: str,
    acceptance_criteria: str | None,
    created_by: int,
    status: str = "DRAFT",
) -> Requirement:
    """Inserts a new feature requirement record mapped to a parent project."""
    req = Requirement(
        project_id=project_id,
        title=title,
        description=description,
        priority=priority,
        status=status,
        acceptance_criteria=acceptance_criteria,
        created_by=created_by,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def update_requirement_status(db: Session, req: Requirement, status: str) -> Requirement:
    """Updates the status (Draft, Planned, Done) of a requirement."""
    req.status = status
    db.commit()
    db.refresh(req)
    return req


def get_requirement_by_id(db: Session, req_id: int) -> Requirement | None:
    """Queries a single requirement record by database ID."""
    return db.query(Requirement).filter(Requirement.id == req_id).first()


def get_requirements_by_project(db: Session, project_id: int) -> list[Requirement]:
    """Retrieves all requirements assigned to a project, newest first."""
    return (
        db.query(Requirement)
        .filter(Requirement.project_id == project_id)
        .order_by(Requirement.created_at.desc())
        .all()
    )


def update_requirement(
    db: Session,
    req: Requirement,
    title: str | None = None,
    description: str | None = None,
    priority: str | None = None,
    acceptance_criteria: str | None = None,
) -> Requirement:
    """Updates fields of an existing requirement."""
    if title is not None:
        req.title = title
    if description is not None:
        req.description = description
    if priority is not None:
        req.priority = priority
    if acceptance_criteria is not None:
        req.acceptance_criteria = acceptance_criteria
    db.commit()
    db.refresh(req)
    return req


def delete_requirement(db: Session, req: Requirement) -> None:
    """Deletes a requirement from the database and disassociates linked tasks."""
    for task in req.tasks:
        task.requirement_id = None
    db.delete(req)
    db.commit()
