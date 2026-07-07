"""
app/schemas/auth.py
--------------------
Pydantic v2 schemas for authentication.

LoginRequest  → validates what the client sends to POST /auth/login
UserOut       → safe user object (no password_hash) returned inside the token response
LoginResponse → the full data payload returned on successful login
"""

from pydantic import BaseModel, EmailStr, field_validator


class LoginRequest(BaseModel):
    email: EmailStr          # pydantic validates email format automatically
    password: str

    @field_validator("password")
    @classmethod
    def password_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Password is required.")
        return v


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role_id: int

    model_config = {"from_attributes": True}   # lets us do UserOut.model_validate(orm_user)


class LoginResponse(BaseModel):
    token: str
    user: UserOut
