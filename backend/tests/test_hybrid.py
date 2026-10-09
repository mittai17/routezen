import asyncio

import pytest

from app.schemas.optimization import (
    HybridRequest,
    OptimizationResult,
    OptDepot,
    OptStop,
    OptVehicle,
    QuantumResult,
    StopVisit,
    VehicleRoute,
)
from app.services import optimizer_hybrid


def stops(n=4):
    return [
        OptStop(id=f"s{i}", latitude=13, longitude=80, weight_kg=1, volume_m3=0.01, service_minutes=0)
        for i in range(1, n + 1)
    ]


def vehicle():
    return OptVehicle(vehicle_id="v", payload_kg=100, volume_m3=1)


def matrix(n=4):
    return [[0 if i == j else float(abs(i - j) + 1) for j in range(n + 1)] for i in range(n + 1)]


def result(order, distance, *, note=""):
    visits = [
        StopVisit(
            stop_id=sid,
            arrival_min=i,
            departure_min=i,
            cumulative_distance_km=i,
            load_kg=i,
            load_m3=i / 100,
        )
        for i, sid in enumerate(order, 1)
    ]
    return OptimizationResult(
        status="solved",
        routes=[VehicleRoute(
            vehicle_id="v", stops=visits, distance_km=distance, duration_min=distance * 2,
            load_kg=len(order), load_m3=len(order) / 100, cost=0, emissions_g=0,
        )],
        total_distance_km=distance,
        total_duration_min=distance * 2,
        objective=distance,
        notes=[note] if note else [],
    )


def quantum(order):
    return QuantumResult(
        status="solved", n_stops=len(order), n_qubits=len(order) ** 2, reps=1,
        order=order, cost=1, feasible=True, feasible_probability=0.5, shots=16,
        brute_force_order=order, brute_force_cost=1, gap_vs_brute_force_pct=0,
        matches_brute_force=True,
    )


def request(**updates):
    values = dict(
        depot=OptDepot(latitude=13, longitude=80), stops=stops(), vehicles=[vehicle()],
        cluster_size=2, quantum_max_iterations=5, quantum_shots=16,
        quantum_restarts=1, quantum_timeout_s=10, time_limit_s=1,
    )
    values.update(updates)
    return HybridRequest(**values)


def test_hybrid_stitches_qaoa_groups_and_reports_physical_improvement(monkeypatch):
    calls = []

    def fake_classical(*args, initial_routes=None, **kwargs):
        calls.append(initial_routes)
        if initial_routes is None:
            return result(["s1", "s2", "s3", "s4"], 20)
        assert initial_routes == {"v": ["s2", "s1", "s4", "s3"]}
        return result(initial_routes["v"], 18, note="Quantum-proposed route seed validated by OR-Tools before refinement.")

    monkeypatch.setattr(optimizer_hybrid, "solve_classical", fake_classical)
    monkeypatch.setattr(
        optimizer_hybrid, "solve_quantum",
        lambda group, *args, **kwargs: quantum([s.id for s in reversed(group)]),
    )

    out = optimizer_hybrid.solve_hybrid(stops(), [vehicle()], matrix(), matrix(), request(), 1)

    assert calls == [None, {"v": ["s2", "s1", "s4", "s3"]}]
    assert out.solver == "hybrid_qaoa_ortools"
    assert out.hybrid is not None
    assert out.hybrid.selected == "quantum_seeded"
    assert out.hybrid.baseline_objective == 20
    assert out.hybrid.candidate_objective == 18
    assert out.hybrid.improvement_pct == pytest.approx(10)
    assert out.hybrid.clusters_attempted == out.hybrid.clusters_solved == 2
    assert out.total_distance_km == 18
    assert "No quantum hardware" in out.hybrid.disclaimer


def test_hybrid_retains_baseline_when_validated_candidate_is_worse(monkeypatch):
    def fake_classical(*args, initial_routes=None, **kwargs):
        if initial_routes is None:
            return result(["s1", "s2", "s3", "s4"], 20)
        return result(initial_routes["v"], 21, note="Quantum-proposed route seed validated by OR-Tools before refinement.")

    monkeypatch.setattr(optimizer_hybrid, "solve_classical", fake_classical)
    monkeypatch.setattr(
        optimizer_hybrid, "solve_quantum",
        lambda group, *args, **kwargs: quantum([s.id for s in reversed(group)]),
    )

    out = optimizer_hybrid.solve_hybrid(stops(), [vehicle()], matrix(), matrix(), request(), 1)

    assert out.hybrid is not None
    assert out.hybrid.selected == "classical_baseline"
    assert out.hybrid.candidate_objective == 21
    assert out.hybrid.improvement_pct == 0
    assert out.total_distance_km == 20
    assert any("baseline retained" in note.lower() for note in out.notes)


async def test_hybrid_api_runs_qaoa_simulation_and_returns_metrics(api):
    body = {
        "depot": {"latitude": 13, "longitude": 80},
        "stops": [
            {"id": "a", "latitude": 13, "longitude": 80.01, "service_minutes": 0},
            {"id": "b", "latitude": 13, "longitude": 80.02, "service_minutes": 0},
        ],
        "vehicles": [{"vehicle_id": "v", "payload_kg": 100, "volume_m3": 1}],
        "matrices": {
            "distance_km": [[0, 1, 2], [1, 0, 1], [2, 1, 0]],
            "duration_min": [[0, 2, 4], [2, 0, 2], [4, 2, 0]],
        },
        "time_limit_s": 1,
        "cluster_size": 2,
        "quantum_max_iterations": 5,
        "quantum_shots": 16,
        "quantum_restarts": 1,
        "quantum_timeout_s": 10,
    }
    response = api.post("/optimization/hybrid", json=body)
    assert response.status_code == 202
    run_id = response.json()["id"]
    for _ in range(100):
        record = api.get(f"/optimization/runs/{run_id}").json()
        if record["status"] not in ("queued", "running"):
            break
        await asyncio.sleep(0.05)

    assert record["status"] == "succeeded", record
    assert record["kind"] == "hybrid"
    assert record["result"]["solver"] == "hybrid_qaoa_ortools"
    metrics = record["result"]["hybrid"]
    assert metrics["simulation"] is True
    assert metrics["objective"] == "distance"
    assert metrics["clusters_attempted"] == 1
    assert api.get("/optimization/runs", params={"kind": "hybrid"}).json()["total"] >= 1
