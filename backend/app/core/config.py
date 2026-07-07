"""
app/core/config.py
------------------
We need a centralized, safe way to read these variables from an environment file (.env)

Loads all environment variables from the .env file using pydantic-settings.
Import `settings` anywhere in the app — never use os.environ directly.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings): #Pydantic Settings (BaseSettings).instructs Pydantic to read these values from a file named .env.
    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── JWT / Auth ────────────────────────────────────────────────────────
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALGORITHM: str = "HS256"

    # ── AI Provider (Google Gemini) ───────────────────────────────────────
    GEMINI_API_KEY: str
    AI_TIMEOUT_SECONDS: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


# Single shared instance — import this everywhere
settings = Settings()
