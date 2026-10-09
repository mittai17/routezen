import pytest

from app.schemas.optimization import OptStop, OptVehicle, OptWeights
from app.services.optimizer_classical import solve_classical


def line_matrices(n, step=10.0, speed_kmph=60.0):
    """Depot at 0 and stops on a line, `step` km apart."""
    D = [[abs(i - j) * step for j in range(n + 1)] for i in range(n + 1)]
    T = [[d / speed_kmph * 60 for d in row] for row in D]
    return D, T


def stop(i, **o):
    return OptStop(id=f"s{i}", latitude=13, longitude=80, weight_kg=10, volume_m3=0.1, service_minutes=0, **o)


def vehicle(vid="v1", **o):
    base = dict(vehicle_id=vid, payload_kg=100, volume_m3=1.0, cost_per_km=2.0, emissions_g_per_km=50)
    base.update(o)
    return OptVehicle(**base)


def solve(stops, vehicles, **kw):
    D, T = line_matrices(len(stops))
    return solve_classical(stops, vehicles, D, T, time_limit_s=1, **kw)


def served(res):
    return {s.stop_id for r in res.routes for s in r.stops}


def test_empty():
    res = solve([], [vehicle()])
    assert res.status == "empty" and res.routes == []


def test_single_stop():
    res = solve([stop(1)], [vehicle()])
    assert res.status == "solved" and len(res.routes) == 1
    assert res.routes[0].distance_km == 20  # out and back
    assert res.total_cost == 40 and res.total_emissions_g == 1000


def test_no_return_to_depot():
    res = solve([stop(1)], [vehicle()], return_to_depot=False)
    assert res.routes[0].distance_km == 10


def test_multi_stop_visits_in_line_order_single_route():
    res = solve([stop(i) for i in range(1, 6)], [vehicle()])
    assert res.status == "solved" and served(res) == {f"s{i}" for i in range(1, 6)}
    assert res.routes[0].distance_km == 100  # optimal: out to farthest and back
    assert [s.stop_id for s in res.routes[0].stops] == [f"s{i}" for i in range(1, 6)]


def test_capacity_forces_multiple_vehicles_and_never_overloads():
    stops = [stop(i, ) for i in range(1, 5)]
    for s in stops:
        s.weight_kg = 40
    res = solve(stops, [vehicle("a", payload_kg=80), vehicle("b", payload_kg=80)])
    assert res.status == "solved" and len(res.routes) == 2
    assert all(r.load_kg <= 80 for r in res.routes)


def test_volume_capacity_respected():
    stops = [stop(1), stop(2)]
    for s in stops:
        s.volume_m3 = 0.6
    res = solve(stops, [vehicle(volume_m3=1.0)])
    assert res.status == "partial" and len(served(res)) == 1 and len(res.unassigned) == 1


def test_insufficient_capacity_reports_unassigned_with_reason():
    stops = [stop(1), stop(2)]
    stops[1].weight_kg = 500
    res = solve(stops, [vehicle()])
    assert res.status == "partial" and served(res) == {"s1"}
    assert res.unassigned[0].stop_id == "s2" and "payload" in res.unassigned[0].reason


def test_all_stops_too_heavy_is_infeasible():
    s = stop(1)
    s.weight_kg = 1000
    res = solve([s], [vehicle()])
    assert res.status == "infeasible" and res.routes == [] and len(res.unassigned) == 1


def test_time_windows_respected():
    # 10 km at 60 km/h = 10 min between nodes
    stops = [stop(1, window_start_min=0, window_end_min=15), stop(2, window_start_min=0, window_end_min=25)]
    res = solve(stops, [vehicle()])
    assert res.status == "solved"
    arrivals = {s.stop_id: s.arrival_min for s in res.routes[0].stops}
    assert arrivals["s1"] <= 15 and arrivals["s2"] <= 25


def test_waits_for_window_start():
    res = solve([stop(1, window_start_min=60, window_end_min=90)], [vehicle()])
    assert res.routes[0].stops[0].arrival_min == pytest.approx(60)


def test_deadline_unreachable_is_unassigned():
    res = solve([stop(1, window_end_min=5)], [vehicle()])  # needs 10 min
    assert res.status == "infeasible" and "Unreachable" in res.unassigned[0].reason


def test_tight_deadlines_split_across_vehicles():
    # both stops need to be reached within ~10 min of depot-equivalent time; one vehicle cannot do both
    D = [[0, 10, 10], [10, 0, 20], [10, 20, 0]]
    T = [[x for x in row] for row in D]  # 1 min per km
    stops = [stop(1, window_end_min=10), stop(2, window_end_min=10)]
    res = solve_classical(stops, [vehicle("a"), vehicle("b")], D, T, time_limit_s=1)
    assert res.status == "solved" and len(res.routes) == 2


def test_unavailable_vehicle_not_used_and_none_available_is_infeasible():
    res = solve([stop(1)], [vehicle("a", available=False), vehicle("b")])
    assert [r.vehicle_id for r in res.routes] == ["b"]
    res = solve([stop(1)], [vehicle("a", available=False)])
    assert res.status == "infeasible" and res.unassigned[0].reason == "No available vehicles"


def test_max_stops_per_vehicle():
    res = solve([stop(i) for i in range(1, 5)], [vehicle("a", max_stops=2), vehicle("b", max_stops=2)])
    assert res.status == "solved" and all(len(r.stops) <= 2 for r in res.routes)
    res = solve([stop(i) for i in range(1, 5)], [vehicle("a", max_stops=2)])
    assert res.status == "partial" and len(res.unassigned) == 2


def test_weights_affect_vehicle_choice():
    stops = [stop(1)]
    cheap_dirty = vehicle("cheap", cost_per_km=1, emissions_g_per_km=500)
    pricey_clean = vehicle("clean", cost_per_km=5, emissions_g_per_km=0)
    cost_w = OptWeights(distance=0, time=0, cost=1, emissions=0)
    em_w = OptWeights(distance=0, time=0, cost=0, emissions=1)
    assert solve(stops, [cheap_dirty, pricey_clean], weights=cost_w).routes[0].vehicle_id == "cheap"
    assert solve(stops, [cheap_dirty, pricey_clean], weights=em_w).routes[0].vehicle_id == "clean"


def test_bad_input_rejected():
    with pytest.raises(ValueError):
        solve_classical([stop(1)], [vehicle()], [[0]], [[0]])
    with pytest.raises(ValueError):
        solve_classical([stop(1), stop(1)], [vehicle()], *line_matrices(2))
    with pytest.raises(ValueError):
        D, T = line_matrices(1)
        D[0][1] = -1
        solve_classical([stop(1)], [vehicle()], D, T)
    with pytest.raises(ValueError):
        OptWeights(distance=0, time=0, cost=0, emissions=0)
    with pytest.raises(ValueError):
        OptStop(id="x", latitude=13, longitude=80, window_start_min=10, window_end_min=5)


async def test_classical_api_async_run_and_cancel(api):
    import asyncio
    body = {
        "depot": {"latitude": 13.0, "longitude": 80.0},
        "stops": [{"id": "a", "latitude": 13.05, "longitude": 80.0, "weight_kg": 10},
                  {"id": "b", "latitude": 13.1, "longitude": 80.0, "weight_kg": 10}],
        "vehicles": [{"vehicle_id": "v", "payload_kg": 100, "volume_m3": 1, "cost_per_km": 2}],
        "time_limit_s": 1,
    }
    r = api.post("/optimization/classical", json=body)
    assert r.status_code == 202
    run_id = r.json()["id"]
    for _ in range(100):
        rec = api.get(f"/optimization/runs/{run_id}").json()
        if rec["status"] in ("succeeded", "failed"):
            break
        await asyncio.sleep(0.1)
    assert rec["status"] == "succeeded", rec
    assert rec["result"]["status"] == "solved" and rec["result"]["distance_source"] == "osrm"
    assert api.get("/optimization/runs", params={"kind": "classical"}).json()["total"] >= 1
    assert api.get("/optimization/runs/nope").status_code == 404
    assert api.post("/optimization/runs/nope/cancel").status_code == 404
    # cancelling a finished run is a no-op returning the record
    assert api.post(f"/optimization/runs/{run_id}/cancel").json()["status"] == "succeeded"
    assert api.post("/optimization/classical", json={**body, "vehicles": [], "stops": body["stops"]}).status_code == 422
