"""Resource routers: locations, packages, vehicles, events (generic CRUD) and plans/scenarios/settings."""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.csvutil import to_csv_response
from app.api.deps import get_db, get_routing, get_workspace
from app.api.usecases import resolve_classical, run_recommendation
from app.api.v1.crud import build_crud_router, check_fks
from app.db.models import (
    DeliveryEvent, DeliveryPlan, Location, Package, PlanAssignment, Scenario, Setting, VehicleProfile,
)
from app.repositories.base import ensure_workspace
from app.schemas.common import Page
from app.schemas.optimization import OptimizationRequest
from app.schemas.recommendation import RecommendationRequest
from app.schemas.resources import (
    EventIn, EventOut, LocationIn, LocationOut, PackageIn, PackageOut, PlanIn, PlanOut, PlanValidateIn,
    PlanValidateOut, ScenarioCompareIn, ScenarioIn, ScenarioOut, VehicleIn, VehicleOut,
)
from app.services.optimizer_classical import solve_classical
from app.services.routing import OSRMClient

# ------------------------------------------------------------------ locations / packages / vehicles / events
locations = build_crud_router(
    prefix="/locations", tag="location", model=Location, create_schema=LocationIn, read_schema=LocationOut,
    filter_fields=("type", "zone"), search_fields=("name", "address", "zone"),
    csv_columns=("id", "name", "address", "latitude", "longitude", "type", "zone", "notes", "created_at"),
    default_sort="name",
)


def _prepare_package(data: dict[str, Any], db: Session, ws: str) -> None:
    if data.get("location_id") and data.get("latitude") is None:
        loc = db.get(Location, data["location_id"])
        if loc is not None:
            data["latitude"], data["longitude"] = loc.latitude, loc.longitude


packages = build_crud_router(
    prefix="/packages", tag="package", model=Package, create_schema=PackageIn, read_schema=PackageOut,
    filter_fields=("status", "priority", "kind", "location_id"), search_fields=("reference", "recipient", "address"),
    csv_columns=("id", "reference", "recipient", "address", "latitude", "longitude", "weight_kg", "length_cm",
                 "width_cm", "height_cm", "volume_m3", "priority", "handling", "window_start", "window_end",
                 "deadline", "service_minutes", "kind", "status", "created_at"),
    fks={"location_id": Location}, prepare=_prepare_package,
)

vehicles = build_crud_router(
    prefix="/vehicles", tag="vehicle", model=VehicleProfile, create_schema=VehicleIn, read_schema=VehicleOut,
    filter_fields=("energy_type", "category", "available", "verification"), search_fields=("name", "category"),
    csv_columns=("id", "name", "category", "payload_kg", "volume_m3", "energy_type", "efficiency_value",
                 "efficiency_unit", "energy_price", "fixed_cost_per_delivery", "operating_cost_per_km",
                 "avg_speed_kmph", "emissions_g_per_km", "range_km", "available", "source", "verification"),
    default_sort="name",
)

events = build_crud_router(
    prefix="/events", tag="event", model=DeliveryEvent, create_schema=EventIn, read_schema=EventOut,
    filter_fields=("type", "plan_id", "package_id", "vehicle_id"), search_fields=("type", "message"),
    csv_columns=("id", "plan_id", "package_id", "vehicle_id", "type", "message", "occurred_at", "latitude", "longitude"),
    default_sort="occurred_at", fks={"plan_id": DeliveryPlan, "package_id": Package, "vehicle_id": VehicleProfile},
    prepare=lambda d, db, ws: d.__setitem__("occurred_at", d.get("occurred_at") or datetime.now(timezone.utc)),
)

# ------------------------------------------------------------------ plans
plans = APIRouter(prefix="/plans", tags=["plan"])
PLAN_CSV = ("id", "name", "status", "depot_location_id", "start_time", "total_distance_km", "total_duration_min",
            "total_cost", "total_emissions_g", "created_at")


def _plan_get(db: Session, ws: str, plan_id: str) -> DeliveryPlan:
    p = db.get(DeliveryPlan, plan_id)
    if p is None or p.workspace_id != ws:
        raise HTTPException(404, "plan not found")
    return p


def _apply_plan(plan: DeliveryPlan, body: PlanIn, db: Session, ws: str) -> None:
    data = body.model_dump(exclude={"assignments"})
    check_fks(db, ws, data, {"depot_location_id": Location})
    for a in body.assignments:
        check_fks(db, ws, a.model_dump(), {"vehicle_id": VehicleProfile, "package_id": Package})
    for k, v in data.items():
        setattr(plan, k, v)
    plan.assignments = [PlanAssignment(workspace_id=ws, **a.model_dump()) for a in body.assignments]


@plans.get("", response_model=Page[PlanOut])
def list_plans(
    status: str | None = None, q: str | None = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0),
    db: Session = Depends(get_db), ws: str = Depends(get_workspace),
):
    stmt = select(DeliveryPlan).where(DeliveryPlan.workspace_id == ws)
    if status:
        stmt = stmt.where(DeliveryPlan.status == status)
    if q:
        stmt = stmt.where(DeliveryPlan.name.ilike(f"%{q}%"))
    rows = list(db.scalars(stmt.order_by(DeliveryPlan.created_at.desc(), DeliveryPlan.id)))
    return {"items": rows[offset : offset + limit], "total": len(rows), "limit": limit, "offset": offset}


@plans.get("/export.csv")
def export_plans(db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    rows = db.scalars(select(DeliveryPlan).where(DeliveryPlan.workspace_id == ws).order_by(DeliveryPlan.created_at.desc()).limit(10000))
    return to_csv_response(rows, PLAN_CSV, "plans.csv")


@plans.post("/validate", response_model=PlanValidateOut)
def validate_plan(body: PlanValidateIn, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    issues: list[str] = []
    per: dict[str, dict[str, Any]] = {}
    seen: set[str] = set()
    for a in body.assignments:
        v, p = db.get(VehicleProfile, a.vehicle_id), db.get(Package, a.package_id)
        if v is None or v.workspace_id != ws:
            issues.append(f"unknown vehicle {a.vehicle_id}")
            continue
        if p is None or p.workspace_id != ws:
            issues.append(f"unknown package {a.package_id}")
            continue
        if a.package_id in seen:
            issues.append(f"package {p.reference} assigned more than once")
        seen.add(a.package_id)
        e = per.setdefault(v.id, {"vehicle_id": v.id, "name": v.name, "weight_kg": 0.0, "volume_m3": 0.0,
                                  "stops": 0, "payload_kg": v.payload_kg, "capacity_m3": v.volume_m3})
        e["weight_kg"] += p.weight_kg
        e["volume_m3"] += p.volume_m3 or 0
        e["stops"] += 1
        if not v.available:
            issues.append(f"vehicle {v.name} is unavailable")
    for e in per.values():
        if e["weight_kg"] > e["payload_kg"]:
            issues.append(f"{e['name']}: weight {e['weight_kg']:g} kg exceeds payload {e['payload_kg']:g} kg")
        if e["volume_m3"] > e["capacity_m3"]:
            issues.append(f"{e['name']}: volume {e['volume_m3']:g} m3 exceeds capacity {e['capacity_m3']:g} m3")
    return {"valid": not issues, "issues": sorted(set(issues)), "per_vehicle": list(per.values())}


@plans.post("", response_model=PlanOut, status_code=201)
def create_plan(body: PlanIn, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    ensure_workspace(db, ws)
    plan = DeliveryPlan(workspace_id=ws, name=body.name)
    _apply_plan(plan, body, db, ws)
    db.add(plan)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "constraint violation") from exc
    db.refresh(plan)
    return plan


@plans.get("/{plan_id}", response_model=PlanOut)
def get_plan(plan_id: str, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    return _plan_get(db, ws, plan_id)


@plans.put("/{plan_id}", response_model=PlanOut)
def update_plan(plan_id: str, body: PlanIn, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    plan = _plan_get(db, ws, plan_id)
    _apply_plan(plan, body, db, ws)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "constraint violation") from exc
    db.refresh(plan)
    return plan


@plans.delete("/{plan_id}", status_code=204)
def delete_plan(plan_id: str, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    db.delete(_plan_get(db, ws, plan_id))
    db.commit()
    return Response(status_code=204)


# ------------------------------------------------------------------ scenarios
scenarios = build_crud_router(
    prefix="/scenarios", tag="scenario", model=Scenario, create_schema=ScenarioIn, read_schema=ScenarioOut,
    filter_fields=("kind",), search_fields=("name", "description"),
    csv_columns=("id", "name", "description", "kind", "last_run_at", "created_at"), default_sort="created_at",
)
# These fixed-path routes are added before `/{item_id}` matches because FastAPI orders by registration;
# build_crud_router registered `/{item_id}` (GET/PUT/DELETE) only, so POST paths below do not collide.


@scenarios.post("/compare")
def compare_scenarios(body: ScenarioCompareIn, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    out = []
    for sid in body.scenario_ids:
        s = db.get(Scenario, sid)
        if s is None or s.workspace_id != ws:
            raise HTTPException(404, f"scenario {sid} not found")
        out.append({"id": s.id, "name": s.name, "kind": s.kind, "last_run_at": s.last_run_at, "result": s.result,
                    "summary": (s.result or {}).get("summary")})
    return {"scenarios": out, "note": "Scenarios without a result have not been run yet."}


@scenarios.post("/{scenario_id}/run", response_model=ScenarioOut)
async def run_scenario(
    scenario_id: str, db: Session = Depends(get_db), ws: str = Depends(get_workspace),
    routing: OSRMClient = Depends(get_routing),
):
    s = db.get(Scenario, scenario_id)
    if s is None or s.workspace_id != ws:
        raise HTTPException(404, "scenario not found")
    if s.kind == "recommendation":
        recs = await run_recommendation(RecommendationRequest.model_validate(s.config), db, ws, routing)
        total = sum(float(r.recommended.total_cost) for r in recs if r.recommended)
        s.result = {
            "summary": {"packages": len(recs), "total_cost": round(total, 2),
                        "unserved": sum(1 for r in recs if r.recommended is None)},
            "recommendations": [r.model_dump(mode="json") for r in recs],
        }
    elif s.kind == "classical":
        req = OptimizationRequest.model_validate(s.config)
        stops, veh, dist, dur, source, fb = await resolve_classical(req, db, ws, routing)
        import asyncio
        res = await asyncio.to_thread(
            solve_classical, stops, veh, dist, dur, req.weights, req.return_to_depot, req.time_limit_s or 5, req.horizon_min
        )
        res.distance_source, res.fallback_estimate = source, fb
        s.result = {"summary": {"total_distance_km": res.total_distance_km, "total_cost": res.total_cost,
                                "unassigned": len(res.unassigned), "status": res.status},
                    "optimization": res.model_dump(mode="json")}
    else:
        raise HTTPException(422, "quantum scenarios must be run through POST /optimization/quantum")
    s.last_run_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(s)
    return s


# ------------------------------------------------------------------ settings
settings_router = APIRouter(prefix="/settings", tags=["settings"])
DEFAULT_SETTINGS: dict[str, Any] = {
    "currency": "INR",
    "scoring_weights": {"cost": 0.5, "time": 0.25, "emissions": 0.15, "utilisation": 0.10},
    "optimization_weights": {"distance": 0.4, "time": 0.3, "cost": 0.2, "emissions": 0.1},
    "round_trip": False,
    "classical_time_limit_s": 5,
}


@settings_router.get("")
def get_settings_values(db: Session = Depends(get_db), ws: str = Depends(get_workspace)) -> dict[str, Any]:
    stored = {s.key: s.value for s in db.scalars(select(Setting).where(Setting.workspace_id == ws))}
    return {**DEFAULT_SETTINGS, **stored}


@settings_router.put("")
def put_settings(body: dict[str, Any], db: Session = Depends(get_db), ws: str = Depends(get_workspace)) -> dict[str, Any]:
    if len(body) > 50:
        raise HTTPException(422, "at most 50 settings per request")
    for k in body:
        if not k or len(k) > 100:
            raise HTTPException(422, "setting keys must be 1-100 characters")
    ensure_workspace(db, ws)
    for k, v in body.items():
        row = db.get(Setting, (ws, k))
        if row is None:
            db.add(Setting(workspace_id=ws, key=k, value=v))
        else:
            row.value = v
    db.commit()
    return get_settings_values(db, ws)
