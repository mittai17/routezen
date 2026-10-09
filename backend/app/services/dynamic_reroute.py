"""Dynamic in-transit reroute engine for ROUTEZEN.

Handles real-time dispatch disruptions:
- Completed stops are filtered out and excluded from the new plan.
- Disrupted or broken-down vehicles have their remaining stops reassigned to available vehicles.
- In-transit vehicles with updated GPS coordinates start from virtual origins rather than the depot.
- Emergency / newly added pickup/delivery stops are dynamically inserted into the routes.
- Computes updated distance/duration matrices using OSRM or Haversine fallback.
- Uses OR-Tools classical optimization engine with multi-origin routing.
"""
from __future__ import annotations

import logging
from typing import Any

from app.schemas.common import Coordinate
from app.schemas.optimization import (
    DynamicRerouteRequest, DynamicRerouteResult, OptStop, OptVehicle, Unassigned,
)
from app.services.optimizer_classical import solve_classical
from app.services.routing import OSRMClient

log = logging.getLogger(__name__)


def _extract_positions(req: DynamicRerouteRequest) -> dict[str, Coordinate]:
    positions: dict[str, Coordinate] = {}
    if isinstance(req.vehicle_positions, dict):
        for k, v in req.vehicle_positions.items():
            if isinstance(v, Coordinate):
                positions[k] = v
            elif isinstance(v, dict):
                positions[k] = Coordinate(lat=v["lat"], lng=v["lng"])
            elif hasattr(v, "lat") and hasattr(v, "lng"):
                positions[k] = Coordinate(lat=v.lat, lng=v.lng)
            elif hasattr(v, "latitude") and hasattr(v, "longitude"):
                positions[k] = Coordinate(lat=v.latitude, lng=v.longitude)
    elif isinstance(req.vehicle_positions, list):
        for item in req.vehicle_positions:
            if hasattr(item, "vehicle_id"):
                positions[item.vehicle_id] = Coordinate(lat=item.latitude, lng=item.longitude)
            elif isinstance(item, dict):
                positions[item["vehicle_id"]] = Coordinate(lat=item["latitude"], lng=item["longitude"])
    return positions


async def reroute_dynamic(
    req: DynamicRerouteRequest,
    routing: OSRMClient | None = None,
) -> DynamicRerouteResult:
    """Compute an in-transit dynamic reroute plan."""
    completed_ids = set(req.completed_stop_ids)
    disrupted_ids = set(req.disrupted_vehicle_ids)

    # 1. Filter out completed stops and merge new emergency stops
    remaining_stops = [s for s in req.stops if s.id not in completed_ids]
    emergency_stops = [s for s in req.new_stops if s.id not in completed_ids]
    seen_ids = {s.id for s in remaining_stops}
    for s in emergency_stops:
        if s.id not in seen_ids:
            remaining_stops.append(s)
            seen_ids.add(s.id)

    completed_count = len(completed_ids)
    emergency_count = len(emergency_stops)

    if not remaining_stops:
        return DynamicRerouteResult(
            status="empty",
            completed_stops_count=completed_count,
            emergency_stops_count=emergency_count,
            disrupted_vehicles=list(disrupted_ids),
            notes=["All stops completed or no pending stops to route."],
        )

    # 2. Filter active vehicles excluding disrupted/broken-down vehicles
    active_vehicles = [
        v for v in req.vehicles
        if v.available and v.vehicle_id not in disrupted_ids
    ]
    disrupted_vehicles = [
        v.vehicle_id for v in req.vehicles
        if v.vehicle_id in disrupted_ids or not v.available
    ]
    for vid in disrupted_ids:
        if vid not in disrupted_vehicles:
            disrupted_vehicles.append(vid)

    if not active_vehicles:
        return DynamicRerouteResult(
            status="infeasible",
            unassigned=[
                Unassigned(stop_id=s.id, reason="No available vehicles after disruptions")
                for s in remaining_stops
            ],
            completed_stops_count=completed_count,
            emergency_stops_count=emergency_count,
            disrupted_vehicles=disrupted_vehicles,
            notes=["No active vehicles available to route remaining stops."],
        )

    # 3. Determine vehicle origins and depot
    positions = _extract_positions(req)

    if req.depot is not None:
        depot_coord = Coordinate(lat=req.depot.latitude, lng=req.depot.longitude)
    elif active_vehicles and active_vehicles[0].vehicle_id in positions:
        depot_coord = positions[active_vehicles[0].vehicle_id]
    else:
        depot_coord = Coordinate(lat=remaining_stops[0].latitude, lng=remaining_stops[0].longitude)

    # 4. Matrices & Multi-Origin coordinates setup
    if req.matrices is not None:
        dist_matrix = req.matrices.distance_km
        dur_matrix = req.matrices.duration_min
        source = "provided"
        fallback = False
        starts = [0] * len(active_vehicles)
        ends = [0] * len(active_vehicles)
        customer_nodes = list(range(1, len(remaining_stops) + 1))
    else:
        # Build coordinates list:
        # Node 0: Depot
        # Nodes 1..m: Vehicle virtual origins
        # Nodes m+1..m+p: Stops
        coords: list[Coordinate] = [depot_coord]
        starts = []
        for v in active_vehicles:
            if v.vehicle_id in positions:
                coords.append(positions[v.vehicle_id])
                starts.append(len(coords) - 1)
            else:
                starts.append(0)

        customer_nodes = []
        for s in remaining_stops:
            coords.append(Coordinate(lat=s.latitude, lng=s.longitude))
            customer_nodes.append(len(coords) - 1)

        ends = [0] * len(active_vehicles) if req.return_to_depot else list(starts)

        if routing is not None:
            m_resp = await routing.matrix_or_fallback(coords, req.allow_fallback_estimate)
        else:
            m_resp = OSRMClient.fallback_matrix(coords)

        dist_matrix = m_resp.distance_km
        dur_matrix = m_resp.duration_min
        source = m_resp.provider
        fallback = m_resp.fallback_estimate

    # 5. Solve routing with OR-Tools
    limit = req.time_limit_s or 5
    opt_result = solve_classical(
        stops=remaining_stops,
        vehicles=active_vehicles,
        distance_km=dist_matrix,
        duration_min=dur_matrix,
        weights=req.weights,
        return_to_depot=req.return_to_depot,
        time_limit_s=limit,
        horizon_min=req.horizon_min,
        starts=starts,
        ends=ends,
        customer_nodes=customer_nodes,
    )

    # 6. Track reassigned stops count
    served_stop_ids = {visit.stop_id for r in opt_result.routes for visit in r.stops}
    reassigned_count = 0
    if req.original_routes is not None:
        disrupted_stops = {
            sid for vid in disrupted_ids
            for sid in req.original_routes.get(vid, [])
            if sid not in completed_ids
        }
        reassigned_count = len(disrupted_stops & served_stop_ids)
    elif disrupted_ids:
        # If disrupted vehicles occurred, any stops now served were reallocated
        reassigned_count = len(served_stop_ids)

    notes = list(opt_result.notes)
    if fallback:
        notes.append("Distances are straight-line FALLBACK ESTIMATES (OSRM unavailable).")
    if disrupted_vehicles:
        notes.append(
            f"Disrupted vehicles excluded: {disrupted_vehicles}. "
            f"Stops reassigned to {len(active_vehicles)} available vehicle(s)."
        )
    if completed_count > 0:
        notes.append(f"{completed_count} completed stop(s) excluded from dispatch plan.")
    if emergency_count > 0:
        notes.append(f"{emergency_count} emergency/new stop(s) added to routes.")

    return DynamicRerouteResult(
        status=opt_result.status,
        routes=opt_result.routes,
        unassigned=opt_result.unassigned,
        total_distance_km=opt_result.total_distance_km,
        total_duration_min=opt_result.total_duration_min,
        total_cost=opt_result.total_cost,
        total_emissions_g=opt_result.total_emissions_g,
        runtime_ms=opt_result.runtime_ms,
        completed_stops_count=completed_count,
        reassigned_stops_count=reassigned_count,
        emergency_stops_count=emergency_count,
        disrupted_vehicles=disrupted_vehicles,
        active_vehicles=[v.vehicle_id for v in active_vehicles],
        distance_source=source,
        fallback_estimate=fallback,
        notes=notes,
    )


def solve_dynamic_reroute_sync(req: DynamicRerouteRequest) -> DynamicRerouteResult:
    """Synchronous helper for dynamic reroute using precomputed or Haversine fallback matrix."""
    import asyncio
    return asyncio.run(reroute_dynamic(req, routing=None))
