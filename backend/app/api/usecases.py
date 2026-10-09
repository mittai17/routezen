"""Request resolution (DB lookups + routing) shared by routers and scenarios."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Location, Package, VehicleProfile
from app.schemas.common import Coordinate
from app.schemas.optimization import (
    AnnealingRequest, Matrices, OptDepot, OptimizationRequest, OptStop, OptVehicle, QuantumRequest,
)
from app.schemas.recommendation import (
    DepotInput, PackageInput, PackageRecommendation, RecommendationRequest, VehicleSpec,
)
from app.services import recommendation as engine
from app.services.optimizer_classical import _validate_matrix
from app.services.routing import InvalidCoordinates, OSRMClient, RoutingUnavailable


def routing_http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, RoutingUnavailable):
        return HTTPException(503, {"code": "routing_unavailable", "message": str(exc)})
    return HTTPException(422, {"code": "invalid_coordinates", "message": str(exc)})


def vehicle_spec(v: VehicleProfile) -> VehicleSpec:
    return VehicleSpec(
        vehicle_id=v.id, name=v.name, category=v.category, payload_kg=v.payload_kg, volume_m3=v.volume_m3,
        energy_type=v.energy_type, efficiency_value=v.efficiency_value, efficiency_unit=v.efficiency_unit,
        energy_price=v.energy_price, fixed_cost_per_delivery=v.fixed_cost_per_delivery,
        operating_cost_per_km=v.operating_cost_per_km, avg_speed_kmph=v.avg_speed_kmph,
        emissions_g_per_km=v.emissions_g_per_km, range_km=v.range_km, available=v.available,
        verification=v.verification,
    )


def load_vehicles(db: Session, ws: str, ids: list[str] | None) -> list[VehicleProfile]:
    stmt = select(VehicleProfile).where(VehicleProfile.workspace_id == ws)
    if ids:
        stmt = stmt.where(VehicleProfile.id.in_(ids))
    rows = list(db.scalars(stmt.order_by(VehicleProfile.name, VehicleProfile.id)))
    if ids and len({r.id for r in rows}) != len(set(ids)):
        missing = sorted(set(ids) - {r.id for r in rows})
        raise HTTPException(422, f"unknown vehicle ids: {missing}")
    return rows


def load_packages(db: Session, ws: str, ids: list[str]) -> list[Package]:
    rows = {p.id: p for p in db.scalars(select(Package).where(Package.workspace_id == ws, Package.id.in_(ids)))}
    missing = [i for i in ids if i not in rows]
    if missing:
        raise HTTPException(422, f"unknown package ids: {missing}")
    return [rows[i] for i in ids]


def package_coords(db: Session, p: Package) -> tuple[float, float]:
    if p.latitude is not None and p.longitude is not None:
        return p.latitude, p.longitude
    loc = db.get(Location, p.location_id) if p.location_id else None
    if loc is None:
        raise HTTPException(422, f"package '{p.reference}' has no coordinates or location")
    return loc.latitude, loc.longitude


def resolve_depot(db: Session, ws: str, depot, depot_location_id: str | None) -> tuple[float, float]:
    if depot is not None:
        return depot.latitude, depot.longitude
    if depot_location_id:
        loc = db.get(Location, depot_location_id)
        if loc is None or loc.workspace_id != ws:
            raise HTTPException(422, f"unknown depot_location_id '{depot_location_id}'")
        return loc.latitude, loc.longitude
    raise HTTPException(422, "depot or depot_location_id is required")


# ---------------------------------------------------------------- recommendations
async def run_recommendation(
    req: RecommendationRequest, db: Session, ws: str, routing: OSRMClient
) -> list[PackageRecommendation]:
    depot_lat, depot_lng = resolve_depot(db, ws, req.depot, req.depot_location_id)
    pkgs: list[PackageInput] = ([req.package] if req.package else []) + list(req.packages)
    for p in load_packages(db, ws, req.package_ids):
        lat, lng = package_coords(db, p)
        pkgs.append(PackageInput(
            package_id=p.id, weight_kg=p.weight_kg, volume_m3=p.volume_m3 or 0, latitude=lat, longitude=lng,
            deadline=p.deadline, service_minutes=p.service_minutes,
        ))
    if not pkgs:
        raise HTTPException(422, "at least one package is required")
    vehicles = [vehicle_spec(v) for v in load_vehicles(db, ws, req.vehicle_ids)]
    prefs = req.preferences
    out: list[PackageRecommendation] = []
    chunk = max(1, routing.max_coordinates - 1)
    for i in range(0, len(pkgs), chunk):
        part = pkgs[i : i + chunk]
        coords = [Coordinate(lat=depot_lat, lng=depot_lng)] + [Coordinate(lat=p.latitude, lng=p.longitude) for p in part]
        try:
            m = await routing.matrix_or_fallback(coords, prefs.allow_fallback_estimate)
        except (RoutingUnavailable, InvalidCoordinates) as exc:
            raise routing_http_error(exc) from exc
        for j, p in enumerate(part, start=1):
            out.append(engine.recommend(
                p, m.distance_km[0][j], m.duration_min[0][j], vehicles, prefs, distance_source=m.provider,
            ))
    return out


# ---------------------------------------------------------------- optimization
def _minutes(dt: datetime | None, start: datetime) -> float | None:
    return None if dt is None else (dt.astimezone(timezone.utc) - start).total_seconds() / 60


def opt_vehicle(v: VehicleProfile) -> OptVehicle:
    # energy cost per km = price / efficiency for both km/L and km/kWh (= price * kWh_per_km)
    energy_per_km = float(v.energy_price) / v.efficiency_value
    return OptVehicle(
        vehicle_id=v.id, name=v.name, payload_kg=v.payload_kg, volume_m3=v.volume_m3, available=v.available,
        cost_per_km=energy_per_km + float(v.operating_cost_per_km), fixed_cost=float(v.fixed_cost_per_delivery),
        emissions_g_per_km=v.emissions_g_per_km,
    )


def resolve_stops(db: Session, ws: str, stops: list[OptStop], package_ids: list[str], start: datetime) -> list[OptStop]:
    out = list(stops)
    for p in load_packages(db, ws, package_ids):
        lat, lng = package_coords(db, p)
        ends = [m for m in (_minutes(p.window_end, start), _minutes(p.deadline, start)) if m is not None]
        ws_min = _minutes(p.window_start, start)
        if ends and min(ends) < 0:
            raise HTTPException(422, f"package '{p.reference}' has a delivery window or deadline before route start")
        if ends and ws_min is not None and ws_min > min(ends):
            raise HTTPException(422, f"package '{p.reference}' has no feasible delivery window before its deadline")
        out.append(OptStop(
            id=p.id, latitude=lat, longitude=lng, weight_kg=p.weight_kg, volume_m3=p.volume_m3 or 0,
            service_minutes=p.service_minutes,
            window_start_min=max(0.0, ws_min) if ws_min is not None else None,
            window_end_min=max(0.0, min(ends)) if ends else None,
        ))
    if len(out) > 200:
        raise HTTPException(422, "at most 200 total stops and packages are supported")
    ids = [s.id for s in out]
    if len(set(ids)) != len(ids):
        raise HTTPException(422, "stop ids must be unique, including resolved packages")
    return out


async def build_matrices(
    depot: tuple[float, float], stops: list[OptStop], given: Matrices | None, routing: OSRMClient, allow_fallback: bool
) -> tuple[list[list[float]], list[list[float]], str, bool]:
    if given is not None:
        try:
            _validate_matrix(given.distance_km, len(stops) + 1, "distance_km")
            _validate_matrix(given.duration_min, len(stops) + 1, "duration_min")
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return given.distance_km, given.duration_min, "provided", False
    coords = [Coordinate(lat=depot[0], lng=depot[1])] + [Coordinate(lat=s.latitude, lng=s.longitude) for s in stops]
    try:
        m = await routing.matrix_or_fallback(coords, allow_fallback)
    except (RoutingUnavailable, InvalidCoordinates) as exc:
        raise routing_http_error(exc) from exc
    return m.distance_km, m.duration_min, m.provider, m.fallback_estimate


async def resolve_classical(req: OptimizationRequest, db: Session, ws: str, routing: OSRMClient):
    depot = resolve_depot(db, ws, req.depot, req.depot_location_id)
    start = (req.start_time or datetime.now(timezone.utc)).astimezone(timezone.utc)
    stops = resolve_stops(db, ws, req.stops, req.package_ids, start)
    vehicles = list(req.vehicles)
    if not vehicles:
        rows = load_vehicles(db, ws, req.vehicle_ids or None)
        vehicles = [opt_vehicle(v) for v in rows]
    if not vehicles:
        raise HTTPException(422, "no vehicles supplied or found")
    if len({v.vehicle_id for v in vehicles}) != len(vehicles):
        raise HTTPException(422, "vehicle ids must be unique")
    dist, dur, source, fb = await build_matrices(depot, stops, req.matrices, routing, req.allow_fallback_estimate)
    return stops, vehicles, dist, dur, source, fb


async def resolve_quantum(req: QuantumRequest, db: Session, ws: str, routing: OSRMClient):
    depot = resolve_depot(db, ws, req.depot, req.depot_location_id)
    stops = resolve_stops(db, ws, req.stops, req.package_ids, datetime.now(timezone.utc))
    vehicle = req.vehicle
    if vehicle is None and req.vehicle_id:
        rows = load_vehicles(db, ws, [req.vehicle_id])
        vehicle = opt_vehicle(rows[0])
    dist, dur, source, fb = await build_matrices(depot, stops, req.matrices, routing, req.allow_fallback_estimate)
    return stops, vehicle, dist, dur, source, fb


async def resolve_annealing(req: AnnealingRequest, db: Session, ws: str, routing: OSRMClient):
    depot = resolve_depot(db, ws, req.depot, req.depot_location_id)
    stops = resolve_stops(db, ws, req.stops, req.package_ids, datetime.now(timezone.utc))
    vehicle = req.vehicle
    if vehicle is None and req.vehicle_id:
        rows = load_vehicles(db, ws, [req.vehicle_id])
        vehicle = opt_vehicle(rows[0])
    dist, dur, source, fb = await build_matrices(depot, stops, req.matrices, routing, req.allow_fallback_estimate)
    return stops, vehicle, dist, dur, source, fb
