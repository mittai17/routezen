from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_routing, get_run_manager, get_settings, get_workspace
from app.api.usecases import resolve_annealing, resolve_classical, resolve_quantum
from app.core.config import Settings
from app.schemas.common import Page
from app.schemas.optimization import (
    AnnealingRequest, DynamicRerouteRequest, DynamicRerouteResult, HybridRequest,
    OptimizationRequest, OptimizationResult, QuantumRequest, QuantumResult, RunRecord,
)
from app.services.dynamic_reroute import reroute_dynamic
from app.services.optimizer_annealing import solve_simulated_annealing
from app.services.optimizer_classical import solve_classical
from app.services.optimizer_hybrid import solve_hybrid
from app.services.optimizer_quantum import (
    QuantumCancelled, QuantumLimitError, QuantumTimeout, solve_quantum,
)
from app.services.routing import OSRMClient
from app.services.run_store import RunManager

router = APIRouter(prefix="/optimization", tags=["optimization"])


@router.post("/classical", response_model=RunRecord, status_code=202)
async def start_classical(
    body: OptimizationRequest,
    db: Session = Depends(get_db),
    ws: str = Depends(get_workspace),
    routing: OSRMClient = Depends(get_routing),
    runs: RunManager = Depends(get_run_manager),
    settings: Settings = Depends(get_settings),
):
    stops, vehicles, dist, dur, source, fb = await resolve_classical(body, db, ws, routing)
    limit = body.time_limit_s or settings.classical_time_limit_s

    def work(_cancel) -> OptimizationResult:
        res = solve_classical(stops, vehicles, dist, dur, body.weights, body.return_to_depot, limit, body.horizon_min)
        res.distance_source, res.fallback_estimate = source, fb
        if fb:
            res.notes.append("Distances are straight-line FALLBACK ESTIMATES (OSRM unavailable).")
        return res

    req_dump = {
        "stops": [s.model_dump() for s in stops], "vehicles": [v.model_dump() for v in vehicles],
        "weights": body.weights.model_dump(), "return_to_depot": body.return_to_depot,
        "depot": body.depot.model_dump() if body.depot else None, "depot_location_id": body.depot_location_id,
        "time_limit_s": limit,
    }
    return runs.submit("classical", req_dump, work, timeout_s=limit + 30)


@router.post("/hybrid", response_model=RunRecord, status_code=202)
async def start_hybrid(
    body: HybridRequest,
    db: Session = Depends(get_db),
    ws: str = Depends(get_workspace),
    routing: OSRMClient = Depends(get_routing),
    runs: RunManager = Depends(get_run_manager),
    settings: Settings = Depends(get_settings),
):
    stops, vehicles, dist, dur, source, fb = await resolve_classical(body, db, ws, routing)
    limit = body.time_limit_s or settings.classical_time_limit_s

    def work(cancel) -> OptimizationResult:
        result = solve_hybrid(stops, vehicles, dist, dur, body, limit, cancel)
        result.distance_source, result.fallback_estimate = source, fb
        if fb:
            result.notes.append("Distances are straight-line FALLBACK ESTIMATES (OSRM unavailable).")
        return result

    req_dump = body.model_dump(mode="json", exclude={"matrices"})
    req_dump.update(stops=[s.model_dump() for s in stops], vehicles=[v.model_dump() for v in vehicles])
    return runs.submit("hybrid", req_dump, work, timeout_s=2 * limit + body.quantum_timeout_s + 15,
                       timeout_exc=(QuantumTimeout,), cancel_exc=(QuantumCancelled,))


@router.post("/quantum", response_model=RunRecord, status_code=202)
async def start_quantum(
    body: QuantumRequest,
    db: Session = Depends(get_db),
    ws: str = Depends(get_workspace),
    routing: OSRMClient = Depends(get_routing),
    runs: RunManager = Depends(get_run_manager),
    settings: Settings = Depends(get_settings),
):
    stops, vehicle, dist, dur, source, fb = await resolve_quantum(body, db, ws, routing)
    if len(stops) > settings.quantum_max_stops:  # fail fast, before queueing
        raise HTTPException(
            422,
            {"code": "quantum_size_limit",
             "message": f"{len(stops)} stops exceeds the simulation limit of {settings.quantum_max_stops}."},
        )
    timeout = body.timeout_s or settings.quantum_timeout_s

    def work(cancel) -> object:
        res = solve_quantum(
            stops, dist, dur, vehicle, body.objective, body.return_to_depot, body.reps, body.max_iterations,
            body.shots, body.seed, timeout, settings.quantum_max_stops, cancel, restarts=body.restarts,
        )
        res.distance_source, res.fallback_estimate = source, fb
        return res

    req_dump = {
        "stops": [s.model_dump() for s in stops], "objective": body.objective, "reps": body.reps,
        "depot": body.depot.model_dump() if body.depot else None, "depot_location_id": body.depot_location_id,
        "return_to_depot": body.return_to_depot, "vehicle": vehicle.model_dump() if vehicle else None,
    }
    return runs.submit(
        "quantum", req_dump, work, timeout_s=timeout + 5,
        timeout_exc=(QuantumTimeout,), cancel_exc=(QuantumCancelled,),
    )


@router.post("/annealing", response_model=RunRecord | QuantumResult, status_code=202)
async def start_annealing(
    body: AnnealingRequest,
    sync: bool = Query(False),
    db: Session = Depends(get_db),
    ws: str = Depends(get_workspace),
    routing: OSRMClient = Depends(get_routing),
    runs: RunManager = Depends(get_run_manager),
    settings: Settings = Depends(get_settings),
):
    stops, vehicle, dist, dur, source, fb = await resolve_annealing(body, db, ws, routing)
    timeout = body.timeout_s or 60.0

    def work(cancel) -> QuantumResult:
        res = solve_simulated_annealing(
            stops, dist, dur, vehicle=vehicle, return_to_depot=body.return_to_depot,
            initial_temp=body.initial_temp, final_temp=body.final_temp,
            cooling_rate=body.cooling_rate, steps=body.steps, seed=body.seed,
            objective=body.objective, timeout_s=timeout, cancel_event=cancel,
        )
        res.distance_source, res.fallback_estimate = source, fb
        return res

    if sync:
        return work(None)

    req_dump = {
        "stops": [s.model_dump() for s in stops], "objective": body.objective,
        "initial_temp": body.initial_temp, "final_temp": body.final_temp,
        "cooling_rate": body.cooling_rate, "steps": body.steps, "seed": body.seed,
        "depot": body.depot.model_dump() if body.depot else None, "depot_location_id": body.depot_location_id,
        "return_to_depot": body.return_to_depot, "vehicle": vehicle.model_dump() if vehicle else None,
    }
    return runs.submit(
        "annealing", req_dump, work, timeout_s=timeout + 5,
        timeout_exc=(QuantumTimeout,), cancel_exc=(QuantumCancelled,),
    )


@router.post("/reroute", response_model=DynamicRerouteResult, status_code=200)
async def dynamic_reroute_endpoint(
    body: DynamicRerouteRequest,
    routing: OSRMClient = Depends(get_routing),
):
    return await reroute_dynamic(body, routing=routing)


@router.get("/runs", response_model=Page[RunRecord])
def list_runs(
    kind: str | None = Query(None, pattern="^(classical|quantum|hybrid|annealing)$"),
    status: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    runs: RunManager = Depends(get_run_manager),
):
    items, total = runs.store.list(kind, status, limit, offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/runs/{run_id}", response_model=RunRecord)
def get_run(run_id: str, runs: RunManager = Depends(get_run_manager)):
    rec = runs.store.get(run_id)
    if rec is None:
        raise HTTPException(404, "run not found")
    return rec


@router.post("/runs/{run_id}/cancel", response_model=RunRecord)
def cancel_run(run_id: str, runs: RunManager = Depends(get_run_manager)):
    rec = runs.cancel(run_id)
    if rec is None:
        raise HTTPException(404, "run not found")
    return rec


@router.get("/compare")
def compare(classical: str, quantum: str, runs: RunManager = Depends(get_run_manager)):
    c, q = runs.store.get(classical), runs.store.get(quantum)
    if c is None or q is None:
        raise HTTPException(404, "run not found")
    if c.kind != "classical" or q.kind != "quantum":
        raise HTTPException(422, "expected classical=<classical run id>&quantum=<quantum run id>")
    out: dict = {
        "classical": {"id": c.id, "status": c.status, "result": c.result},
        "quantum": {"id": q.id, "status": q.status, "result": q.result},
        "comparable": False,
        "disclaimer": "Quantum figures come from a classical simulation of QAOA; no quantum advantage is implied.",
    }
    if not (c.result and q.result):
        out["note"] = "Both runs must have succeeded to compare."
        return out
    c_ids = {s["stop_id"] for r in c.result["routes"] for s in r["stops"]}
    q_ids = set(q.result["order"])
    if c_ids != q_ids or len(c.result["routes"]) != 1 or q.result["objective"] != "distance":
        out["note"] = "Runs are not directly comparable (different stop sets, multiple vehicles, or non-distance objective)."
        return out
    cd, qd = c.result["total_distance_km"], q.result["cost"]
    out.update(
        comparable=True, classical_distance_km=cd, quantum_distance_km=qd,
        quantum_minus_classical_km=round(qd - cd, 4),
        note="Classical solver optimises a weighted objective, so its distance need not be the minimum.",
    )
    return out
