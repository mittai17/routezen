"""Simulated Annealing optimizer for ROUTEZEN using the QUBO formulation.

Solves the exact same QUBO formulation as `optimizer_quantum.py` (E(x) = x^T Q x + const)
using Metropolis simulated annealing with temperature cooling, fast O(N) delta-energy
evaluations for single bit flips, and 2-opt permutation moves.

Decodes bitstrings to visiting permutations, validates feasibility against vehicle
capacity, volume, max stops, and time windows, and compares with exact brute force
for small problem sizes (<= 4 stops). Can scale to N=6, 8, 10+ stops where QAOA
statevector simulation exceeds qubit memory limits.
"""
from __future__ import annotations

import math
import threading
import time
from typing import Any

import numpy as np

from app.schemas.optimization import OptStop, OptVehicle, QuantumResult
from app.services.optimizer_quantum import (
    QuantumCancelled, QuantumLimitError, QuantumTimeout,
    brute_force, build_qubo, check_feasibility, decode_bitstring, route_cost,
)

MAX_ANNEALING_STOPS = 30


def bitstring_to_int(bits: np.ndarray) -> int:
    """Convert a numpy 0/1 vector to a Python arbitrary-precision integer."""
    idx = 0
    for k, b in enumerate(bits):
        if b:
            idx |= 1 << k
    return idx


def permutation_to_bitstring(perm: list[int], n: int) -> np.ndarray:
    """Encode a visiting permutation as an n*n QUBO bitstring."""
    x = np.zeros(n * n, dtype=np.int64)
    for p, i in enumerate(perm):
        x[i * n + p] = 1
    return x


def solve_simulated_annealing(
    stops: list[OptStop],
    distance_km: list[list[float]],
    duration_min: list[list[float]],
    vehicle: OptVehicle | None = None,
    return_to_depot: bool = True,
    initial_temp: float = 10.0,
    final_temp: float = 0.01,
    cooling_rate: float = 0.995,
    steps: int = 5000,
    seed: int | None = 7,
    objective: str = "distance",
    timeout_s: float = 60.0,
    cancel_event: threading.Event | None = None,
    max_stops: int = MAX_ANNEALING_STOPS,
) -> QuantumResult:
    """Solve the stop-ordering QUBO problem using Simulated Annealing."""
    t0 = time.perf_counter()
    if cancel_event is not None and cancel_event.is_set():
        raise QuantumCancelled()
    if objective not in ("distance", "duration"):
        raise ValueError("objective must be distance or duration")
    if initial_temp <= 0 or final_temp <= 0 or final_temp > initial_temp:
        raise ValueError("initial_temp and final_temp must be positive with final_temp <= initial_temp")
    if not (0 < cooling_rate < 1):
        raise ValueError("cooling_rate must be between 0 and 1 exclusive")
    if steps < 1:
        raise ValueError("steps must be at least 1")

    n = len(stops)
    if n == 0:
        raise ValueError("at least one stop is required")
    if n > max_stops:
        raise QuantumLimitError(
            f"{n} stops exceeds the annealing limit of {max_stops} stops. "
            f"Use the classical optimizer for larger problems."
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
    ids = [s.id for s in stops]

    # Exact brute force reference when problem size is small
    bf_order: list[int] | None = None
    bf_cost: float | None = None
    if n <= 4:
        bf_order, bf_cost = brute_force(M, return_to_depot)

    # QUBO matrix formulation: E(x) = x^T Q x + const
    Q, const, scale = build_qubo(M, return_to_depot)
    M_sym = Q + Q.T  # symmetric interaction matrix for fast delta-energy

    rng = np.random.default_rng(seed)

    # Initial state: random permutation mapped to QUBO bitstring
    initial_perm = list(rng.permutation(n))
    x = permutation_to_bitstring(initial_perm, n)
    E = float(x @ Q @ x) + const
    # gradient vector g = (Q + Q^T) x
    g = M_sym @ x.astype(np.float64)

    best_order: list[int] = list(initial_perm)
    best_cost: float = route_cost(initial_perm, M, return_to_depot)
    best_energy: float = E

    valid_samples_count = 1
    deadline = t0 + timeout_s
    T_curr = initial_temp

    for step in range(steps):
        if cancel_event is not None and cancel_event.is_set():
            raise QuantumCancelled()
        if time.perf_counter() > deadline:
            raise QuantumTimeout(f"Simulated annealing exceeded timeout of {timeout_s:g}s")

        # Propose a move:
        # If n >= 2 and with 50% probability, propose a 2-opt permutation move if current state is a valid permutation.
        # Otherwise propose a single bit flip.
        move_type = "bit_flip"
        current_perm: list[int] | None = None

        if n >= 2 and rng.random() < 0.5:
            current_perm = decode_bitstring(bitstring_to_int(x), n)
            if current_perm is not None:
                move_type = "2opt"

        if move_type == "2opt" and current_perm is not None:
            # 2-opt move on visiting permutation: reverse segment between p1 and p2
            p1, p2 = sorted(rng.choice(n, size=2, replace=False))
            cand_perm = list(current_perm)
            cand_perm[p1 : p2 + 1] = reversed(cand_perm[p1 : p2 + 1])
            cand_x = permutation_to_bitstring(cand_perm, n)
            cand_E = float(cand_x @ Q @ cand_x) + const
            delta_E = cand_E - E

            # Metropolis acceptance criterion
            accept = delta_E <= 0 or (T_curr > 1e-12 and rng.random() < math.exp(-delta_E / T_curr))
            if accept:
                x = cand_x
                E = cand_E
                g = M_sym @ x.astype(np.float64)
                valid_samples_count += 1
                c = route_cost(cand_perm, M, return_to_depot)
                if c < best_cost - 1e-12:
                    best_cost, best_order = c, cand_perm
                    best_energy = E
        else:
            # Random single bit flip with O(N) fast delta-energy evaluation
            k = int(rng.integers(0, nq))
            delta_xk = 1 - 2 * x[k]
            # Fast delta energy: delta_xk * g_k + Q_kk
            delta_E = float(delta_xk * g[k] + Q[k, k])

            # Metropolis acceptance criterion
            accept = delta_E <= 0 or (T_curr > 1e-12 and rng.random() < math.exp(-delta_E / T_curr))
            if accept:
                x[k] = 1 - x[k]
                E = E + delta_E
                g = g + delta_xk * M_sym[:, k]

                # Check if new state is a valid permutation
                perm = decode_bitstring(bitstring_to_int(x), n)
                if perm is not None:
                    valid_samples_count += 1
                    c = route_cost(perm, M, return_to_depot)
                    if c < best_cost - 1e-12:
                        best_cost, best_order = c, perm
                        best_energy = E

        # Cool down temperature
        T_curr = max(final_temp, T_curr * cooling_rate)

    # Check terminal state if valid and better
    term_perm = decode_bitstring(bitstring_to_int(x), n)
    if term_perm is not None:
        c = route_cost(term_perm, M, return_to_depot)
        if c < best_cost - 1e-12:
            best_cost, best_order = c, term_perm

    # Feasibility validation
    issues = check_feasibility(best_order, stops, vehicle, T, return_to_depot)

    # Brute force gap
    gap: float | None = None
    matches_bf: bool | None = None
    if bf_cost is not None:
        gap = 0.0 if bf_cost == 0 else (best_cost - bf_cost) / bf_cost * 100
        matches_bf = abs(best_cost - bf_cost) < 1e-9

    runtime_ms = round((time.perf_counter() - t0) * 1000, 1)

    return QuantumResult(
        solver="simulated_annealing_qubo",
        simulation=True,
        disclaimer=(
            "Result from Simulated Annealing over the QUBO formulation. "
            "Optimized classically using Metropolis cooling schedule and fast delta-E bit updates."
        ),
        status="solved" if not issues else "infeasible",
        n_stops=n,
        n_qubits=nq,
        reps=0,
        iterations=steps,
        order=[ids[i] for i in best_order],
        cost=round(best_cost, 4),
        feasible=not issues,
        feasibility_issues=issues,
        feasible_probability=round(valid_samples_count / steps, 6),
        shots=steps,
        brute_force_order=[ids[i] for i in bf_order] if bf_order else [],
        brute_force_cost=round(bf_cost, 4) if bf_cost is not None else None,
        gap_vs_brute_force_pct=round(gap, 3) if gap is not None else None,
        matches_brute_force=matches_bf,
        runtime_ms=runtime_ms,
        objective=objective,
    )
