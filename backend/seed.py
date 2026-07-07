"""
seed.py
--------
Run this ONCE after `alembic upgrade head` to populate the DB with demo data.

    python seed.py

Creates the four role accounts, a demo project, active & planning sprints, and some initial tasks.
Safe to re-run — skips items that already exist.
"""

import sys
import os
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import User, Project, Sprint, Task

SEED_USERS = [
    {"name": "System Admin",      "email": "admin@demo.com", "role_id": 1},
    {"name": "Project Manager",   "email": "pm@demo.com",    "role_id": 2},
    {"name": "Developer One",     "email": "dev@demo.com",   "role_id": 3},
    {"name": "Tester One",        "email": "tester@demo.com","role_id": 4},
]

DEMO_PASSWORD = "password123"

def seed():
    db = SessionLocal()
    try:
        # ── 1. Seed Users ──────────────────────────────────────────────────
        print("👤 Seeding Users...")
        for u in SEED_USERS:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if existing:
                print(f"  ⚠️   Skipping {u['email']} — already exists.")
                continue

            user = User(
                name=u["name"],
                email=u["email"],
                password_hash=hash_password(DEMO_PASSWORD),
                role_id=u["role_id"],
                is_active=True,
            )
            db.add(user)
            print(f"  ✅  Created user: {u['email']}")
        
        db.commit()

        # Get references for relations
        pm_user = db.query(User).filter(User.role_id == 2).first()
        dev_user = db.query(User).filter(User.role_id == 3).first()
        tester_user = db.query(User).filter(User.role_id == 4).first()

        if not pm_user:
            raise ValueError("PM user not found to own projects")

        # ── 2. Seed Projects ───────────────────────────────────────────────
        print("\n📁 Seeding Projects...")
        project = db.query(Project).filter(Project.name == "Vanguard Platform").first()
        if not project:
            project = Project(
                name="Vanguard Platform",
                description="Our next-generation modular cloud portal incorporating AI assistant capabilities.",
                owner_id=pm_user.id,
                status="Active"
            )
            db.add(project)
            db.commit()
            db.refresh(project)
            print(f"  ✅  Created project: Vanguard Platform (ID={project.id})")
        else:
            print("  ⚠️   Skipping Vanguard Platform — already exists.")

        # ── 3. Seed Sprints ────────────────────────────────────────────────
        print("\n🏃 Seeding Sprints...")
        sprint1 = db.query(Sprint).filter(Sprint.project_id == project.id, Sprint.name == "Sprint 1 - Auth & Core").first()
        if not sprint1:
            sprint1 = Sprint(
                project_id=project.id,
                name="Sprint 1 - Auth & Core",
                start_date=date.today() - timedelta(days=5),
                end_date=date.today() + timedelta(days=9),
                status="Active"
            )
            db.add(sprint1)
            db.commit()
            db.refresh(sprint1)
            print(f"  ✅  Created active sprint: Sprint 1 (ID={sprint1.id})")
        else:
            print("  ⚠️   Skipping Sprint 1 — already exists.")

        sprint2 = db.query(Sprint).filter(Sprint.project_id == project.id, Sprint.name == "Sprint 2 - AI Automation").first()
        if not sprint2:
            sprint2 = Sprint(
                project_id=project.id,
                name="Sprint 2 - AI Automation",
                start_date=date.today() + timedelta(days=10),
                end_date=date.today() + timedelta(days=24),
                status="Planning"
            )
            db.add(sprint2)
            db.commit()
            print(f"  ✅  Created planning sprint: Sprint 2")
        else:
            print("  ⚠️   Skipping Sprint 2 — already exists.")

        # ── 4. Seed Tasks ──────────────────────────────────────────────────
        print("\n📋 Seeding Tasks...")
        tasks_count = db.query(Task).filter(Task.project_id == project.id).count()
        if tasks_count == 0:
            demo_tasks = [
                {
                    "title": "Configure JWT & Session Validation",
                    "description": "Implement authentication endpoints, cookie/bearer validation, and token signing logic.",
                    "task_type": "Backend",
                    "priority": "Critical",
                    "effort_points": 5,
                    "status": "Done",
                    "assignee_id": dev_user.id,
                    "sprint_id": sprint1.id
                },
                {
                    "title": "Design Sidebar Navigation & Core Layout",
                    "description": "Create responsive SidebarLayout component with active page states and user logout actions.",
                    "task_type": "Frontend",
                    "priority": "High",
                    "effort_points": 3,
                    "status": "Done",
                    "assignee_id": dev_user.id,
                    "sprint_id": sprint1.id
                },
                {
                    "title": "Write Integration Tests for Auth Routes",
                    "description": "Implement automated testing for login, registration, and unauthorized route access.",
                    "task_type": "Testing",
                    "priority": "Medium",
                    "effort_points": 3,
                    "status": "In Progress",
                    "assignee_id": tester_user.id,
                    "sprint_id": sprint1.id
                },
                {
                    "title": "Set up PostgreSQL Connection Pool & Alembic",
                    "description": "Setup SQLAlchemy pool configurations and execute initial migrations on target server.",
                    "task_type": "Database",
                    "priority": "Critical",
                    "effort_points": 2,
                    "status": "Done",
                    "assignee_id": dev_user.id,
                    "sprint_id": sprint1.id
                },
                {
                    "title": "Implement Blocker Modal popup & alerts",
                    "description": "Add UI state change confirmations with mandatory blocker text fields when task status is set to Blocked.",
                    "task_type": "Frontend",
                    "priority": "Medium",
                    "effort_points": 3,
                    "status": "Blocked",
                    "assignee_id": dev_user.id,
                    "sprint_id": sprint1.id
                }
            ]
            for t_data in demo_tasks:
                task = Task(
                    project_id=project.id,
                    sprint_id=t_data["sprint_id"],
                    assignee_id=t_data["assignee_id"],
                    title=t_data["title"],
                    description=t_data["description"],
                    task_type=t_data["task_type"],
                    priority=t_data["priority"],
                    effort_points=t_data["effort_points"],
                    status=t_data["status"]
                )
                db.add(task)
            db.commit()
            print(f"  ✅  Created {len(demo_tasks)} initial tasks for Sprint 1")
        else:
            print("  ⚠️   Skipping Tasks — tasks already exist.")

        print("\n🎉 Seed complete. Database fully initialized for demo.")
    except Exception as exc:
        db.rollback()
        print(f"\n❌  Seed failed: {exc}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
