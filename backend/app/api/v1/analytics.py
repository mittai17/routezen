from collections import Counter, defaultdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.csvutil import to_csv_response
from app.api.deps import get_db, get_run_manager, get_workspace
from app.api.v1.resources import PLAN_CSV
from app.db.models import DeliveryEvent, DeliveryPlan, Location, Package, PlanAssignment, VehicleProfile
from app.services.run_store import RunManager

router = APIRouter(tags=["analytics"])


def _count(db: Session, model, ws: str) -> int:
    return db.scalar(select(func.count()).select_from(model).where(model.workspace_id == ws)) or 0


@router.get("/analytics/summary")
def summary(db: Session = Depends(get_db), ws: str = Depends(get_workspace)) -> dict[str, Any]:
    pk = Counter(db.scalars(select(Package.status).where(Package.workspace_id == ws)))
    pl = Counter(db.scalars(select(DeliveryPlan.status).where(DeliveryPlan.workspace_id == ws)))
    return {
        "locations": _count(db, Location, ws), "packages": _count(db, Package, ws),
        "vehicles": _count(db, VehicleProfile, ws), "plans": _count(db, DeliveryPlan, ws),
        "events": _count(db, DeliveryEvent, ws), "packages_by_status": dict(pk), "plans_by_status": dict(pl),
    }


@router.get("/analytics/cost")
def cost(db: Session = Depends(get_db), ws: str = Depends(get_workspace)) -> dict[str, Any]:
    plans = list(db.scalars(select(DeliveryPlan).where(DeliveryPlan.workspace_id == ws, DeliveryPlan.total_cost.is_not(None))))
    n_assign = db.scalar(select(func.count()).select_from(PlanAssignment).where(PlanAssignment.workspace_id == ws)) or 0
    total = sum((p.total_cost for p in plans), start=0)
    return {
        "plans_with_cost": len(plans), "total_cost": str(total),
        "cost_per_delivery": str(round(total / n_assign, 2)) if n_assign and plans else None,
        "by_plan": [{"plan_id": p.id, "name": p.name, "total_cost": str(p.total_cost), "status": p.status} for p in plans],
    }


@router.get("/analytics/energy")
def energy(db: Session = Depends(get_db), ws: str = Depends(get_workspace)) -> dict[str, Any]:
    veh = list(db.scalars(select(VehicleProfile).where(VehicleProfile.workspace_id == ws)))
    by_type: dict[str, int] = Counter(v.energy_type for v in veh)
    emis = db.scalar(select(func.coalesce(func.sum(DeliveryPlan.total_emissions_g), 0)).where(DeliveryPlan.workspace_id == ws)) or 0
    return {"vehicles_by_energy_type": dict(by_type), "total_planned_emissions_g": float(emis),
            "note": "Emissions use per-vehicle emissions_g_per_km profile values (see each vehicle's verification flag)."}


@router.get("/analytics/vehicles")
def vehicles(db: Session = Depends(get_db), ws: str = Depends(get_workspace)) -> list[dict[str, Any]]:
    counts: dict[str, int] = defaultdict(int)
    for vid in db.scalars(select(PlanAssignment.vehicle_id).where(PlanAssignment.workspace_id == ws)):
        counts[vid] += 1
    return [
        {"vehicle_id": v.id, "name": v.name, "energy_type": v.energy_type, "available": v.available,
         "verification": v.verification, "assigned_packages": counts.get(v.id, 0)}
        for v in db.scalars(select(VehicleProfile).where(VehicleProfile.workspace_id == ws).order_by(VehicleProfile.name))
    ]


@router.get("/analytics/optimization")
def optimization(runs: RunManager = Depends(get_run_manager)) -> dict[str, Any]:
    items, total = runs.store.list(limit=500)
    by: Counter = Counter((r.kind, r.status) for r in items)
    rt = [r.result.get("runtime_ms", 0) for r in items if r.result]
    return {
        "total_runs": total,
        "by_kind_status": [{"kind": k, "status": s, "count": c} for (k, s), c in sorted(by.items())],
        "avg_runtime_ms": round(sum(rt) / len(rt), 1) if rt else None,
        "note": "Run history is in-memory and resets when the server restarts.",
    }


_REPORTS = {
    "locations": (Location, ("id", "name", "address", "latitude", "longitude", "type", "zone", "notes")),
    "packages": (Package, ("id", "reference", "recipient", "address", "weight_kg", "volume_m3", "priority", "status", "deadline")),
    "vehicles": (VehicleProfile, ("id", "name", "category", "payload_kg", "volume_m3", "energy_type", "efficiency_value",
                                  "efficiency_unit", "energy_price", "operating_cost_per_km", "fixed_cost_per_delivery",
                                  "emissions_g_per_km", "source", "verification")),
    "plans": (DeliveryPlan, PLAN_CSV),
    "events": (DeliveryEvent, ("id", "plan_id", "package_id", "vehicle_id", "type", "message", "occurred_at")),
}


@router.get("/reports/{kind}.csv")
def report(kind: str, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    if kind not in _REPORTS:
        raise HTTPException(404, f"unknown report; choose one of {sorted(_REPORTS)}")
    model, cols = _REPORTS[kind]
    rows = db.scalars(select(model).where(model.workspace_id == ws).order_by(model.created_at.desc()).limit(10000))
    return to_csv_response(rows, cols, f"{kind}.csv")
