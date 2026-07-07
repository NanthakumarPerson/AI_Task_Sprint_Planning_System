# app/repositories/user_repo.py
# --------------------------------------------------------------------------------
# Handles database queries and mutations for Users.
# --------------------------------------------------------------------------------

from sqlalchemy.orm import Session
from app.models.user import User


def get_user_by_email(db: Session, email: str) -> User | None:
    """Queries a user record matching a specific email address (used in Auth check)."""
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    """Queries a user record by primary key ID."""
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, name: str, email: str, password_hash: str, role_id: int) -> User:
    """Inserts a new user record into the database table."""
    user = User(
        name=name,
        email=email,
        password_hash=password_hash,
        role_id=role_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
