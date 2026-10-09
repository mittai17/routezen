import json
from pathlib import Path
import pytest

from scripts.benchmark_solvers import (
    SOLVER_BF,
    SOLVER_ORTOOLS,
    SOLVER_QAOA,
    SOLVER_SA,
    format_benchmark_table,
    format_markdown_report,
    generate_benchmark_instance,
    run_single_instance,
    run_solver_benchmarks,
    summarize_runs,
)


def test_generate_benchmark_instance():
    n = 3
    stops, vehicle, dist_km, duration_min = generate_benchmark_instance(n, seed=42)

    assert len(stops) == n
    assert len(dist_km) == n + 1
    assert all(len(row) == n + 1 for row in dist_km)
    assert len(duration_min) == n + 1
    assert dist_km[0][0] == 0.0
    assert vehicle.payload_kg > 0
    assert vehicle.available is True

    # Check symmetry and zero diagonal
    for i in range(n + 1):
        assert dist_km[i][i] == 0.0
        for j in range(n + 1):
            assert dist_km[i][j] == pytest.approx(dist_km[j][i], rel=1e-5)


def test_run_single_instance_n2():
    results = run_single_instance(
        n=2,
        trial=1,
        seed=42,
        qaoa_iterations=5,
        qaoa_shots=128,
        qaoa_restarts=1,
        sa_steps=100,
        ortools_time_limit_s=1,
    )

    names = {r.solver_name for r in results}
    assert SOLVER_BF in names
    assert SOLVER_QAOA in names
    assert SOLVER_SA in names
    assert SOLVER_ORTOOLS in names

    # All solvers on N=2 should find feasible routes
    for r in results:
        assert r.n_stops == 2
        assert r.trial == 1
        assert r.runtime_ms > 0
        assert r.distance_km is not None and r.distance_km > 0
        assert r.feasible is True


def test_run_single_instance_n6():
    # N=6 should include SA and OR-Tools, but NOT BF or QAOA
    results = run_single_instance(
        n=6,
        trial=1,
        seed=42,
        sa_steps=100,
        ortools_time_limit_s=1,
    )

    names = {r.solver_name for r in results}
    assert SOLVER_BF not in names
    assert SOLVER_QAOA not in names
    assert SOLVER_SA in names
    assert SOLVER_ORTOOLS in names


def test_run_solver_benchmarks_quick():
    data = run_solver_benchmarks(
        sizes=[2, 3],
        trials=1,
        base_seed=123,
        qaoa_iterations=5,
        qaoa_shots=128,
        qaoa_restarts=1,
        sa_steps=100,
        ortools_time_limit_s=1,
    )

    assert "metadata" in data
    assert "summaries" in data
    assert "runs" in data

    summaries = data["summaries"]
    # 4 solvers for N=2 and 4 solvers for N=3 = 8 summary records
    assert len(summaries) == 8

    for s in summaries:
        assert s["trials"] == 1
        assert s["mean_latency_ms"] > 0
        assert s["feasibility_rate_pct"] == 100.0
        assert s["best_distance_km"] is not None


def test_format_reports():
    data = run_solver_benchmarks(
        sizes=[2],
        trials=1,
        base_seed=42,
        qaoa_iterations=5,
        qaoa_shots=64,
        qaoa_restarts=1,
        sa_steps=50,
        ortools_time_limit_s=1,
    )

    table_text = format_benchmark_table(data["summaries"])
    assert "ROUTEZEN EMPIRICAL SOLVER BENCHMARK RESULTS" in table_text
    assert "Brute Force" in table_text
    assert "Classical OR-Tools" in table_text

    md_report = format_markdown_report(data)
    assert "# ROUTEZEN Multi-Solver Empirical Benchmark Report" in md_report
    assert "| N=2 |" in md_report
