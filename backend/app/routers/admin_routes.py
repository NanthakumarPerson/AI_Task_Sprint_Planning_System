"""
The Problem: We need a way to receive requests from the frontend, validate the input data,
make sure the user has permission to call the endpoint, run the logic, and return the response.

The Solution: This folder defines all the API routes (URLs) using FastAPI's APIRouter.
 They act as traffic directors.

app/routers/admin_routes.py
----------------------------
Admin-only user management endpoints.

All routes are protected by require_role(1) — only Admin (role_id=1) can access.
Password hashing reuses the EXISTING hash_password() from app.core.security.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import require_role, hash_password, get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.models.requirement import Requirement
from app.schemas.common import APIResponse

router = APIRouter()


# ── Schemas (kept local — only used by this router) ───────────────────────

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role_id: int

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required.")
        return v

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters.")
        return v

    @field_validator("role_id")
    @classmethod
    def valid_role(cls, v: int) -> int:
        if v not in (1, 2, 3, 4):
            raise ValueError("role_id must be 1 (Admin), 2 (PM), 3 (Developer), or 4 (Tester).")
        return v


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role_id: Optional[int] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Name cannot be empty.")
        return v

    @field_validator("role_id")
    @classmethod
    def valid_role(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v not in (1, 2, 3, 4):
            raise ValueError("role_id must be 1 (Admin), 2 (PM), 3 (Developer), or 4 (Tester).")
        return v


class PasswordReset(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters.")
        return v


# ── Routes ────────────────────────────────────────────────────────────────

@router.get("/users", response_model=APIResponse)
def list_users(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1)),
):
    """Return all users. Never exposes password_hash."""
    users = db.query(User).order_by(User.id).all()
    return APIResponse.ok(
        data=[
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role_id": u.role_id,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    )


@router.post("/users", response_model=APIResponse)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1)),
):
    """Create a new user. Hashes password via the existing hash_password()."""
    # Check unique email
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A user with email '{payload.email}' already exists.",
        )

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),  # reuses existing function
        role_id=payload.role_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return APIResponse.ok(
        data={
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role_id": user.role_id,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        message="User created successfully.",
    )


@router.put("/users/{user_id}", response_model=APIResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1)),
):
    """Update name, email, and/or role for a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Self-protection: admin cannot change their own role away from admin
    if user.id == current_user.id and payload.role_id is not None and payload.role_id != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change your own role away from Admin.",
        )

    # Check unique email (exclude current user)
    if payload.email is not None:
        existing = (
            db.query(User)
            .filter(User.email == payload.email, User.id != user_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A user with email '{payload.email}' already exists.",
            )

    # Apply updates
    if payload.name is not None:
        user.name = payload.name
    if payload.email is not None:
        user.email = payload.email
    if payload.role_id is not None:
        user.role_id = payload.role_id

    db.commit()
    db.refresh(user)

    return APIResponse.ok(
        data={
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role_id": user.role_id,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        message="User updated successfully.",
    )


@router.patch("/users/{user_id}/password", response_model=APIResponse)
def reset_password(
    user_id: int,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1)),
):
    """Reset a user's password. Hashes via the existing hash_password()."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password_hash = hash_password(payload.password)  # reuses existing function
    db.commit()

    return APIResponse.ok(message="Password reset successfully.")


@router.delete("/users/{user_id}", response_model=APIResponse)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1)),
):
    """Delete a user. Self-protection + dependency check."""
    # Self-protection
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot delete your own account.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # ── Dependency check — don't break foreign key integrity ──────────
    issues = []

    task_assigned_count = db.query(Task).filter(Task.assignee_id == user_id, Task.is_deleted == False).count()
    if task_assigned_count:
        issues.append(f"{task_assigned_count} assigned task(s)")

    task_created_count = db.query(Task).filter(Task.created_by == user_id, Task.is_deleted == False).count()
    if task_created_count:
        issues.append(f"{task_created_count} created task(s)")

    project_count = db.query(Project).filter(Project.owner_id == user_id).count()
    if project_count:
        issues.append(f"{project_count} owned project(s)")

    req_count = db.query(Requirement).filter(Requirement.created_by == user_id).count()
    if req_count:
        issues.append(f"{req_count} created requirement(s)")

    if issues:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete user: has {', '.join(issues)}. Reassign or remove these first.",
        )

    db.delete(user)
    db.commit()

    return APIResponse.ok(message=f"User '{user.name}' deleted successfully.")
