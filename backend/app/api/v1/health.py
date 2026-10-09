import importlib.util

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_routing
from app.services.routing import OSRMClient

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/ready")
def ready(db: Session = Depends(get_db), routing: OSRMClient = Depends(get_routing)):
    """Cheap readiness probe: DB ping, library availability, last OSRM outcome (no outbound call, no secrets)."""
    try:
        db.execute(text("SELECT 1"))
        db_state = "ok"
    except Exception:  # noqa: BLE001 - reported, not hidden
        db_state = "unavailable"
    optimizer = "ok" if importlib.util.find_spec("ortools") else "unavailable"
    quantum = "ok" if importlib.util.find_spec("qiskit_aer") else "unavailable"
    routing_state = "degraded" if routing.last_error else "configured"
    status = "ok" if db_state == "ok" and optimizer == "ok" else "degraded"
    return {
        "status": status, "db": db_state, "routing": routing_state, "optimizer": optimizer,
        "quantum": quantum + " (simulation only)" if quantum == "ok" else quantum,
    }
