from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.task import Task
from app.repositories import task_repo, requirement_repo, sprint_repo
from app.schemas.task_schemas import TaskOut
from app.utils.sprint_state import classify_sprint
# ------------------------------------------------------------
# Task Service – Core business logic for task operations
# ------------------------------------------------------------
# This file contains the service layer that enforces permission,
# sprint‑state, and data‑integrity rules before delegating to the
# repository (DB) layer. The comments below explain the validation
# flow, especially the conditions that enable or disable the
# “Remove from Sprint” button in the UI.
# Status flow — a task can only move forward, never backwards.
STATUS_ORDER = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]


class TaskService:

    @staticmethod
    def create_single(db: Session, task_data: dict, current_user) -> TaskOut:
        """Create a single task. sprint_id is optional (None = Backlog). PM/Admin only."""
        sprint_id = task_data.get("sprint_id")
        if sprint_id:
            # Verify the sprint exists and allows new tasks
            sprint = sprint_repo.get_sprint_by_id(db, sprint_id)
            if not sprint:
                raise HTTPException(status_code=404, detail="Sprint not found.")
            if sprint.status.lower() not in ["planning", "active"]:
                raise HTTPException(
                    status_code=400,
                    detail="Tasks can only be added to sprints in 'planning' or 'active' status.",
                )

        task_data["created_by"] = current_user.id
        task = task_repo.create_single_task(db, task_data)
        enriched_task = task_repo._enrich_task(db, task)
        return TaskOut.model_validate(enriched_task)

    @staticmethod
    def bulk_create(db: Session, tasks_data: list[dict]) -> list[TaskOut]:
        tasks = task_repo.bulk_create_tasks(db, tasks_data)
        return [TaskOut.model_validate(t) for t in tasks]

    @staticmethod
    def get_by_sprint(db: Session, sprint_id: int) -> list[dict]:
        """Return all tasks for a given sprint, enriched with names."""
        sprint = sprint_repo.get_sprint_by_id(db, sprint_id)
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found.")
        return task_repo.get_tasks_by_sprint(db, sprint_id)

    @staticmethod
    def get_my_tasks(db: Session, current_user) -> list[dict]:
        """Return all tasks assigned to the current user, enriched."""
        return task_repo.get_tasks_by_assignee(db, current_user.id)

    @staticmethod
    def get_my_tasks_by_sprint(db: Session, sprint_id: int, current_user) -> list[dict]:
        """Return all tasks in a given sprint assigned to the current user, enriched."""
        sprint = sprint_repo.get_sprint_by_id(db, sprint_id)
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found.")
        return task_repo.get_tasks_by_sprint_for_user(db, sprint_id, current_user.id)

    @staticmethod
    def get_filtered(
        db: Session,
        sprint_id: int,
        status: str | None,
        priority: str | None,
        assignee_id: int | None,
        page: int,
        limit: int,
        current_user,
    ) -> dict:
        tasks, total = task_repo.get_tasks_filtered(
            db, sprint_id, status, priority, assignee_id, page, limit,
            role_id=current_user.role_id, user_id=current_user.id
        )
        pages = (total + limit - 1) // limit  # ceiling division
        return {
            "tasks": tasks,   # already enriched dicts from task_repo._enrich_task()
            "total": total,
            "page": page,
            "pages": pages,
        }

    @staticmethod
    def update_status(
        db: Session,
        task_id: int,
        new_status: str,
        current_user,
    ) -> TaskOut:
        """
        Main transition evaluator. Enforces state transitions and permissions:
        1. PM/Admin can update any task's status.
        2. Developers/Testers can only update tasks assigned directly to them.
        3. Transition flow is strictly one-way forward: TODO -> IN_PROGRESS -> IN_REVIEW -> DONE.
        """
        # A. Fetch task from db (raises 404 if deleted or not present)
        task = task_repo.get_task_by_id(db, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")

        # B. Check Permissions: role_id 1 is Admin, 2 is PM. role_id 3 is Dev, 4 is Tester.
        is_pm_or_admin = current_user.role_id in (1, 2)
        is_own_task = task.assignee_id == current_user.id
        if not is_pm_or_admin and not is_own_task:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the assigned user can update this task's status.",
            )

        # C. Strict transition checks: tasks cannot move backwards (e.g. Done -> In Progress is blocked)
        VALID_TRANSITIONS = {
            "TODO": "IN_PROGRESS",
            "IN_PROGRESS": "IN_REVIEW",
            "IN_REVIEW": "DONE",
            "DONE": None,
        }
        allowed_next = VALID_TRANSITIONS.get(task.status)
        if allowed_next is None:
            raise HTTPException(
                status_code=400,
                detail="Task is already DONE. No further transitions allowed.",
            )
        if new_status != allowed_next:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid status transition: '{task.status}' → '{new_status}'. "
                    f"Only '{task.status}' → '{allowed_next}' is allowed."
                ),
            )

        # D. Execute database save and return parsed schema
        updated = task_repo.update_task_status(db, task_id, new_status)
        return TaskOut.model_validate(updated)

    @staticmethod
    def get_sprint_report(db: Session, sprint_id: int) -> dict:
        summary = task_repo.get_sprint_summary(db, sprint_id)
        members = task_repo.get_member_breakdown(db, sprint_id)
        sprint = sprint_repo.get_sprint_by_id(db, sprint_id)
        sprint_data = None
        if sprint:
            sprint_data = {
                "id": sprint.id,
                "name": sprint.name,
                "goal": sprint.goal,
                "start_date": str(sprint.start_date) if sprint.start_date else None,
                "end_date": str(sprint.end_date) if sprint.end_date else None,
                "status": sprint.status,
            }
        return {"summary": summary, "member_breakdown": members, "sprint": sprint_data}

    @staticmethod
    def update_task(db: Session, task_id: int, update_data: dict, current_user) -> TaskOut:
        """Edit a task. PM/Admin can edit most fields on active-sprint tasks; COMPLETED sprints are read-only."""
        task = task_repo.get_task_by_id(db, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")

        # Check sprint status using shared classification
        if task.sprint_id:
            sprint = sprint_repo.get_sprint_by_id(db, task.sprint_id)
            if sprint:
                state = classify_sprint(sprint)

                # Completed sprints are fully read-only for everyone
                if state == "completed":
                    raise HTTPException(
                        status_code=400,
                        detail="Tasks in a completed sprint are read-only and cannot be edited."
                    )

                # For active/ended sprints: allow PM to edit task fields, but block
                # scope-changing actions (changing sprint_id, project_id, task_type).
                if state in ("active", "ended"):
                    filtered = {k: v for k, v in update_data.items() if v is not None}

                    # Blocked scope-changing fields — these must go through explicit PM-confirmed flow
                    scope_fields = {"sprint_id", "project_id", "task_type"}
# These fields change the task's context and need explicit PM confirmation
                    scope_changed = [k for k in filtered if k in scope_fields and filtered[k] != getattr(task, k, None)]
                    if scope_changed:
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"Changing {', '.join(scope_changed)} while a sprint is active requires "
                                "explicit confirmation. Remove the task from the sprint first."
                            )
                        )

                    # Cannot move a DONE task out of an active sprint via sprint_id change
                    if "sprint_id" in filtered and filtered["sprint_id"] != task.sprint_id and task.status == "DONE":
                        raise HTTPException(
                            status_code=400,
                            detail="Cannot move a 'DONE' task out of an active sprint."
                        )

        nullable_fields = {"assignee_id", "due_date", "estimated_hours"}
# Allow explicit null values for these optional fields (un‑assign, clear dates, etc.)
        filtered_update = {k: v for k, v in update_data.items() if (v is not None or k in nullable_fields)}
        if not filtered_update:
            return TaskOut.model_validate(task_repo._enrich_task(db, task))

        updated = task_repo.update_task(db, task_id, filtered_update)
        return TaskOut.model_validate(task_repo._enrich_task(db, updated))

    @staticmethod
    def reassign_task(db: Session, task_id: int, new_assignee_id: int | None, current_user) -> TaskOut:
        """Change assignee only, PM/Admin only."""
        task = task_repo.get_task_by_id(db, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")

        if task.sprint_id:
            sprint = sprint_repo.get_sprint_by_id(db, task.sprint_id)
            if sprint and sprint.status == "completed":
                raise HTTPException(
                    status_code=400,
                    detail="Cannot reassign tasks in a completed sprint."
                )

        updated = task_repo.update_task(db, task_id, {"assignee_id": new_assignee_id})
        return TaskOut.model_validate(task_repo._enrich_task(db, updated))

    # Remove a task from its sprint – only allowed under strict conditions
    @staticmethod
    def remove_from_sprint(db: Session, task_id: int, current_user) -> TaskOut:
        """Remove task from sprint, PM/Admin only."""
        task = task_repo.get_task_by_id(db, task_id)
        # Ensure the task exists
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")

        # Task must be assigned to a sprint to be removable
        if not task.sprint_id:
            raise HTTPException(status_code=400, detail="Task is not in a sprint.")

        # Fetch the sprint to verify its state
        sprint = sprint_repo.get_sprint_by_id(db, task.sprint_id)
        # Only active sprints allow task removal
        if not sprint or sprint.status != "active":
            raise HTTPException(
                status_code=400,
                detail="Can only remove tasks from an 'active' sprint."
            )

        # DONE tasks cannot be removed from an active sprint
        if task.status == "DONE":
            raise HTTPException(
                status_code=400,
                detail="Cannot remove a 'DONE' task from an active sprint."
            )
        updated = task_repo.remove_task_from_sprint(db, task_id)
        return TaskOut.model_validate(task_repo._enrich_task(db, updated))

    @staticmethod
    def delete_task(db: Session, task_id: int, current_user) -> dict:
        """Soft delete a task, PM/Admin only. Blocked for tasks in completed sprints."""
        task = task_repo.get_task_by_id(db, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")

        # Block delete if task is in a completed sprint
        if task.sprint_id:
            sprint = sprint_repo.get_sprint_by_id(db, task.sprint_id)
            if sprint and classify_sprint(sprint) == "completed":
                raise HTTPException(
                    status_code=400,
                    detail="Tasks in a completed sprint cannot be deleted."
                )

        task.is_deleted = True
        task.assignee_id = None
        db.commit()

        return {"success": True, "message": "Task deleted."}

    @staticmethod
    def get_backlog_tasks(db: Session, current_user) -> list[dict]:
        """Return all tasks that are not assigned to any sprint and are not deleted."""
        tasks = db.query(Task).filter(Task.sprint_id == None, Task.is_deleted == False).all()
        return [task_repo._enrich_task(db, t) for t in tasks]

    @staticmethod
    def assign_sprint(db: Session, task_id: int, sprint_id: int, current_user) -> TaskOut:
        """Assign an existing task to a sprint."""
        task = task_repo.get_task_by_id(db, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")

        sprint = sprint_repo.get_sprint_by_id(db, sprint_id)
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found.")

        if sprint.status in ("completed", "cancelled"):
            raise HTTPException(status_code=400, detail="Cannot assign tasks to a completed or cancelled sprint.")

        today = date.today()
        if sprint.end_date < today:
            raise HTTPException(
                status_code=400,
                detail=f"Sprint '{sprint.name}' has already ended on {sprint.end_date}. Please choose an active sprint."
            )

        updated = task_repo.update_task(db, task_id, {"sprint_id": sprint_id})
        return TaskOut.model_validate(task_repo._enrich_task(db, updated))