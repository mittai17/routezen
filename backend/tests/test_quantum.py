import threading

import numpy as np
import pytest

from app.schemas.optimization import OptStop, OptVehicle
from app.services.optimizer_quantum import (
    QuantumCancelled, QuantumLimitError, QuantumTimeout, brute_force, build_qubo, check_feasibility,
    decode_bitstring, qubo_energies, qubo_to_ising, route_cost, solve_quantum,
)


def random_matrix(n, seed=1):
    pts = np.random.default_rng(seed).random((n + 1, 2))
    return np.linalg.norm(pts[:, None] - pts[None], axis=2)


def stops(n, **o):
    return [OptStop(id=f"s{i}", latitude=13, longitude=80, weight_kg=10, volume_m3=0.1, service_minutes=0, **o) for i in range(n)]


def test_size_limit_enforced():
    D = random_matrix(5).tolist()
    with pytest.raises(QuantumLimitError, match="limit"):
        solve_quantum(stops(5), D, D, max_stops=4)
    # absolute cap holds even if the configured limit is raised
    D6 = random_matrix(6).tolist()
    with pytest.raises(QuantumLimitError):
        solve_quantum(stops(6), D6, D6, max_stops=99)


def test_api_rejects_oversized_before_queueing(api):
    body = {"depot": {"latitude": 13, "longitude": 80},
            "stops": [{"id": str(i), "latitude": 13 + i / 100, "longitude": 80} for i in range(5)]}
    r = api.post("/optimization/quantum", json=body)
    assert r.status_code == 422 and r.json()["detail"]["code"] == "quantum_size_limit"


def test_decode_bitstring_valid_and_invalid():
    n = 3
    # stop 0 @ pos 0, stop 1 @ pos 1, stop 2 @ pos 2 -> bits i*n+p
    idx = sum(1 << (i * n + i) for i in range(n))
    assert decode_bitstring(idx, n) == [0, 1, 2]
    perm = sum(1 << (i * n + p) for p, i in enumerate([2, 0, 1]))
    assert decode_bitstring(perm, n) == [2, 0, 1]
    assert decode_bitstring(0, n) is None  # nothing selected
    assert decode_bitstring(idx | (1 << 1), n) is None  # stop stop 0 also at position 1 / two at one position
    dup = (1 << (0 * n + 0)) | (1 << (0 * n + 1)) | (1 << (1 * n + 2))
    assert decode_bitstring(dup, n) is None  # same stop twice


def test_ising_hamiltonian_matches_qubo_energies():
    D = random_matrix(3)
    Q, c, _ = build_qubo(D)
    op, off = qubo_to_ising(Q, c)
    diag = np.real(np.diag(op.to_matrix())) + off
    assert np.allclose(diag, qubo_energies(Q, c, 9), atol=1e-9)


def test_qubo_minimum_over_valid_permutations_is_brute_force_optimum():
    n = 4
    D = random_matrix(n, seed=3)
    Q, c, scale = build_qubo(D)
    E = qubo_energies(Q, c, n * n)
    best = int(np.argmin(E))
    order = decode_bitstring(best, n)
    assert order is not None, "penalties must make the global QUBO minimum a valid permutation"
    _, bf = brute_force(D, True)
    assert route_cost(order, D, True) == pytest.approx(bf)
    assert E[best] == pytest.approx(bf / scale)


def test_solve_small_decodes_feasible_and_compares_to_brute_force():
    D = random_matrix(3).tolist()
    res = solve_quantum(stops(3), D, D, vehicle=OptVehicle(vehicle_id="v", payload_kg=100, volume_m3=1),
                        max_iterations=60, seed=7)
    assert res.simulation is True and "no quantum advantage" in res.disclaimer
    assert res.n_qubits == 9 and res.status == "solved" and res.feasible
    assert sorted(res.order) == ["s0", "s1", "s2"]
    assert res.brute_force_cost == pytest.approx(brute_force(np.array(D), True)[1], abs=1e-4)
    assert res.cost >= res.brute_force_cost - 1e-6  # can never beat the true optimum
    assert res.gap_vs_brute_force_pct >= -1e-6 and res.matches_brute_force == (res.gap_vs_brute_force_pct < 1e-6)
    assert 0 < res.feasible_probability <= 1


def test_solve_single_stop():
    D = [[0, 4], [4, 0]]
    res = solve_quantum(stops(1), D, D, max_iterations=5)
    assert res.order == ["s0"] and res.cost == 8 and res.matches_brute_force


def test_deterministic_with_seed():
    D = random_matrix(3).tolist()
    a = solve_quantum(stops(3), D, D, seed=11, max_iterations=20)
    b = solve_quantum(stops(3), D, D, seed=11, max_iterations=20)
    assert (a.order, a.cost, a.feasible_probability) == (b.order, b.cost, b.feasible_probability)


def test_restarts_keep_or_improve_variational_distribution():
    """The best-of-restarts path remains deterministic and yields a valid report."""
    D = random_matrix(2).tolist()
    single = solve_quantum(stops(2), D, D, seed=19, max_iterations=5, shots=64, restarts=1)
    restarted = solve_quantum(stops(2), D, D, seed=19, max_iterations=5, shots=64, restarts=2)
    assert restarted.status == "solved"
    assert sorted(restarted.order) == ["s0", "s1"]
    # Both runs report an honest exact-reference gap; a restart never changes
    # the reference or permits a result below its exact optimum.
    assert restarted.brute_force_cost == single.brute_force_cost
    assert restarted.cost >= restarted.brute_force_cost - 1e-6


def test_feasibility_capacity_and_time_windows():
    T = np.array([[0, 10, 10], [10, 0, 10], [10, 10, 0]], dtype=float)
    ss = stops(2)
    heavy = OptVehicle(vehicle_id="v", payload_kg=15, volume_m3=1)
    assert any("weight" in i for i in check_feasibility([0, 1], ss, heavy, T, True))
    assert check_feasibility([0, 1], ss, OptVehicle(vehicle_id="v", payload_kg=100, volume_m3=1), T, True) == []
    tw = stops(2)
    tw[1] = tw[1].model_copy(update={"window_end_min": 15})  # visited second -> arrives at 20
    assert any("window" in i for i in check_feasibility([0, 1], tw, None, T, True))
    assert check_feasibility([1, 0], tw, None, T, True) == []


def test_infeasible_solution_is_labelled_not_hidden():
    D = random_matrix(2).tolist()
    ss = stops(2)
    ss[0].weight_kg = 90
    ss[1].weight_kg = 90
    res = solve_quantum(ss, D, D, vehicle=OptVehicle(vehicle_id="v", payload_kg=100, volume_m3=1), max_iterations=10)
    assert res.status == "infeasible" and not res.feasible and res.feasibility_issues


def test_timeout_and_cancel():
    D = random_matrix(3).tolist()
    with pytest.raises(QuantumTimeout):
        solve_quantum(stops(3), D, D, timeout_s=1e-9)
    ev = threading.Event()
    ev.set()
    with pytest.raises(QuantumCancelled):
        solve_quantum(stops(3), D, D, cancel_event=ev)


def test_invalid_matrix_rejected():
    with pytest.raises(ValueError):
        solve_quantum(stops(2), [[0, 1], [1, 0]], [[0, 1], [1, 0]])
    D = random_matrix(2)
    D[0, 1] = -1
    with pytest.raises(ValueError):
        solve_quantum(stops(2), D.tolist(), D.tolist())


async def test_quantum_api_run(api):
    import asyncio
    body = {"depot": {"latitude": 13.0, "longitude": 80.0}, "max_iterations": 15,
            "stops": [{"id": "a", "latitude": 13.05, "longitude": 80.0}, {"id": "b", "latitude": 13.0, "longitude": 80.08},
                      {"id": "c", "latitude": 13.1, "longitude": 80.1}]}
    run_id = api.post("/optimization/quantum", json=body).json()["id"]
    for _ in range(200):
        rec = api.get(f"/optimization/runs/{run_id}").json()
        if rec["status"] not in ("queued", "running"):
            break
        await asyncio.sleep(0.1)
    assert rec["status"] == "succeeded", rec
    assert rec["result"]["simulation"] is True and rec["kind"] == "quantum"
