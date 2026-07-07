# app/repositories/project_repo.py
# --------------------------------------------------------------------------------
# Handles database queries and mutations for Projects.
# --------------------------------------------------------------------------------


# The Problem: Writing database query logic directly in your API endpoints makes the code messy,
#  hard to test, and duplicates code when the same query is needed in different places.

# The Solution: We isolate all database operations (creating, updating, fetching, and deleting rows) into functions here.
#  These functions only interact with SQLAlchemy and the database. They do not know about HTTP requests, APIs, or status codes.
from sqlalchemy.orm import Session
from app.models.project import Project

def create_project(db: Session, name: str, description: str | None, owner_id: int) -> Project:
    """Inserts a new project record initialized as Active status."""
    project = Project(name=name, description=description, owner_id=owner_id, status="Active")
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_all_projects(db: Session, owner_id: int | None = None) -> list[Project]:
    """Retrieves projects list, optionally filtered by owner PM user ID, ordered by creation date."""
    query = db.query(Project)
    # Check if filter parameter is provided
    if owner_id:
        query = query.filter(Project.owner_id == owner_id)
    return query.order_by(Project.created_at.desc()).all()


def get_project_by_id(db: Session, project_id: int) -> Project | None:
    """Queries a single project by its primary key database ID."""
    return db.query(Project).filter(Project.id == project_id).first()