# app/repositories/sprint_repo.py
# --------------------------------------------------------------------------------
# Handles database queries and mutations for Sprints.
# This repository layer interacts directly with SQLAlchemy models.
# --------------------------------------------------------------------------------

from sqlalchemy.orm import Session
from app.models.sprint import Sprint


def create_sprint(db: Session, project_id: int, name: str, goal: str | None, start_date, end_date) -> Sprint:
    """Creates a new sprint in the planning state and saves it to the database."""
    sprint = Sprint(
        project_id=project_id,
        name=name,
        goal=goal,
        start_date=start_date,
        end_date=end_date,
        status="planning",
    )
    # Add instance to session
    db.add(sprint)
    # Commit transaction to disk
    db.commit()
    # Refresh instance attributes from database
    db.refresh(sprint)
    return sprint


def get_sprints_by_project(db: Session, project_id: int) -> list[Sprint]:
    """Retrieves all sprints belonging to a specific project."""
    return db.query(Sprint).filter(Sprint.project_id == project_id).all()


def get_sprint_by_id(db: Session, sprint_id: int) -> Sprint | None:
    """Retrieves a single sprint by its primary key ID."""
    return db.query(Sprint).filter(Sprint.id == sprint_id).first()


def start_sprint(db: Session, sprint_id: int) -> Sprint | None:
    """Transition a sprint from 'planning' to 'active' status."""
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        return None
    sprint.status = "active"
    db.commit()
    db.refresh(sprint)
    return sprint


def update_sprint(db: Session, sprint_id: int, update_dict: dict) -> Sprint | None:
    """Applies dynamic updates to an existing sprint record."""
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        return None
    # Iterate and set changed attributes dynamically
    for key, value in update_dict.items():
        setattr(sprint, key, value)
    db.commit()
    db.refresh(sprint)
    return sprint


def complete_sprint(db: Session, sprint_id: int) -> Sprint | None:
    """Transitions a sprint's status to 'completed'."""
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        return None
    sprint.status = "completed"
    db.commit()
    db.refresh(sprint)
    return sprint


def get_my_sprints(db: Session, user_id: int) -> list[Sprint]:
    """Retrieves all sprints containing active tasks assigned to the user."""
    from app.models.task import Task
    return (
        db.query(Sprint)
        .join(Task, Task.sprint_id == Sprint.id)
        .filter(Task.assignee_id == user_id, Task.is_deleted == False)
        .distinct()
        .all()
    )