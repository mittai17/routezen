"""Classical VRP with Google OR-Tools.

Constraints: weight + volume capacity, time windows, vehicle availability,
max stops per vehicle, single depot, optional return-to-depot, optional
dropping of stops (reported as unassigned instead of failing the whole run).

Objective: weighted sum of NORMALISED distance, time, cost and emissions arc
costs (each divided by its matrix maximum so weights are comparable).
Time unit inside the solver is seconds, distance metres, weight grams,
volume litres (all integers). Durations come from one shared matrix (vehicle
speed differences are not modelled here).
"""
from __future__ import annotations

import math
import time

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from app.schemas.optimization import (
    OptimizationResult, OptStop, OptVehicle, OptWeights, StopVisit, Unassigned, VehicleRoute,
)

DROP_PENALTY = 10_000_000


def _validate_matrix(m: list[list[float]], size: int, name: str) -> None:
    if len(m) != size or any(len(r) != size for r in m):
        raise ValueError(f"{name} must be a {size}x{size} matrix over [depot, stops...]")
    for row in m:
        for v in row:
            if not math.isfinite(v) or v < 0:
                raise ValueError(f"{name} contains negative or non-finite values")


def solve_classical(
    stops: list[OptStop],
    vehicles: list[OptVehicle],
    distance_km: list[list[float]],
    duration_min: list[list[float]],
    weights: OptWeights | None = None,
    return_to_depot: bool = True,
    time_limit_s: int = 5,
    horizon_min: float = 1440,
) -> OptimizationResult:
    t0 = time.perf_counter()
    weights = weights or OptWeights()
    notes: list[str] = []
    _validate_matrix(distance_km, len(stops) + 1, "distance_km")
    _validate_matrix(duration_min, len(stops) + 1, "duration_min")
    ids = [s.id for s in stops]
    if len(set(ids)) != len(ids):
        raise ValueError("stop ids must be unique")
    vids = [v.vehicle_id for v in vehicles]
    if len(set(vids)) != len(vids):
        raise ValueError("vehicle ids must be unique")

    def finish(res: OptimizationResult) -> OptimizationResult:
        res.runtime_ms = round((time.perf_counter() - t0) * 1000, 1)
        res.time_limit_s = time_limit_s
        res.notes = notes + res.notes
        return res

    if not stops:
        return finish(OptimizationResult(status="empty", notes=["No stops supplied."]))

    active = [v for v in vehicles if v.available]
    unassigned: list[Unassigned] = []
    if not active:
        unassigned = [Unassigned(stop_id=s.id, reason="No available vehicles") for s in stops]
        return finish(OptimizationResult(status="infeasible", unassigned=unassigned))

    # ---- pre-checks that give precise reasons
    max_w = max(v.payload_kg for v in active)
    max_v = max(v.volume_m3 for v in active)
    keep: list[int] = []  # original stop indices (0-based into `stops`)
    for i, s in enumerate(stops):
        reason = None
        if s.weight_kg > max_w:
            reason = f"Weight {s.weight_kg:g} kg exceeds the largest available vehicle payload ({max_w:g} kg)"
        elif s.volume_m3 > max_v:
            reason = f"Volume {s.volume_m3:g} m3 exceeds the largest available vehicle volume ({max_v:g} m3)"
        elif s.window_end_min is not None and duration_min[0][i + 1] > s.window_end_min:
            reason = (
                f"Unreachable before window closes: {duration_min[0][i + 1]:.0f} min from depot, "
                f"window ends at {s.window_end_min:g} min"
            )
        elif duration_min[0][i + 1] > horizon_min:
            reason = "Unreachable within the planning horizon"
        if reason:
            unassigned.append(Unassigned(stop_id=s.id, reason=reason))
        else:
            keep.append(i)
    if not keep:
        return finish(OptimizationResult(status="infeasible", unassigned=unassigned))

    nodes = [0] + [i + 1 for i in keep]  # solver node -> matrix index
    n = len(nodes)
    sub_stops = [None] + [stops[i] for i in keep]
    D = [[distance_km[a][b] for b in nodes] for a in nodes]
    T = [[duration_min[a][b] for b in nodes] for a in nodes]

    # ---- objective normalisation
    maxd = max(max(r) for r in D) or 1.0
    maxt = max(max(r) for r in T) or 1.0
    maxcpk = max(v.cost_per_km for v in active)
    maxfix = max(v.fixed_cost for v in active)
    maxc = (maxd * maxcpk + maxfix) or 1.0
    maxe = (maxd * max(v.emissions_g_per_km for v in active)) or 1.0
    wsum = weights.distance + weights.time + weights.cost + weights.emissions

    def arc_cost(v: OptVehicle, i: int, j: int) -> int:
        if j == 0 and not return_to_depot:
            return 0
        d, t = D[i][j], T[i][j]
        val = (
            weights.distance * d / maxd
            + weights.time * t / maxt
            + weights.cost * d * v.cost_per_km / maxc
            + weights.emissions * d * v.emissions_g_per_km / maxe
        ) / wsum
        return int(round(val * 1000))

    manager = pywrapcp.RoutingIndexManager(n, len(active), 0)
    routing = pywrapcp.RoutingModel(manager)

    for k, v in enumerate(active):
        cb = routing.RegisterTransitCallback(
            lambda a, b, v=v: arc_cost(v, manager.IndexToNode(a), manager.IndexToNode(b))
        )
        routing.SetArcCostEvaluatorOfVehicle(cb, k)
        routing.SetFixedCostOfVehicle(int(round(1000 * weights.cost / wsum * v.fixed_cost / maxc)), k)

    # time dimension (service time of the origin node is added to each arc)
    svc = [0] + [int(round(s.service_minutes * 60)) for s in sub_stops[1:]]  # type: ignore[union-attr]
    Ts = [[int(round(T[i][j] * 60)) for j in range(n)] for i in range(n)]

    def time_cb(a: int, b: int) -> int:
        i, j = manager.IndexToNode(a), manager.IndexToNode(b)
        if j == 0 and not return_to_depot:
            return svc[i]
        return Ts[i][j] + svc[i]

    tcb = routing.RegisterTransitCallback(time_cb)
    horizon = int(horizon_min * 60)
    routing.AddDimension(tcb, horizon, horizon, True, "Time")
    tdim = routing.GetDimensionOrDie("Time")
    for node in range(1, n):
        s = sub_stops[node]
        lo = int(round((s.window_start_min or 0) * 60))  # type: ignore[union-attr]
        hi = int(round((s.window_end_min if s.window_end_min is not None else horizon_min) * 60))  # type: ignore[union-attr]
        tdim.CumulVar(manager.NodeToIndex(node)).SetRange(lo, min(hi, horizon))

    def demand_cb(attr: str, scale: int):
        vals = [0] + [int(math.ceil(getattr(s, attr) * scale - 1e-9)) for s in sub_stops[1:]]  # type: ignore[union-attr]
        return routing.RegisterUnaryTransitCallback(lambda a: vals[manager.IndexToNode(a)])

    routing.AddDimensionWithVehicleCapacity(
        demand_cb("weight_kg", 1000), 0, [int(math.floor(v.payload_kg * 1000 + 1e-9)) for v in active], True, "Weight"
    )
    routing.AddDimensionWithVehicleCapacity(
        demand_cb("volume_m3", 1000), 0, [int(math.floor(v.volume_m3 * 1000 + 1e-9)) for v in active], True, "Volume"
    )
    ones = routing.RegisterUnaryTransitCallback(lambda a: 0 if manager.IndexToNode(a) == 0 else 1)
    routing.AddDimensionWithVehicleCapacity(ones, 0, [min(v.max_stops, n - 1) for v in active], True, "Stops")

    for node in range(1, n):
        routing.AddDisjunction([manager.NodeToIndex(node)], DROP_PENALTY)

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    if n - 1 >= 4:
        params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromSeconds(int(time_limit_s))

    solution = routing.SolveWithParameters(params)
    if solution is None:
        notes.append(f"Solver returned no solution (status code {routing.status()}).")
        unassigned += [
            Unassigned(stop_id=sub_stops[i].id, reason="No feasible assignment found")  # type: ignore[union-attr]
            for i in range(1, n)
        ]
        return finish(OptimizationResult(status="infeasible", unassigned=unassigned))

    routes: list[VehicleRoute] = []
    served: set[int] = set()
    for k, v in enumerate(active):
        idx = routing.Start(k)
        prev = 0
        cum_d = cum_w = cum_v = 0.0
        visits: list[StopVisit] = []
        idx = solution.Value(routing.NextVar(idx))
        while not routing.IsEnd(idx):
            node = manager.IndexToNode(idx)
            s = sub_stops[node]
            cum_d += D[prev][node]
            cum_w += s.weight_kg  # type: ignore[union-attr]
            cum_v += s.volume_m3  # type: ignore[union-attr]
            arr = solution.Min(tdim.CumulVar(idx)) / 60
            visits.append(
                StopVisit(
                    stop_id=s.id, arrival_min=round(arr, 2),  # type: ignore[union-attr]
                    departure_min=round(arr + s.service_minutes, 2),  # type: ignore[union-attr]
                    cumulative_distance_km=round(cum_d, 3), load_kg=round(cum_w, 3), load_m3=round(cum_v, 4),
                )
            )
            served.add(node)
            prev = node
            idx = solution.Value(routing.NextVar(idx))
        if not visits:
            continue
        dist = cum_d + (D[prev][0] if return_to_depot else 0.0)
        dur = solution.Min(tdim.CumulVar(routing.End(k))) / 60
        routes.append(
            VehicleRoute(
                vehicle_id=v.vehicle_id, stops=visits, distance_km=round(dist, 3), duration_min=round(dur, 2),
                load_kg=round(cum_w, 3), load_m3=round(cum_v, 4),
                cost=round(dist * v.cost_per_km + v.fixed_cost, 2),
                emissions_g=round(dist * v.emissions_g_per_km, 1),
            )
        )

    for node in range(1, n):
        if node not in served:
            unassigned.append(
                Unassigned(
                    stop_id=sub_stops[node].id,  # type: ignore[union-attr]
                    reason="Could not be assigned within capacity, time-window, max-stops or time-limit constraints",
                )
            )
    status = "solved" if not unassigned else ("partial" if routes else "infeasible")
    return finish(
        OptimizationResult(
            status=status, routes=routes, unassigned=unassigned,
            total_distance_km=round(sum(r.distance_km for r in routes), 3),
            total_duration_min=round(sum(r.duration_min for r in routes), 2),
            total_cost=round(sum(r.cost for r in routes), 2),
            total_emissions_g=round(sum(r.emissions_g for r in routes), 1),
            objective=solution.ObjectiveValue() / 1000,
        )
    )
