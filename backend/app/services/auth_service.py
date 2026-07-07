"""
app/services/auth_service.py
-----------------------------
Business logic for authentication.

The router calls AuthService.login() and gets back a LoginResponse.
All DB access goes through user_repo — the service never writes raw SQL.

Security rules followed:
  - Uses bcrypt.verify() — never plain string comparison.
  - Returns the same error message for wrong email AND wrong password
    so attackers cannot enumerate valid emails.
  - Inactive users are rejected with a distinct 403 (not 401).
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.repositories import user_repo
from app.schemas.auth_schemas import LoginResponse, UserOut


class AuthService:

    @staticmethod
    def login(db: Session, email: str, password: str) -> LoginResponse:
        """
        Validate credentials and return a JWT + safe user object.

        Raises:
            HTTPException 401 — wrong email or password
            HTTPException 403 — account is deactivated
        """
        user = user_repo.get_user_by_email(db, email)

        # Wrong email OR wrong password → same message (security: don't leak which)
        if user is None or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        # Inactive user — tell them to contact admin
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Please contact admin.",
            )

        # Build JWT — payload contains user id and role so every protected
        # endpoint can check permissions without an extra DB call.
        token = create_access_token(
            data={"sub": str(user.id), "role_id": user.role_id}
        )

        return LoginResponse(
            token=token,
            user=UserOut.model_validate(user),
        )
