from __future__ import annotations

import logging
import threading
from functools import lru_cache

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db, get_sessionmaker
from app.services.routing import OSRMClient
from app.services.run_store import SQLAlchemyRunStore, RunManager

_runs_lock = threading.Lock()
log = logging.getLogger(__name__)


@lru_cache
def _routing() -> OSRMClient:
    s = get_settings()
    return OSRMClient(
        s.osrm_base_url, s.osrm_timeout_s, s.osrm_cache_ttl_s, s.osrm_cache_max_entries, s.osrm_max_coordinates
    )


@lru_cache
def _runs() -> RunManager:
    store = SQLAlchemyRunStore(get_sessionmaker(), get_settings().workspace_id)
    recovered = store.recover_interrupted()
    if recovered:
        log.warning("recovered interrupted optimization runs", extra={"run_count": recovered})
    return RunManager(store)


def get_routing() -> OSRMClient:
    return _routing()


def get_run_manager() -> RunManager:
    # lru_cache alone permits concurrent first calls to execute the factory twice.
    with _runs_lock:
        return _runs()


def get_workspace(settings: Settings = Depends(get_settings)) -> str:
    return settings.workspace_id


DbSession = Session
__all__ = ["get_db", "get_routing", "get_run_manager", "get_workspace", "get_settings"]
