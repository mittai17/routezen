"""Classical feasible clustering, simulated QAOA ordering, OR-Tools validation.

Subproblems retain both boundary arcs, including asymmetric matrices. Their
brute-force comparison is local and unconstrained; it is never presented as a
global VRP optimum. The feasible classical baseline is retained on regression.
"""
from __future__ import annotations

import threading
import time

from app.schemas.optimization import (
    HybridCluster, HybridMetrics, HybridRequest, OptimizationResult, OptStop, OptVehicle, OptWeights,
)
from app.services.optimizer_classical import solve_classical
from app.services.optimizer_quantum import QuantumCancelled, QuantumTimeout, solve_quantum


def solve_hybrid(
    stops: list[OptStop], vehicles: list[OptVehicle], distance_km: list[list[float]],
    duration_min: list[list[float]], request: HybridRequest, time_limit_s: int = 5,
    cancel_event: threading.Event | None = None,
) -> OptimizationResult:
    started = time.perf_counter()

    def check_cancel() -> None:
        if cancel_event is not None and cancel_event.is_set():
            raise QuantumCancelled()

    check_cancel()
    weights = OptWeights(distance=1 if request.quantum_objective == "distance" else 0,
                         time=1 if request.quantum_objective == "duration" else 0, cost=0, emissions=0)
    baseline = solve_classical(stops, vehicles, distance_km, duration_min, weights,
                               request.return_to_depot, time_limit_s, request.horizon_min)
    check_cancel()
    def physical_objective(result: OptimizationResult) -> float:
        return (result.total_distance_km if request.quantum_objective == "distance"
                else result.total_duration_min)

    baseline_objective = physical_objective(baseline)
    metrics = HybridMetrics(objective=request.quantum_objective,
                            baseline_distance_km=baseline.total_distance_km,
                            baseline_duration_min=baseline.total_duration_min,
                            baseline_objective=baseline_objective)
    index = {s.id: i + 1 for i, s in enumerate(stops)}
    by_id = {s.id: s for s in stops}
    seeds = {r.vehicle_id: [s.stop_id for s in r.stops] for r in baseline.routes}
    quantum_started = time.perf_counter()
    deadline = quantum_started + request.quantum_timeout_s
    budget_exhausted = False
    for route in baseline.routes:
        ids = seeds[route.vehicle_id]
        for start in range(0, len(ids), request.cluster_size):
            check_cancel()
            group = ids[start:start + request.cluster_size]
            if len(group) < 2:
                continue
            remaining = deadline - time.perf_counter()
            if remaining <= 0:
                budget_exhausted = True
                break
            prev = index[ids[start - 1]] if start else 0
            after = start + len(group)
            end = index[ids[after]] if after < len(ids) else (0 if request.return_to_depot else None)
            nodes = [prev] + [index[sid] for sid in group]

            def segment(matrix: list[list[float]]) -> list[list[float]]:
                sub = [[matrix[a][b] for b in nodes] for a in nodes]
                # Synthetic depot's outgoing arc represents predecessor; its
                # incoming arc represents successor, not the predecessor.
                for k, node in enumerate(nodes[1:], start=1):
                    sub[k][0] = matrix[node][end] if end is not None else 0
                sub[0][0] = 0
                return sub

            # Full-route windows/capacity remain authoritative in OR-Tools.
            local_stops = [by_id[sid].model_copy(update={"window_start_min": None, "window_end_min": None}) for sid in group]
            metrics.clusters_attempted += 1
            try:
                q = solve_quantum(local_stops, segment(distance_km), segment(duration_min),
                                  objective=request.quantum_objective, return_to_depot=True,
                                  reps=request.quantum_reps, max_iterations=request.quantum_max_iterations,
                                  shots=request.quantum_shots, seed=request.seed, timeout_s=remaining,
                                  max_stops=4, cancel_event=cancel_event, restarts=request.quantum_restarts)
            except QuantumTimeout:
                metrics.clusters.append(HybridCluster(stop_ids=group, status="timed_out", n_qubits=len(group)**2))
                budget_exhausted = True
                break
            metrics.clusters.append(HybridCluster(stop_ids=group, status=q.status, n_qubits=q.n_qubits,
                                                  order=q.order, cost=q.cost, brute_force_cost=q.brute_force_cost,
                                                  gap_vs_brute_force_pct=q.gap_vs_brute_force_pct))
            if q.feasible and sorted(q.order) == sorted(group):
                metrics.clusters_solved += 1
                ids[start:after] = q.order
        if budget_exhausted:
            break
    metrics.quantum_runtime_ms = round((time.perf_counter() - quantum_started) * 1000, 1)
    check_cancel()
    chosen = baseline
    if metrics.clusters_solved:
        candidate = solve_classical(stops, vehicles, distance_km, duration_min, weights,
                                    request.return_to_depot, time_limit_s, request.horizon_min, initial_routes=seeds)
        check_cancel()
        candidate_objective = physical_objective(candidate)
        metrics.candidate_objective = candidate_objective
        # Compare the requested real-world quantity and never exchange coverage
        # for a deceptively shorter route. OR-Tools remains the feasibility gate.
        if (len(candidate.unassigned) <= len(baseline.unassigned)
                and candidate_objective <= baseline_objective + 1e-9
                and any("seed validated" in note for note in candidate.notes)):
            chosen = candidate
            metrics.selected = "quantum_seeded"
            if baseline_objective > 0:
                metrics.improvement_pct = round(
                    (baseline_objective - candidate_objective) / baseline_objective * 100, 3
                )
    chosen = chosen.model_copy(deep=True)
    chosen.solver = "hybrid_qaoa_ortools"
    chosen.hybrid = metrics
    chosen.runtime_ms = round((time.perf_counter() - started) * 1000, 1)
    chosen.notes.append(metrics.disclaimer)
    chosen.notes.append(
        f"Hybrid objective values and improvement are measured in "
        f"{'kilometres' if request.quantum_objective == 'distance' else 'minutes'}."
    )
    chosen.notes.append("Brute-force comparisons concern each boundary-aware segment only, without full-route constraints; they are not global optimality claims.")
    if budget_exhausted:
        chosen.notes.append("Quantum time budget exhausted; completed proposals and the classical baseline were retained.")
    if metrics.selected == "classical_baseline":
        chosen.notes.append("Classical baseline retained: quantum proposals did not provide a validated non-worse solution.")
    return chosen
