"""
app/schemas/common.py
----------------------
The standard JSON envelope every endpoint returns:
    { "success": true, "message": "...", "data": { } }

All routers import and use these wrappers so the shape is always consistent.
"""

from typing import Any, Optional
from pydantic import BaseModel


class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None

    @classmethod
    def ok(cls, data: Any = None, message: str = "Request completed successfully"):
        return cls(success=True, message=message, data=data)

    @classmethod
    def error(cls, message: str, data: Any = None):
        return cls(success=False, message=message, data=data)
