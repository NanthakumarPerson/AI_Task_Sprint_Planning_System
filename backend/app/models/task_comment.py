# app/models/task_comment.py
# --------------------------------------------------------------------------------
# Establishes the database model for Task Comments.
# Used for progress notes, blocker justifications, and general developer/tester notes.
# --------------------------------------------------------------------------------

from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TaskComment(TimestampMixin, Base):
    # Maps class to 'task_comments' table in database
    __tablename__ = "task_comments"

    # Unique identification number for every comment log row
    id = Column(Integer, primary_key=True, index=True)
    
    # Points to parent task that owns this comment record
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    
    # References user profile ID of the person who wrote the comment
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # The actual text content/comment description written by the user
    comment = Column(Text, nullable=False)

    # ── Relationships ──────────────────────────────────────────────────────
    
    # Links to the task parent model
    task = relationship("Task", back_populates="comments")
    
    # Links to the user model representing the author of the comment
    author = relationship("User", back_populates="comments")

    def __repr__(self):
        # Python representation to print friendly identifier when logging
        return f"<TaskComment id={self.id} task_id={self.task_id} user_id={self.user_id}>"
