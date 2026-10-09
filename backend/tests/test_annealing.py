"""Unit and API tests for Simulated Annealing QUBO optimization."""
import threading

import numpy as np
import pytest

from app.schemas.optimization import OptStop, OptVehicle
from app.services.optimizer_annealing import (
    bitstring_to_int, permutation_to_bitstring, solve_simulated_annealing,
)
from app.services.optimizer_quantum import (
    QuantumCancelled, QuantumLimitError, QuantumTimeout, brute_force,
)


def random_matrix(n: int, seed: int = 1) -> list[list[float]]:
    pts = np.random.default_rng(seed).random((n + 1, 2))
    return np.linalg.norm(pts[:, None] - pts[None], axis=2).tolist()


def make_stops(n: int, **kwargs) -> list[OptStop]:
    base = dict(weight_kg=10, volume_m3=0.1, service_minutes=2)
    base.update(kwargs)
    return [
        OptStop(
            id=f"s{i}",
            latitude=13.0 + i * 0.01,
            longitude=80.0 + i * 0.01,
            **base,
        )
        for i in range(n)
    ]


def test_bitstring_permutation_helpers():
    perm = [2, 0, 1]
    bits = permutation_to_bitstring(perm, 3)
    val = bitstring_to_int(bits)
    assert val > 0
    # Pos 0 has stop 2 (bit 2*3 + 0 = 6)
    # Pos 1 has stop 0 (bit 0*3 + 1 = 1)
    # Pos 2 has stop 1 (bit 1*3 + 2 = 5)
    expected_val = (1 << 6) | (1 << 1) | (1 << 5)
    assert val == expected_val


def test_annealing_solves_small_matches_brute_force():
    for n in (3, 4):
        D = random_matrix(n, seed=n * 10)
        stops = make_stops(n)
        vehicle = OptVehicle(vehicle_id="v1", payload_kg=100, volume_m3=2)
        res = solve_simulated_annealing(
            stops=stops,
            distance_km=D,
            duration_min=D,
            vehicle=vehicle,
            steps=3000,
            seed=42,
        )
        assert res.solver == "simulated_annealing_qubo"
        assert res.status == "solved"
        assert res.feasible is True
        assert res.feasibility_issues == []
        assert sorted(res.order) == [f"s{i}" for i in range(n)]

        # Brute force reference check
        _, bf_cost = brute_force(np.array(D), True)
        assert res.brute_force_cost == pytest.approx(bf_cost, abs=1e-4)
        assert res.cost == pytest.approx(bf_cost, abs=1e-4)
        assert res.gap_vs_brute_force_pct == pytest.approx(0.0, abs=1e-4)
        assert res.matches_brute_force is True


def test_annealing_single_stop():
    D = [[0.0, 4.0], [4.0, 0.0]]
    stops = make_stops(1)
    res = solve_simulated_annealing(stops, D, D, steps=50, seed=1)
    assert res.order == ["s0"]
    assert res.cost == 8.0
    assert res.matches_brute_force is True
    assert res.gap_vs_brute_force_pct == 0.0


def test_annealing_handles_n6_and_n8_exceeding_qaoa_limits():
    """Simulated Annealing on QUBO formulation handles N=6 and N=8 stops."""
    for n in (6, 8):
        D = random_matrix(n, seed=77 + n)
        stops = make_stops(n)
        vehicle = OptVehicle(vehicle_id="v1", payload_kg=200, volume_m3=5)
        res = solve_simulated_annealing(
            stops=stops,
            distance_km=D,
            duration_min=D,
            vehicle=vehicle,
            steps=3000,
            seed=123,
        )
        assert res.solver == "simulated_annealing_qubo"
        assert res.status == "solved"
        assert res.feasible is True
        assert res.n_stops == n
        assert res.n_qubits == n * n
        assert len(res.order) == n
        assert set(res.order) == {f"s{i}" for i in range(n)}
        # N > 4 stops skip exact brute force enumeration
        assert res.brute_force_order == []
        assert res.brute_force_cost is None
        assert res.gap_vs_brute_force_pct is None


def test_annealing_feasibility_validation():
    # Weight capacity violation
    D = random_matrix(3, seed=15)
    stops = make_stops(3, weight_kg=60)
    small_veh = OptVehicle(vehicle_id="v1", payload_kg=100, volume_m3=2)  # 3 * 60 = 180 > 100
    res = solve_simulated_annealing(stops, D, D, vehicle=small_veh, steps=500, seed=7)
    assert res.status == "infeasible"
    assert res.feasible is False
    assert any("weight" in issue for issue in res.feasibility_issues)

    # Time window violation
    T = np.array([[0, 20, 20, 20], [20, 0, 20, 20], [20, 20, 0, 20], [20, 20, 20, 0]], dtype=float).tolist()
    tw_stops = make_stops(3, window_end_min=15.0)  # Reached after 20 min > 15
    res_tw = solve_simulated_annealing(tw_stops, T, T, steps=500, seed=7)
    assert res_tw.status == "infeasible"
    assert res_tw.feasible is False
    assert any("window" in issue for issue in res_tw.feasibility_issues)


def test_annealing_deterministic_with_seed():
    D = random_matrix(4, seed=33)
    stops = make_stops(4)
    run1 = solve_simulated_annealing(stops, D, D, seed=99, steps=1000)
    run2 = solve_simulated_annealing(stops, D, D, seed=99, steps=1000)
    assert run1.order == run2.order
    assert run1.cost == run2.cost
    assert run1.feasible_probability == run2.feasible_probability


def test_annealing_timeout_and_cancel():
    D = random_matrix(3)
    stops = make_stops(3)
    with pytest.raises(QuantumTimeout):
        solve_simulated_annealing(stops, D, D, timeout_s=1e-9, steps=100000)

    ev = threading.Event()
    ev.set()
    with pytest.raises(QuantumCancelled):
        solve_simulated_annealing(stops, D, D, cancel_event=ev)


async def test_annealing_api_async_run(api):
    import asyncio
    body = {
        "depot": {"latitude": 13.0, "longitude": 80.0},
        "stops": [
            {"id": "s1", "latitude": 13.01, "longitude": 80.01},
            {"id": "s2", "latitude": 13.02, "longitude": 80.02},
            {"id": "s3", "latitude": 13.03, "longitude": 80.03},
        ],
        "steps": 1000,
        "seed": 42,
    }
    resp = api.post("/optimization/annealing", json=body)
    assert resp.status_code == 202
    run_id = resp.json()["id"]

    for _ in range(100):
        rec = api.get(f"/optimization/runs/{run_id}").json()
        if rec["status"] not in ("queued", "running"):
            break
        await asyncio.sleep(0.05)

    assert rec["status"] == "succeeded"
    assert rec["kind"] == "annealing"
    assert rec["result"]["solver"] == "simulated_annealing_qubo"
    assert rec["result"]["status"] == "solved"
    assert len(rec["result"]["order"]) == 3


def test_annealing_api_sync_run(api):
    body = {
        "depot": {"latitude": 13.0, "longitude": 80.0},
        "stops": [
            {"id": "a", "latitude": 13.01, "longitude": 80.01},
            {"id": "b", "latitude": 13.02, "longitude": 80.02},
        ],
        "steps": 500,
        "seed": 10,
    }
    resp = api.post("/optimization/annealing?sync=true", json=body)
    assert resp.status_code in (200, 202)
    data = resp.json()
    assert data["solver"] == "simulated_annealing_qubo"
    assert sorted(data["order"]) == ["a", "b"]
