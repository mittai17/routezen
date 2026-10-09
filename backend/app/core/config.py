"""Environment-driven settings. No secrets live in code; see .env.example."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_WORKSPACE_ID = "dev-workspace"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_env: str = "development"
    log_level: str = "INFO"
    log_json: bool = True

    database_url: str = "sqlite:///./routezen.db"
    db_echo: bool = False

    # Comma-separated list of allowed browser origins.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    workspace_id: str = DEV_WORKSPACE_ID

    osrm_base_url: str = "https://router.project-osrm.org"
    osrm_timeout_s: float = Field(default=8.0, gt=0)
    osrm_cache_ttl_s: float = Field(default=300.0, ge=0)
    osrm_cache_max_entries: int = Field(default=512, ge=1)
    osrm_max_coordinates: int = Field(default=100, ge=2)

    classical_time_limit_s: int = Field(default=5, ge=1)
    quantum_max_stops: int = Field(default=4, ge=1, le=4)
    quantum_timeout_s: float = Field(default=60.0, gt=0)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        """Normalise postgres URLs to the psycopg (v3) driver."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
