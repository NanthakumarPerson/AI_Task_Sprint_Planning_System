# app/models/user.py
# --------------------------------------------------------------------------------
# Establishes the database model for platform Users.
# Holds credentials, profile data, and defines permissions using system roles.
# --------------------------------------------------------------------------------

from sqlalchemy import Boolean, Column, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import expression

from app.core.database import Base
from app.models.mixins import TimestampMixin


class User(TimestampMixin, Base):
    # Maps class to 'users' table in database
    __tablename__ = "users"

    # Unique identification number for every user account
    id = Column(Integer, primary_key=True, index=True)
    
    # Display name of the user (e.g., 'John Doe')
    name = Column(String(100), nullable=False)
    
    # Unique email address used for credentials check and JWT matching
    email = Column(String(150), unique=True, nullable=False, index=True)
    
    # Encrypted password payload hashed using bcrypt
    password_hash = Column(Text, nullable=False)

    # Permission roles: 1 = Admin, 2 = PM, 3 = Developer, 4 = Tester. Defaults to 3.
    role_id = Column(Integer, nullable=False, default=3)

    # Active status boolean: allows soft deactivation to block user login access
    is_active = Column(Boolean, nullable=False, server_default=expression.true())

    # ── Relationships ──────────────────────────────────────────────────────
    
    # Links to projects managed/owned by this user (applicable to PM/Admin)
    projects_owned      = relationship("Project",     back_populates="owner",          foreign_keys="Project.owner_id")
    
    # Links to tasks assigned to this user (applicable to Developer/Tester)
    tasks_assigned      = relationship("Task",        back_populates="assignee",       foreign_keys="Task.assignee_id")
    
    # Links to tasks created by this user
    tasks_created       = relationship("Task",        back_populates="creator",        foreign_keys="Task.created_by")
    
    # Links to requirement documentation created by this user
    requirements_created = relationship("Requirement", back_populates="creator")
    
    # Links to comments written by this user
    comments            = relationship("TaskComment", back_populates="author")

    def __repr__(self):
        # Python representation to print friendly identifier when logging
        return f"<User id={self.id} email={self.email} role={self.role_id}>"
