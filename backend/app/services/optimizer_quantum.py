"""QAOA stop-ordering demo on the Qiskit Aer simulator (SIMULATION ONLY).

A single vehicle visits n stops; binary x[i,p] = 1 if stop i is visited at
position p (n*n qubits). QUBO:

    E(x) = sum_p  d(depot,i) x[i,0] + sum_{p<n-1} sum_{i,j} d(i,j) x[i,p] x[j,p+1]
           + [return] sum_i d(i,depot) x[i,n-1]
           + A * sum_i (1 - sum_p x[i,p])^2 + A * sum_p (1 - sum_i x[i,p])^2

Distances are normalised by their maximum; A is the penalty weight. The QUBO
is mapped to an Ising Hamiltonian, QAOA parameters are tuned with COBYLA, and
because the Hamiltonian is diagonal the expectation is computed exactly from
the simulated statevector probabilities. Measured bitstrings are decoded,
checked for permutation validity and for vehicle capacity / time windows, and
compared with brute force on the same matrix.

Hard size limit: n*n qubits on a statevector simulator grows as 2^(n*n);
the default cap is 4 stops (16 qubits), absolute cap 4 (16 qubits). The depot is already fixed outside the encoding.
This is a correctness/education demo; it makes NO claim of quantum advantage.
"""
from __future__ import annotations

import itertools
import math
import threading
import time

import numpy as np
from qiskit import transpile
from qiskit.circuit.library import QAOAAnsatz
from qiskit.quantum_info import SparsePauliOp
from qiskit_aer import AerSimulator
from scipy.optimize import minimize

from app.schemas.optimization import OptStop, OptVehicle, QuantumResult

ABSOLUTE_MAX_STOPS = 4


class QuantumLimitError(ValueError):
    """Problem exceeds the configured simulation size limit."""


class QuantumCancelled(Exception):
    pass


class QuantumTimeout(Exception):
    pass


def build_qubo(
    dist: np.ndarray, return_to_depot: bool = True, penalty: float = 2.0
) -> tuple[np.ndarray, float, float]:
    """Return (Q, const, scale) with E(x) = x^T Q x + const over normalised distances.

    `dist` is (n+1)x(n+1) with node 0 = depot. Variable index = i*n + p.
    """
    n = dist.shape[0] - 1
    scale = float(dist.max()) or 1.0
    d = dist / scale
    nv = n * n
    Q = np.zeros((nv, nv))
    var = lambda i, p: i * n + p  # noqa: E731
    for i in range(n):
        Q[var(i, 0), var(i, 0)] += d[0, i + 1]
        if return_to_depot:
            Q[var(i, n - 1), var(i, n - 1)] += d[i + 1, 0]
    for p in range(n - 1):
        for i in range(n):
            for j in range(n):
                if i != j:
                    Q[var(i, p), var(j, p + 1)] += d[i + 1, j + 1]
    const = 0.0
    # one-hot constraints: A*(1 - sum x)^2 = A*(1 - 2 sum x + sum x^2 + 2 sum_{a<b} x_a x_b)
    groups = [[var(i, p) for p in range(n)] for i in range(n)] + [[var(i, p) for i in range(n)] for p in range(n)]
    for g in groups:
        const += penalty
        for a in g:
            Q[a, a] += penalty * (-2 + 1)
        for a, b in itertools.combinations(g, 2):
            Q[a, b] += 2 * penalty
    return Q, const, scale


def qubo_energies(Q: np.ndarray, const: float, n_qubits: int) -> np.ndarray:
    """Energy of every basis state (index bit k = qubit k, matching Qiskit's little-endian order)."""
    idx = np.arange(2**n_qubits, dtype=np.int64)
    bits = ((idx[:, None] >> np.arange(n_qubits)) & 1).astype(np.float64)
    return np.einsum("bi,ij,bj->b", bits, Q, bits) + const


def qubo_to_ising(Q: np.ndarray, const: float) -> tuple[SparsePauliOp, float]:
    """x = (1 - Z)/2. Returns (Pauli operator without identity, constant offset)."""
    nv = Q.shape[0]
    terms: list[tuple[str, list[int], float]] = []
    offset = const
    lin = np.zeros(nv)
    for a in range(nv):
        offset += Q[a, a] / 2
        lin[a] -= Q[a, a] / 2
        for b in range(a + 1, nv):
            c = Q[a, b] + Q[b, a]
            if c == 0:
                continue
            offset += c / 4
            lin[a] -= c / 4
            lin[b] -= c / 4
            terms.append(("ZZ", [a, b], c / 4))
    terms += [("Z", [a], lin[a]) for a in range(nv) if lin[a] != 0]
    op = SparsePauliOp.from_sparse_list(terms, num_qubits=nv) if terms else SparsePauliOp("I" * nv, [0.0])
    return op, offset


def decode_bitstring(idx: int, n: int) -> list[int] | None:
    """Decode basis-state index to a visiting order (stop indices), or None if not a permutation."""
    order: list[int | None] = [None] * n
    seen: set[int] = set()
    for p in range(n):
        at = [i for i in range(n) if (idx >> (i * n + p)) & 1]
        if len(at) != 1 or at[0] in seen:
            return None
        order[p] = at[0]
        seen.add(at[0])
    return order  # type: ignore[return-value]


def route_cost(order: list[int], dist: np.ndarray, return_to_depot: bool) -> float:
    path = [0] + [o + 1 for o in order] + ([0] if return_to_depot else [])
    return float(sum(dist[a, b] for a, b in zip(path, path[1:])))


def brute_force(dist: np.ndarray, return_to_depot: bool) -> tuple[list[int], float]:
    n = dist.shape[0] - 1
    best = min(itertools.permutations(range(n)), key=lambda o: (route_cost(list(o), dist, return_to_depot), o))
    return list(best), route_cost(list(best), dist, return_to_depot)


def check_feasibility(
    order: list[int], stops: list[OptStop], vehicle: OptVehicle | None, duration_min: np.ndarray,
    return_to_depot: bool,
) -> list[str]:
    """Capacity + time-window feasibility of a single-vehicle visiting order (empty list = feasible)."""
    issues: list[str] = []
    if vehicle is not None:
        w = sum(stops[i].weight_kg for i in order)
        v = sum(stops[i].volume_m3 for i in order)
        if not vehicle.available:
            issues.append("vehicle is unavailable")
        if w > vehicle.payload_kg:
            issues.append(f"total weight {w:g} kg exceeds payload {vehicle.payload_kg:g} kg")
        if v > vehicle.volume_m3:
            issues.append(f"total volume {v:g} m3 exceeds capacity {vehicle.volume_m3:g} m3")
        if len(order) > vehicle.max_stops:
            issues.append(f"{len(order)} stops exceeds max_stops {vehicle.max_stops}")
    t, prev = 0.0, 0
    for i in order:
        node = i + 1
        t += duration_min[prev, node]
        s = stops[i]
        if s.window_start_min is not None:
            t = max(t, s.window_start_min)
        if s.window_end_min is not None and t > s.window_end_min + 1e-9:
            issues.append(f"stop {s.id} reached at {t:.1f} min after window end {s.window_end_min:g}")
        t += s.service_minutes
        prev = node
    return issues


def solve_quantum(
    stops: list[OptStop],
    distance_km: list[list[float]],
    duration_min: list[list[float]],
    vehicle: OptVehicle | None = None,
    objective: str = "distance",
    return_to_depot: bool = True,
    reps: int = 1,
    max_iterations: int = 60,
    shots: int = 1024,
    seed: int | None = 7,
    timeout_s: float = 60.0,
    max_stops: int = 4,
    cancel_event: threading.Event | None = None,
    restarts: int = 1,
) -> QuantumResult:
    t0 = time.perf_counter()
    if cancel_event is not None and cancel_event.is_set():
        raise QuantumCancelled()
    if objective not in ("distance", "duration"):
        raise ValueError("objective must be distance or duration")
    if not 1 <= restarts <= 4:
        raise ValueError("restarts must be between 1 and 4")
    n = len(stops)
    max_stops = min(max_stops, ABSOLUTE_MAX_STOPS)
    if n == 0:
        raise ValueError("at least one stop is required")
    if n > max_stops:
        raise QuantumLimitError(
            f"{n} stops exceeds the quantum simulation limit of {max_stops} stops "
            f"({max_stops * max_stops} qubits). Use the classical optimizer for larger problems."
        )
    if len({s.id for s in stops}) != n:
        raise ValueError("stop ids must be unique")
    D = np.asarray(distance_km, dtype=float)
    T = np.asarray(duration_min, dtype=float)
    for name, m in (("distance_km", D), ("duration_min", T)):
        if m.shape != (n + 1, n + 1) or not np.isfinite(m).all() or (m < 0).any():
            raise ValueError(f"{name} must be a finite non-negative {n + 1}x{n + 1} matrix")
    M = D if objective == "distance" else T

    nq = n * n
    base = dict(
        n_stops=n, n_qubits=nq, reps=reps, shots=shots, objective=objective,
    )
    bf_order, bf_cost = brute_force(M, return_to_depot)
    ids = [s.id for s in stops]

    Q, const, scale = build_qubo(M, return_to_depot)
    energies = qubo_energies(Q, const, nq)
    op, offset = qubo_to_ising(Q, const)
    ansatz = QAOAAnsatz(cost_operator=op, reps=reps)
    ansatz.save_statevector()
    sim = AerSimulator(method="statevector", max_parallel_threads=1)
    compiled = transpile(ansatz, sim, optimization_level=0)
    deadline = t0 + timeout_s
    calls = {"n": 0}

    def probabilities(theta: np.ndarray) -> np.ndarray:
        if cancel_event is not None and cancel_event.is_set():
            raise QuantumCancelled()
        if time.perf_counter() > deadline:
            raise QuantumTimeout(f"QAOA exceeded timeout of {timeout_s:g}s")
        bound = compiled.assign_parameters(theta)
        sv = sim.run(bound).result().get_statevector()
        return np.abs(np.asarray(sv)) ** 2

    def expectation(theta: np.ndarray) -> float:
        calls["n"] += 1
        return float(probabilities(theta) @ energies)

    rng = np.random.default_rng(seed)
    # Keep the single-start sequence stable. Additional seeded starts explore
    # different basins; retain the lowest-energy distribution so enabling
    # restarts cannot make the variational expectation worse than start one.
    distributions = []
    for _ in range(restarts):
        x0 = rng.uniform(0, np.pi, size=2 * reps)
        res = minimize(expectation, x0, method="COBYLA", options={"maxiter": max_iterations, "rhobeg": 0.5})
        distributions.append(probabilities(res.x))
    probs = min(distributions, key=lambda distribution: float(distribution @ energies))
    probs = probs / probs.sum()

    # Enumerate only n! valid permutations, not an arbitrary top-probability
    # cutoff that undercounts feasible mass when states are diffuse.
    feasible_mask_prob = sum(
        float(probs[sum(1 << (i * n + p) for p, i in enumerate(order))])
        for order in itertools.permutations(range(n))
    )

    samples = rng.choice(len(probs), size=shots, p=probs)
    best_order: list[int] | None = None
    best_cost = math.inf
    for k in np.unique(samples):
        order = decode_bitstring(int(k), n)
        if order is None:
            continue
        c = route_cost(order, M, return_to_depot)
        if c < best_cost - 1e-12:
            best_cost, best_order = c, order

    common = dict(
        base,
        iterations=calls["n"],
        feasible_probability=round(feasible_mask_prob, 6),
        brute_force_order=[ids[i] for i in bf_order],
        brute_force_cost=round(bf_cost, 4),
        runtime_ms=round((time.perf_counter() - t0) * 1000, 1),
    )
    if best_order is None:
        return QuantumResult(status="no_feasible_sample", **common)

    issues = check_feasibility(best_order, stops, vehicle, T, return_to_depot)
    gap = 0.0 if bf_cost == 0 else (best_cost - bf_cost) / bf_cost * 100
    return QuantumResult(
        status="solved" if not issues else "infeasible",
        order=[ids[i] for i in best_order],
        cost=round(best_cost, 4),
        feasible=not issues,
        feasibility_issues=issues,
        gap_vs_brute_force_pct=round(gap, 3),
        matches_brute_force=abs(best_cost - bf_cost) < 1e-9,
        **common,
    )
