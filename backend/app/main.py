"""
app/main.py
------------
FastAPI application entry point.

Run the server:
    uvicorn app.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.database import engine


# Lifespan — DB connection check on startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        import sqlalchemy
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        print(" Database connection verified.")
    except Exception as exc:
        print(f"Database connection FAILED: {exc}")
        raise RuntimeError("Cannot start: database is unreachable.") from exc
    yield

# App instance
app = FastAPI(
    title="AI Task & Sprint Planning Assistant",
    description="Sprint planning API with AI-powered task breakdown.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Error handlers — keep envelope format consistent
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"success": False, "message": "Resource not found.", "data": None},
    )


@app.exception_handler(422)
async def validation_error_handler(request: Request, exc):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": "Validation error. Check your request body.",
            "data": None,
        },
    )

# Routers
from app.routers import auth_routes as auth
from app.routers import project_routes as projects
from app.routers import sprint_routes as sprints
from app.routers import requirement_routes as requirements
from app.routers import task_routes as tasks
from app.routers import dashboard
from app.routers import admin_routes as admin
from app.routers import ai_routes as ai

app.include_router(auth.router,         prefix="/auth",         tags=["Auth"])
app.include_router(dashboard.router,    prefix="/dashboard",    tags=["Dashboard"])
app.include_router(projects.router,     prefix="/projects",     tags=["Projects"])
app.include_router(sprints.router,      prefix="/sprints",      tags=["Sprints"])
app.include_router(requirements.router, prefix="/requirements", tags=["Requirements"])
app.include_router(tasks.router,        prefix="/tasks",        tags=["Tasks"])
app.include_router(admin.router,        prefix="/admin",        tags=["Admin"])
app.include_router(ai.router)


# Health check
@app.get("/health", tags=["Health"])
def health_check():
    return {"success": True, "message": "Server is running.", "data": None}