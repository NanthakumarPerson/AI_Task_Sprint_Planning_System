# app/services/sprint_service.py
# --------------------------------------------------------------------------------
# Implements business services for Sprints.
# Enforces validation constraints on sprint start dates, end dates, active-status,
# field updates, and moves unfinished tasks back to the backlog on completion.
# --------------------------------------------------------------------------------

from datetime import date
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.task import Task
from app.repositories import sprint_repo, project_repo, task_repo
from app.schemas.sprint_schemas import SprintOut


class SprintService:

    @staticmethod
    def create(db: Session, project_id: int, name: str, goal: str | None, start_date, end_date) -> SprintOut:
        """Validates dates and creates a new sprint in planning state."""
        today = date.today()
        # End date cannot be before start date
        if end_date < start_date:
            raise HTTPException(status_code=400, detail="End date must be after start date")
        # End date cannot be in the past
        if end_date < today:
            raise HTTPException(status_code=400, detail="Sprint end date cannot be in the past")

        # Verify parent project exists before adding a child sprint
        project = project_repo.get_project_by_id(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found.")

        # Save to database
        sprint = sprint_repo.create_sprint(db, project_id, name, goal, start_date, end_date)
        return SprintOut.model_validate(sprint)

    @staticmethod
    def start_sprint(db: Session, sprint_id: int) -> SprintOut:
        """Transitions a sprint status from planning to active after validating active date scopes."""
        sprint = sprint_repo.get_sprint_by_id(db, sprint_id)
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found.")

        # Block re-starting completed sprints
        if sprint.status == "completed":
            raise HTTPException(
                status_code=400,
                detail="A completed sprint cannot be started again.",
            )
        # Block double-activation
        if sprint.status == "active":
            raise HTTPException(
                status_code=400,
                detail="Sprint is already active.",
            )
        # Verify initial state is planning
        if sprint.status not in ("planning",):
            raise HTTPException(
                status_code=400,
                detail=f"Only sprints in 'planning' status can be started. Current status: {sprint.status}",
            )

        today = date.today()
        # Cannot start sprint prior to its configured start date
        if today < sprint.start_date:
            raise HTTPException(
                status_code=400,
                detail=f"Sprint cannot be started before its start date ({sprint.start_date}). Today is {today}.",
            )
        # Cannot start a sprint if it already passed its configured end date
        if today > sprint.end_date:
            raise HTTPException(
                status_code=400,
                detail=f"Sprint end date ({sprint.end_date}) has already passed. Please complete or cancel this sprint.",
            )

        # Apply update
        updated = sprint_repo.start_sprint(db, sprint_id)
        return SprintOut.model_validate(updated)

    @staticmethod
    def update_sprint(db: Session, sprint_id: int, update_data: dict) -> SprintOut:
        """Filters updates and alters sprint attributes. Restricts modifications if sprint is active/completed."""
        sprint = sprint_repo.get_sprint_by_id(db, sprint_id)
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found.")

        # Filter out keys that are None or unchanged to prevent redundant updates
        filtered_update = {
            k: v for k, v in update_data.items()
            if v is not None and getattr(sprint, k) != v
        }

        if not filtered_update:
            return SprintOut.model_validate(sprint)

        # Restrict structural field edits (like dates/projects) once a sprint starts or completes
        if sprint.status in ("active", "completed"):
            restricted_keys = [k for k in filtered_update if k not in ("name", "goal")]
            if restricted_keys:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot update {', '.join(restricted_keys)} when sprint is {sprint.status}. Only name and goal can be edited."
                )

        # Verify parent project exists if changing projects
        if "project_id" in filtered_update:
            project = project_repo.get_project_by_id(db, filtered_update["project_id"])
            if not project:
                raise HTTPException(status_code=404, detail="Target project not found.")

        updated = sprint_repo.update_sprint(db, sprint_id, filtered_update)
        return SprintOut.model_validate(updated)

    @staticmethod
    def complete_sprint(db: Session, sprint_id: int, move_unfinished: bool) -> SprintOut:
        """Transitions sprint status to completed and handles unfinished tasks."""
        sprint = sprint_repo.get_sprint_by_id(db, sprint_id)
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found.")

        # Only active sprints can be completed
        if sprint.status != "active":
            raise HTTPException(
                status_code=400,
                detail=f"Only active sprints can be completed. Current status is {sprint.status}."
            )

        # Gather tasks associated with the sprint
        tasks_in_sprint = db.query(Task).filter(
            Task.sprint_id == sprint.id,
            Task.is_deleted == False,
        ).all()

        # If PM confirmed, strip sprint_id from unfinished tasks (returns them to backlog)
        for task in tasks_in_sprint:
            if task.status != "DONE" and move_unfinished:
                task.sprint_id = None

        sprint.status = "completed"
        db.commit()
        db.refresh(sprint)
        return SprintOut.model_validate(sprint)

    @staticmethod
    def cancel_sprint(db: Session, sprint_id: int, move_unfinished: bool) -> SprintOut:
        """Cancels a sprint and returns unfinished tasks to the backlog if requested."""
        sprint = sprint_repo.get_sprint_by_id(db, sprint_id)
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found.")

        # Cannot cancel already finalized sprints
        if sprint.status in ("completed", "cancelled"):
            raise HTTPException(
                status_code=400,
                detail=f"Sprint is already {sprint.status} and cannot be cancelled."
            )

        tasks_in_sprint = db.query(Task).filter(
            Task.sprint_id == sprint.id,
            Task.is_deleted == False,
        ).all()

        # Evict unfinished tasks back to the backlog if confirmed
        for task in tasks_in_sprint:
            if task.status != "DONE" and move_unfinished:
                task.sprint_id = None

        sprint.status = "cancelled"
        db.commit()
        db.refresh(sprint)
        return SprintOut.model_validate(sprint)

    @staticmethod
    def get_my_sprints(db: Session, user_id: int):
        """Fetches distinct sprints that have tasks assigned to the user."""
        sprints = sprint_repo.get_my_sprints(db, user_id)
        return [SprintOut.model_validate(s) for s in sprints]