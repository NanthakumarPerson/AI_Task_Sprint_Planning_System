from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.schemas.common import APIResponse
from app.repositories.task_repo import get_dashboard_summary, get_dashboard_projects

router = APIRouter()


@router.get("/sprint", response_model=APIResponse)
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1, 2)),   # Admin and PM only
):
    from app.models.sprint import Sprint
    from app.models.task import Task
    from app.models.user import User
    from sqlalchemy import func, case
    from datetime import date

    today = date.today()
    active_sprints = (
        db.query(Sprint)
        .filter(Sprint.start_date <= today)
        .filter(Sprint.end_date >= today)
        .filter(Sprint.status == "active")
        .order_by(Sprint.start_date.asc())
        .all()
    )

    if active_sprints:
        sprints_data = [
            {
                "id": s.id,
                "name": s.name,
                "goal": s.goal,
                "start_date": str(s.start_date),
                "end_date": str(s.end_date),
                "status": s.status,
            }
            for s in active_sprints
        ]
        
        active_sprint_ids = [s.id for s in active_sprints]

        # Calculate task counts
        if current_user.role_id == 1:
            # Admin: all tasks across active sprints
            query = db.query(Task.status, func.count(Task.id)).filter(
                Task.sprint_id.in_(active_sprint_ids),
                Task.is_deleted == False
            )
        else:
            # PM: only tasks in projects they own
            from app.models.project import Project
            query = (
                db.query(Task.status, func.count(Task.id))
                .join(Project, Task.project_id == Project.id)
                .filter(
                    Task.sprint_id.in_(active_sprint_ids),
                    Task.is_deleted == False,
                    Project.owner_id == current_user.id
                )
            )

        rows = query.group_by(Task.status).all()
        status_counts = {"TODO": 0, "IN_PROGRESS": 0, "IN_REVIEW": 0, "DONE": 0}
        total_tasks = 0
        for status, count in rows:
            # Ensure it matches standardized keys
            if status in status_counts:
                status_counts[status] = count
            else:
                # If there are old strings like "todo", map them or ignore
                status_counts[status.upper()] = status_counts.get(status.upper(), 0) + count
            total_tasks += count

        task_summary = {
            "total_tasks": total_tasks,
            "todo_tasks": status_counts["TODO"],
            "in_progress_tasks": status_counts["IN_PROGRESS"],
            "in_review_tasks": status_counts["IN_REVIEW"],
            "done_tasks": status_counts["DONE"],
        }

        # Calculate member breakdown
        rows = (
            db.query(
                User.id,
                User.name,
                func.count(Task.id).label("total"),
                func.sum(case((Task.status == "DONE", 1), else_=0)).label("done"),
                func.sum(case((Task.status == "IN_PROGRESS", 1), else_=0)).label("in_progress"),
            )
            .join(Task, Task.assignee_id == User.id)
            .filter(Task.sprint_id.in_(active_sprint_ids), Task.is_deleted == False)
            .group_by(User.id, User.name)
            .all()
        )
        
        member_breakdown = [
            {
                "user_id": r.id,
                "name": r.name,
                "total": int(r.total or 0),
                "done": int(r.done or 0),
                "in_progress": int(r.in_progress or 0)
            }
            for r in rows
        ]
    else:
        sprints_data = []
        task_summary = {
            "total_tasks": 0,
            "todo_tasks": 0,
            "in_progress_tasks": 0,
            "in_review_tasks": 0,
            "done_tasks": 0,
        }
        member_breakdown = []

    projects = get_dashboard_projects(db)

    # Return structure matching React expectations
    return APIResponse.ok(
        data={
            "active_sprints": sprints_data,
            "task_summary": task_summary,
            "member_breakdown": member_breakdown,
            "projects": projects
        }
    )