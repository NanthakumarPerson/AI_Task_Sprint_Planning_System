"""
app/core/security.py
---------------------
Handles two security concerns:

1. JWT tokens  — create_access_token() and verify_token()
2. Passwords   — hash_password() and verify_password() (bcrypt, cost=12) 12 rounds of calculations

The JWT payload contains:  { "sub": str(user_id), "role_id": int }
All protected routes call get_current_user() as a FastAPI dependency.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db

# Password hashing
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain_password: str) -> str:
    """Return bcrypt hash of the given password."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if plain_password matches the stored hash."""
    return _pwd_context.verify(plain_password, hashed_password)


# JWT
_bearer_scheme = HTTPBearer()


def create_access_token(data: dict, expiry_minutes: Optional[int] = None) -> str:
    """
    Create a signed JWT.

    Args:
        data: dict to encode — must include at minimum {"sub": str(user_id), "role_id": int}
        expiry_minutes: override the default from settings (useful in tests)

    Returns:
        Encoded JWT string.
    """
    expire_delta = timedelta(
        minutes=expiry_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expire_delta
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> dict:
    """
    Decode and verify a JWT string.

    Returns:
        The decoded payload dict.

    Raises:
        HTTPException 401 if token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("sub") is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required. Please log in.",
            )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )


# FastAPI dependency — resolves the current user from the Bearer token
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
):
    """
    FastAPI dependency that:
      1. Reads the Bearer token from the Authorization header.
      2. Verifies the JWT signature and expiry.
      3. Loads the matching User row from the DB.
      4. Checks the user is still active.

    Returns:
        The User ORM object for the authenticated user.

    Usage:
        @router.get("/protected")
        def protected(current_user = Depends(get_current_user)):
            ...
    """
    # Import here to avoid circular imports (models import Base from database)
    from app.models.user import User

    payload = verify_token(credentials.credentials)
    user_id: int = int(payload.get("sub"))

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact admin.",
        )
    return user


# Role-based permission helper
def require_role(*role_ids: int):
    """
    Returns a FastAPI dependency that enforces role membership.

    Usage:
        @router.post("/projects", dependencies=[Depends(require_role(1, 2))])
        def create_project(...):
            ...
    """
    def _check(current_user=Depends(get_current_user)): #if the authenticated user does not have a role_id matching the allowed list (e.g., 1 for Admin, 2 for PM), 
                                                        #it immediately blocks the request and returns a 403 Forbidden error.
        if current_user.role_id not in role_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorised to perform this action.",
            )
        return current_user

    return _check
