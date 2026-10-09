"""Unit and API tests for dynamic in-transit rerouting."""
import pytest

from app.schemas.common import Coordinate
from app.schemas.optimization import (
    DynamicRerouteRequest, OptDepot, OptStop, OptVehicle,
)
from app.services.dynamic_reroute import reroute_dynamic, solve_dynamic_reroute_sync


def make_test_data():
    depot = OptDepot(latitude=13.00, longitude=80.00, name="Central Depot")
    vehicles = [
        OptVehicle(vehicle_id="v1", payload_kg=200, volume_m3=5, max_stops=10),
        OptVehicle(vehicle_id="v2", payload_kg=200, volume_m3=5, max_stops=10),
    ]
    stops = [
        OptStop(id="s1", latitude=13.02, longitude=80.02, weight_kg=15, volume_m3=0.2),
        OptStop(id="s2", latitude=13.03, longitude=80.03, weight_kg=15, volume_m3=0.2),
        OptStop(id="s3", latitude=13.04, longitude=80.04, weight_kg=20, volume_m3=0.3),
        OptStop(id="s4", latitude=13.05, longitude=80.05, weight_kg=20, volume_m3=0.3),
    ]
    return depot, vehicles, stops


@pytest.mark.asyncio
async def test_completed_stops_excluded():
    depot, vehicles, stops = make_test_data()
    req = DynamicRerouteRequest(
        depot=depot,
        vehicles=vehicles,
        stops=stops,
        completed_stop_ids=["s1", "s2"],
        allow_fallback_estimate=True,
    )
    result = await reroute_dynamic(req)
    assert result.status in ("solved", "partial")
    assert result.completed_stops_count == 2
    served_ids = {visit.stop_id for r in result.routes for visit in r.stops}
    # s1 and s2 MUST NOT be in new routes
    assert "s1" not in served_ids
    assert "s2" not in served_ids
    # s3 and s4 MUST be routed
    assert "s3" in served_ids
    assert "s4" in served_ids


@pytest.mark.asyncio
async def test_vehicle_breakdown_reallocates_remaining_stops():
    depot, vehicles, stops = make_test_data()
    original_routes = {
        "v1": ["s1", "s2"],
        "v2": ["s3", "s4"],
    }
    # v1 broke down; s1 was already completed by v1 before breaking down;
    # s2 was left on v1 and must be reassigned to v2.
    req = DynamicRerouteRequest(
        depot=depot,
        vehicles=vehicles,
        stops=stops,
        completed_stop_ids=["s1"],
        disrupted_vehicle_ids=["v1"],
        original_routes=original_routes,
        allow_fallback_estimate=True,
    )
    result = await reroute_dynamic(req)
    assert result.status in ("solved", "partial")
    assert "v1" in result.disrupted_vehicles
    assert result.active_vehicles == ["v2"]

    # Only v2 has active routes
    route_vehicle_ids = {r.vehicle_id for r in result.routes}
    assert "v1" not in route_vehicle_ids
    assert "v2" in route_vehicle_ids

    # s2 (orphaned by v1) and s3, s4 are served by v2
    v2_served = {visit.stop_id for r in result.routes if r.vehicle_id == "v2" for visit in r.stops}
    assert "s2" in v2_served
    assert "s3" in v2_served
    assert "s4" in v2_served
    assert result.reassigned_stops_count >= 1


@pytest.mark.asyncio
async def test_virtual_origins_routed():
    depot, vehicles, stops = make_test_data()
    # Vehicles in-transit at specific GPS coordinates
    positions = {
        "v1": Coordinate(lat=13.06, lng=80.06),
        "v2": Coordinate(lat=13.08, lng=80.08),
    }
    req = DynamicRerouteRequest(
        depot=depot,
        vehicles=vehicles,
        stops=stops,
        vehicle_positions=positions,
        allow_fallback_estimate=True,
    )
    result = await reroute_dynamic(req)
    assert result.status in ("solved", "partial")
    assert len(result.routes) >= 1
    # Check that distance and duration are positive and finite
    assert result.total_distance_km > 0
    assert result.total_duration_min > 0


@pytest.mark.asyncio
async def test_emergency_new_stops_added():
    depot, vehicles, stops = make_test_data()
    emergency_stop = OptStop(id="emer_1", latitude=13.025, longitude=80.025, weight_kg=10, volume_m3=0.1)
    req = DynamicRerouteRequest(
        depot=depot,
        vehicles=vehicles,
        stops=stops,
        new_stops=[emergency_stop],
        completed_stop_ids=["s1"],
        allow_fallback_estimate=True,
    )
    result = await reroute_dynamic(req)
    assert result.status in ("solved", "partial")
    assert result.emergency_stops_count == 1
    served_ids = {visit.stop_id for r in result.routes for visit in r.stops}
    assert "emer_1" in served_ids
    assert "s1" not in served_ids


@pytest.mark.asyncio
async def test_all_vehicles_disrupted():
    depot, vehicles, stops = make_test_data()
    req = DynamicRerouteRequest(
        depot=depot,
        vehicles=vehicles,
        stops=stops,
        disrupted_vehicle_ids=["v1", "v2"],
        allow_fallback_estimate=True,
    )
    result = await reroute_dynamic(req)
    assert result.status == "infeasible"
    assert len(result.unassigned) == 4
    assert set(result.disrupted_vehicles) == {"v1", "v2"}


@pytest.mark.asyncio
async def test_all_stops_completed():
    depot, vehicles, stops = make_test_data()
    req = DynamicRerouteRequest(
        depot=depot,
        vehicles=vehicles,
        stops=stops,
        completed_stop_ids=["s1", "s2", "s3", "s4"],
        allow_fallback_estimate=True,
    )
    result = await reroute_dynamic(req)
    assert result.status == "empty"
    assert result.completed_stops_count == 4


def test_sync_reroute_helper():
    depot, vehicles, stops = make_test_data()
    req = DynamicRerouteRequest(
        depot=depot,
        vehicles=vehicles,
        stops=stops,
        completed_stop_ids=["s1"],
        allow_fallback_estimate=True,
    )
    result = solve_dynamic_reroute_sync(req)
    assert result.status in ("solved", "partial")
    assert result.completed_stops_count == 1


def test_api_reroute_endpoint(api):
    body = {
        "depot": {"latitude": 13.0, "longitude": 80.0},
        "vehicles": [
            {"vehicle_id": "v1", "payload_kg": 150, "volume_m3": 3},
            {"vehicle_id": "v2", "payload_kg": 150, "volume_m3": 3},
        ],
        "stops": [
            {"id": "a", "latitude": 13.02, "longitude": 80.02, "weight_kg": 10},
            {"id": "b", "latitude": 13.03, "longitude": 80.03, "weight_kg": 10},
            {"id": "c", "latitude": 13.04, "longitude": 80.04, "weight_kg": 10},
        ],
        "completed_stop_ids": ["a"],
        "disrupted_vehicle_ids": ["v1"],
        "vehicle_positions": {
            "v2": {"lat": 13.01, "lng": 80.01}
        },
        "new_stops": [
            {"id": "emer", "latitude": 13.025, "longitude": 80.025, "weight_kg": 5}
        ],
        "allow_fallback_estimate": True,
    }
    resp = api.post("/optimization/reroute", json=body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("solved", "partial")
    assert data["completed_stops_count"] == 1
    assert data["emergency_stops_count"] == 1
    assert data["disrupted_vehicles"] == ["v1"]
    assert data["active_vehicles"] == ["v2"]
    served = {v["stop_id"] for r in data["routes"] for v in r["stops"]}
    assert "a" not in served
    assert "b" in served
    assert "emer" in served
