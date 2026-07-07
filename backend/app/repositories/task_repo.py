from datetime import date

from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.models.task import Task
from app.models.task_comment import TaskComment
from app.models.user import User
from app.models.sprint import Sprint
from app.models.project import Project


def bulk_create_tasks(db: Session, tasks_data: list[dict]) -> list[Task]:
    """Insert multiple tasks in one commit and return them all."""
    tasks = [Task(**t) for t in tasks_data]
    db.add_all(tasks)
    db.commit()
    for task in tasks:
        db.refresh(task)
    return tasks


def create_single_task(db: Session, task_data: dict) -> Task:
    """Insert a single task and return it."""
    task = Task(**task_data)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _enrich_task(db: Session, task: Task) -> dict:
    """
    Convert a Task ORM object to a dict enriched with:
      - task_key       (computed: TASK-{id})
      - assignee_name  (joined from users table)
      - sprint_name    (joined from sprints table)
      - project_name   (joined from projects table)
    """
    task_dict = {c.name: getattr(task, c.name) for c in task.__table__.columns}

    # Task key
    task_dict["task_key"] = f"TASK-{task.id}"

    # Assignee name
    if task.assignee_id:
        user = db.query(User).filter(User.id == task.assignee_id).first()
        task_dict["assignee_name"] = user.name if user else None
    else:
        task_dict["assignee_name"] = None

    # Sprint name
    if task.sprint_id:
        sprint = db.query(Sprint).filter(Sprint.id == task.sprint_id).first()
        task_dict["sprint_name"] = sprint.name if sprint else None
    else:
        task_dict["sprint_name"] = None

    # Project name
    if task.project_id:
        project = db.query(Project).filter(Project.id == task.project_id).first()
        task_dict["project_name"] = project.name if project else None
    else:
        task_dict["project_name"] = None

    # Comments
    comments = []
    for c in task.comments:
        comments.append({
            "id": c.id,
            "comment": c.comment,
            "created_at": str(c.created_at),
            "user_id": c.user_id,
            "author_name": c.author.name if c.author else "Unknown"
        })
    task_dict["comments"] = comments

    return task_dict


def get_tasks_by_sprint(db: Session, sprint_id: int) -> list[dict]:
    """Return all tasks in a sprint, enriched."""
    tasks = db.query(Task).filter(Task.sprint_id == sprint_id, Task.is_deleted == False).all()
    return [_enrich_task(db, t) for t in tasks]


def get_tasks_by_assignee(db: Session, user_id: int) -> list[dict]:
    """Return all tasks assigned to a user, enriched."""
    tasks = db.query(Task).filter(Task.assignee_id == user_id, Task.is_deleted == False).all()
    return [_enrich_task(db, t) for t in tasks]

def get_tasks_by_sprint_for_user(db: Session, sprint_id: int, user_id: int) -> list[dict]:
    """Return all tasks in a sprint assigned to a specific user, enriched."""
    tasks = db.query(Task).filter(
        Task.sprint_id == sprint_id,
        Task.assignee_id == user_id,
        Task.is_deleted == False
    ).all()
    return [_enrich_task(db, t) for t in tasks]


def get_tasks_filtered(
    db: Session,
    sprint_id: int,
    status: str | None = None,
    priority: str | None = None,
    assignee_id: int | None = None,
    page: int = 1,
    limit: int = 20,
    role_id: int | None = None,
    user_id: int | None = None,
) -> tuple[list[dict], int]:
    """Return enriched task dicts and the total count for pagination."""
    query = db.query(Task).filter(Task.sprint_id == sprint_id, Task.is_deleted == False)

    # ── Role-based visibility ─────────────────────────────────────────
    if role_id == 3:          # Developer: only their own tasks
        query = query.filter(Task.assignee_id == user_id)
    elif role_id == 4:        # Tester: their tasks OR any task in review
        from sqlalchemy import or_
        query = query.filter(
            or_(Task.assignee_id == user_id, Task.status == "IN_REVIEW")
        )

    # ── User-selected filters ─────────────────────────────────────────
    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    # Assignee filter only applies for PM/Admin; Devs/Testers already filtered above
    if assignee_id and role_id not in (3, 4):
        query = query.filter(Task.assignee_id == assignee_id)

    total = query.count()
    tasks = query.offset((page - 1) * limit).limit(limit).all()

    return [_enrich_task(db, t) for t in tasks], total


def get_task_by_id(db: Session, task_id: int) -> Task | None:
    return db.query(Task).filter(Task.id == task_id, Task.is_deleted == False).first()


def update_task_status(db: Session, task_id: int, new_status: str) -> Task:
    task = db.query(Task).filter(Task.id == task_id, Task.is_deleted == False).first()
    task.status = new_status
    db.commit()
    db.refresh(task)
    return task


def add_task_comment(db: Session, task_id: int, user_id: int, comment: str) -> TaskComment:
    tc = TaskComment(task_id=task_id, user_id=user_id, comment=comment)
    db.add(tc)
    db.commit()
    db.refresh(tc)
    return tc


def get_sprint_summary(db: Session, sprint_id: int) -> dict:
    """
    Performance-Optimized Sprint Summary Aggregator.
    
    Instead of making 5 separate DB trips (which generates heavy SQL payload latency),
    this uses SQL CASE constructs inside a single SELECT query to return all task metrics:
    - TODO/IN_PROGRESS/IN_REVIEW/DONE count sums.
    - Effort point totals for velocity calculation.
    - Count check of how many DONE tasks have effort points set.
    """
    # 1. Fire single grouped select statement
    row = (
        db.query(
            # Count tasks per state: if state matches, sum 1, else sum 0
            func.sum(case((Task.status == "TODO",        1), else_=0)).label("todo"),
            func.sum(case((Task.status == "IN_PROGRESS", 1), else_=0)).label("in_progress"),
            func.sum(case((Task.status == "IN_REVIEW",   1), else_=0)).label("in_review"),
            func.sum(case((Task.status == "DONE",        1), else_=0)).label("done"),
            
            # Velocity sum: sum effort_points only if status is DONE
            func.coalesce(func.sum(
                case((Task.status == "DONE", Task.effort_points), else_=None)
            ), 0).label("effort_sum"),
            
            # Verify if effort points were assigned to DONE tickets (ignores nulls)
            func.count(
                case((Task.status == "DONE", Task.effort_points), else_=None)
            ).label("done_with_effort"),
        )
        .filter(Task.sprint_id == sprint_id, Task.is_deleted == False)
        .one()
    )

    # 2. Extract values and cast to integers safely (default to 0 if Null)
    todo_tasks        = int(row.todo        or 0)
    in_progress_tasks = int(row.in_progress or 0)
    in_review_tasks   = int(row.in_review   or 0)
    done_tasks        = int(row.done        or 0)
    done_with_effort  = int(row.done_with_effort or 0)
    effort_sum        = int(row.effort_sum  or 0)

    # 3. Fallback logic: If effort points were never estimated, use the raw Done Task count as velocity
    velocity      = effort_sum if done_with_effort > 0 else done_tasks
    velocity_mode = "effort_points" if done_with_effort > 0 else "task_count"

    # 4. Return results as a serialized dictionary
    return {
        "total_tasks":      todo_tasks + in_progress_tasks + in_review_tasks + done_tasks,
        "todo_tasks":       todo_tasks,
        "in_progress_tasks": in_progress_tasks,
        "in_review_tasks":  in_review_tasks,
        "done_tasks":       done_tasks,
        "velocity":         velocity,
        "velocity_mode":    velocity_mode,  # "effort_points" | "task_count"
    }

def update_task(db: Session, task_id: int, update_dict: dict) -> Task | None:
    task = db.query(Task).filter(Task.id == task_id, Task.is_deleted == False).first()
    if not task:
        return None
    for key, value in update_dict.items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task

def remove_task_from_sprint(db: Session, task_id: int) -> Task | None:
    task = db.query(Task).filter(Task.id == task_id, Task.is_deleted == False).first()
    if not task:
        return None
    task.sprint_id = None
    db.commit()
    db.refresh(task)
    return task

def move_unfinished_tasks_to_backlog(db: Session, sprint_id: int) -> int:
    tasks = db.query(Task).filter(Task.sprint_id == sprint_id, Task.status != "DONE", Task.is_deleted == False).all()
    count = 0
    for task in tasks:
        task.sprint_id = None
        count += 1
    db.commit()
    return count

def get_member_breakdown(db: Session, sprint_id: int) -> list[dict]:
    """Per-member task stats for the sprint report."""

    rows = (
        db.query(
            User.id,
            User.name,
            func.count(Task.id).label("assigned"),
            func.sum(case((Task.status == "DONE", 1), else_=0)).label("done"),
            func.sum(case((Task.status == "TODO", 1), else_=0)).label("todo"),
            func.sum(case((Task.status == "IN_PROGRESS", 1), else_=0)).label("in_progress"),
            func.sum(case((Task.status == "IN_REVIEW", 1), else_=0)).label("in_review"),
        )
        .join(Task, Task.assignee_id == User.id)
        .filter(Task.sprint_id == sprint_id, Task.is_deleted == False)
        .group_by(User.id, User.name)
        .all()
    )

    return [
        {
            "user_id":  r.id,
            "name":     r.name,
            "assigned": r.assigned,
            "done":     int(r.done or 0),
            "todo":     int(r.todo or 0),
            "in_progress": int(r.in_progress or 0),
            "in_review": int(r.in_review or 0),
            "total_tasks": int(r.assigned or 0),
        }
        for r in rows
    ]


def get_dashboard_summary(db: Session) -> dict:
    """Aggregate counts across all projects for the dashboard cards."""
    today = date.today()
    return {
        "total_projects":  db.query(func.count(Project.id)).scalar() or 0,
        # Only count sprints that are genuinely active today (status=active AND within date range)
        "active_sprints":  db.query(func.count(Sprint.id)).filter(
            Sprint.status == "active",
            Sprint.start_date <= today,
            Sprint.end_date >= today,
        ).scalar() or 0,
        "total_tasks":     db.query(func.count(Task.id)).filter(Task.is_deleted == False).scalar() or 0,
    }


def get_dashboard_projects(db: Session) -> list[dict]:
    """Project list rows for the dashboard table."""
    today = date.today()
    projects = db.query(Project).filter(Project.status == "Active").all()
    result   = []

    for p in projects:
        active_sprints = (
            db.query(Sprint)
            .filter(Sprint.project_id == p.id)
            .filter(Sprint.start_date <= today)
            .filter(Sprint.end_date >= today)
            .filter(Sprint.status == "active")
            .order_by(Sprint.start_date.asc())
            .all()
        )

        sprint_ids = [s.id for s in active_sprints]
        sprint_names = ", ".join([s.name for s in active_sprints])

        pending = done = total = 0
        if sprint_ids:
            total   = db.query(func.count(Task.id)).filter(Task.sprint_id.in_(sprint_ids), Task.is_deleted == False).scalar() or 0
            done    = db.query(func.count(Task.id)).filter(Task.sprint_id.in_(sprint_ids), Task.status == "DONE", Task.is_deleted == False).scalar() or 0
            pending = total - done

        result.append({
            "project_id":        p.id,
            "project_name":      p.name,
            "active_sprint_name": sprint_names if sprint_names else None,
            "pending_tasks":     pending,
            "progress_percent":  round(done / total * 100) if total > 0 else 0,
        })

    return result