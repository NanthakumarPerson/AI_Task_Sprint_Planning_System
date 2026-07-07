"""
app/models/__init__.py
-----------------------
Import every model here so that:
  1. Alembic's env.py only needs to do `from app.models import *`
  2. All relationships are registered before migrations run.
"""

from app.models.user import User  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.sprint import Sprint  # noqa: F401
from app.models.requirement import Requirement  # noqa: F401
from app.models.task import Task  # noqa: F401
from app.models.task_comment import TaskComment  # noqa: F401
from app.models.ai_task_suggestion import AITaskSuggestion  # noqa: F401
