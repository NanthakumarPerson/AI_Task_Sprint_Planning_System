from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.auth_schemas import LoginRequest
from app.schemas.common import APIResponse
from app.services.auth_service import AuthService

from app.core.security import get_current_user

router = APIRouter()


@router.get("/users", response_model=APIResponse)
def list_team_users(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return all active Dev/Tester users for assignee dropdowns."""
    from app.models.user import User
    users = (
        db.query(User)
        .filter(User.is_active == True, User.role_id.in_([3, 4]))
        .all()
    )
    return APIResponse.ok(
        data=[
            {"id": u.id, "name": u.name, "email": u.email, "role_id": u.role_id}
            for u in users
        ]
    )


@router.post("/login", response_model=APIResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a user with email and password.

    Returns:
        200 → { success: true, data: { token, user: { id, name, role_id } } }
        401 → Invalid email or password.
        403 → Account deactivated.
    """
    result = AuthService.login(db, payload.email, payload.password)
    return APIResponse.ok(
        data=result.model_dump(),
        message="Login successful.",
    )
