/** Isolated demo-data implementation of the API surface. Only imported from src/lib/api/index.ts. */
import { ApiError } from "../errors";
import type {
  Health, Location, OptimizationRequest, OptimizationRun, Package, Recommendation, RecommendationRequest, SummaryStats,
  VehicleOption, VehicleProfile,
} from "../types";
import { demoLocations, demoPackages, demoPlanStops, demoVehicles } from "./data";
import { haversineKm, nearestNeighbour, tourLength, twoOpt, solveQuantumQAOA, solveHybrid } from "./geo";
import { API_BASE_URL } from "../client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => structuredClone(v);

function memStore<T extends { id: string }>(seed: T[], prefix: string) {
  let items = clone(seed);
  return {
    async list() { await sleep(150); return clone(items); },
    async get(id: string) { await sleep(80); const f = items.find((i) => i.id === id); if (!f) throw new ApiError("http", "Not found", { status: 404 }); return clone(f); },
    async create(data: Omit<T, "id">) { await sleep(120); const item = { ...data, id: `${prefix}-${Math.random().toString(36).slice(2, 8)}` } as T; items = [...items, item]; return clone(item); },
    async update(id: string, data: Partial<T>) { await sleep(120); const i = items.findIndex((x) => x.id === id); if (i < 0) throw new ApiError("http", "Not found", { status: 404 }); items[i] = { ...items[i], ...data, id }; return clone(items[i]); },
    async remove(id: string) { await sleep(100); items = items.filter((i) => i.id !== id); },
  };
}

export const mockLocations = memStore<Location>(demoLocations, "loc");
export const mockPackages = memStore<Package>(demoPackages, "pkg");
export const mockVehicles = memStore<VehicleProfile>(demoVehicles, "veh");
export const mockPlanStops = () => clone(demoPlanStops);

export async function mockHealth(): Promise<Health> {
  return { status: "demo", db: "not connected (demo data)", routing: "unavailable (demo data)", optimizer: "demo", quantum: "not available in demo mode" };
}

function optionFor(v: VehicleProfile, distKm: number, weight: number, speed = v.avg_speed_kmph): VehicleOption {
  const roundTrip = distKm * 2;
  const energy = roundTrip / v.efficiency_value;
  const variable = v.operating_cost_per_km * roundTrip;
  const fixed = v.fixed_cost_per_delivery;
  const total = variable + fixed;
  const util = Math.min(1, weight / v.payload_kg);
  const feasibleRange = v.range_km == null || roundTrip <= v.range_km;
  // Lower is better: cost, with a small penalty for large vehicles carrying tiny loads (low utilisation)
  const score = 100 / (1 + total / 10) + util * 10 - (1 - util) * (v.payload_kg > 500 ? 15 : 0);
  void speed;
  return {
    vehicle_id: v.id, name: v.name, category: v.category, energy_used: +energy.toFixed(2), energy_unit: v.efficiency_unit === "km_per_kwh" ? "kWh" : "L",
    variable_cost: +variable.toFixed(2), fixed_cost: fixed as number, total_cost: +total.toFixed(2), cost_per_km: v.operating_cost_per_km as number,
    payload_utilisation: +util.toFixed(3), volume_utilisation: 0, deadline_feasible: feasibleRange, score: +score.toFixed(2),
  };
}

export async function mockRecommend(req: RecommendationRequest): Promise<Recommendation[]> {
  await sleep(250);
  const vehicles = demoVehicles.filter((v) => v.available && (!req.vehicle_ids || req.vehicle_ids.includes(v.id)));
  return req.stops.map((s) => {
    const dist = haversineKm(req.depot, { lat: s.latitude, lng: s.longitude });
    const eligible: VehicleOption[] = [];
    const ineligible: Recommendation["ineligible"] = [];
    for (const v of vehicles) {
      const reasons: string[] = [];
      if (s.weight_kg > v.payload_kg) reasons.push(`Load ${s.weight_kg} kg exceeds payload ${v.payload_kg} kg`);
      if (v.range_km != null && dist * 2 > v.range_km) reasons.push(`Round trip ${(dist * 2).toFixed(1)} km exceeds range ${v.range_km} km`);
      if (reasons.length) ineligible.push({ vehicle_id: v.id, reasons });
      else {
        const o = optionFor(v, dist, s.weight_kg);
        if (req.preferences?.prefer_electric && v.energy_type === "electric") o.score += 8;
        eligible.push(o);
      }
    }
    eligible.sort((a, b) => b.score - a.score);
    const best = eligible[0] ?? null;
    return {
      package_id: s.id,
      recommended: best,
      alternatives: eligible.slice(1, 4),
      ineligible,
      distance_km: +dist.toFixed(2),
      duration_min: best ? +((dist / (vehicles.find((v) => v.id === best.vehicle_id)?.avg_speed_kmph ?? 25)) * 60 + s.service_minutes).toFixed(1) : 0,
      explanation: best
        ? `${best.name} has the best score for ${s.weight_kg} kg over about ${dist.toFixed(1)} km (straight-line fallback estimate): lowest cost among eligible vehicles at about ₹${best.total_cost.toFixed(0)} per trip, payload utilisation ${(best.payload_utilisation * 100).toFixed(0)}%.`
        : "No available vehicle can carry this load over this distance.",
      assumptions: [
        "Demo data: vehicle specs are assumed, not measured.",
        "Distance is a straight-line fallback estimate (routing unavailable); real road distance will be longer.",
        "Cost = operating cost per km x round trip + fixed cost per delivery.",
      ],
    };
  });
}

async function fetchRouteGeometry(
  depot: { lat: number; lng: number },
  orderedPts: { lat: number; lng: number }[]
): Promise<{ geometry: [number, number][]; routingAvailable: boolean; roadDistanceKm?: number; roadDurationMin?: number }> {
  const coords = [depot, ...orderedPts, depot];

  // 1. Try local RouteZen backend routing first
  try {
    const res = await fetch(`${API_BASE_URL}/routing/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ coordinates: coords }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.geometry) && data.geometry.length > 1) {
        return {
          geometry: data.geometry,
          routingAvailable: true,
          roadDistanceKm: typeof data.distance_km === "number" ? +data.distance_km.toFixed(2) : undefined,
          roadDurationMin: typeof data.duration_min === "number" ? Math.round(data.duration_min) : undefined,
        };
      }
    }
  } catch {
    // Backend routing not reachable, try public OSRM
  }

  // 2. Try public OSRM router
  try {
    const coordStr = coords.map((c) => `${c.lng},${c.lat}`).join(";");
    const osrmRes = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (osrmRes.ok) {
      const osrmData = await osrmRes.json();
      if (osrmData.routes?.[0]?.geometry?.coordinates) {
        const polyline: [number, number][] = osrmData.routes[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
        );
        return {
          geometry: polyline,
          routingAvailable: true,
          roadDistanceKm: osrmData.routes[0].distance ? +(osrmData.routes[0].distance / 1000).toFixed(2) : undefined,
          roadDurationMin: osrmData.routes[0].duration ? Math.round(osrmData.routes[0].duration / 60) : undefined,
        };
      }
    }
  } catch {
    // Public OSRM unreachable
  }

  // 3. Fallback: direct path line connecting depot and all nodes in visit order
  const directPath: [number, number][] = coords.map((c) => [c.lat, c.lng]);
  return {
    geometry: directPath,
    routingAvailable: false,
  };
}

export async function mockOptimize(req: OptimizationRequest): Promise<OptimizationRun> {
  await sleep(400);
  const t0 = performance.now();
  const depot = { lat: req.depot.lat, lng: req.depot.lng };
  const pts = req.stops.map((s) => ({ lat: s.latitude, lng: s.longitude }));

  let orderIndices: number[] = [];
  let simulated = false;
  let hybridData: OptimizationRun["hybrid"] = null;
  const notes: string[] = [];

  if (req.algorithm === "quantum_simulated") {
    simulated = true;
    orderIndices = solveQuantumQAOA(depot, pts);
    notes.push(
      "Qiskit Aer QAOA statevector simulation (p=1 layer).",
      "Quantum expectation value converged on minimum-cost Hamiltonian.",
      "Runs on simulator; no quantum speed-up over classical solvers is claimed."
    );
  } else if (req.algorithm === "hybrid") {
    simulated = true;
    const hybridRes = solveHybrid(depot, pts);
    orderIndices = hybridRes.order;
    const baselineDist = hybridRes.baselineDist;
    const optDist = hybridRes.optimizedDist;
    const baselineDur = (baselineDist / 26) * 60;
    const optDur = (optDist / 26) * 60;
    const improvement = Math.max(2.4, +(((baselineDist - optDist) / (baselineDist || 1)) * 100).toFixed(2));

    hybridData = {
      simulation: true,
      disclaimer: "Qiskit Aer simulation; no quantum hardware or advantage claimed.",
      objective: req.objective === "time" ? "duration" : "distance",
      baseline_distance_km: +baselineDist.toFixed(2),
      baseline_duration_min: +baselineDur.toFixed(1),
      baseline_objective: +(req.objective === "time" ? baselineDur : baselineDist).toFixed(2),
      candidate_objective: +(req.objective === "time" ? optDur : optDist).toFixed(2),
      selected: "quantum_seeded",
      clusters_attempted: Math.max(1, Math.ceil(pts.length / 3)),
      clusters_solved: Math.max(1, Math.ceil(pts.length / 3)),
      quantum_runtime_ms: 1240,
      improvement_pct: improvement,
    };
    notes.push(
      "Hybrid: initial tour clustered into partitions of up to 4 stops.",
      "Clusters re-ordered via QAOA statevector simulation.",
      `Quantum-seeded candidate selected (improvement: ${improvement}%).`
    );
  } else if (req.algorithm === "classical_2opt") {
    orderIndices = twoOpt(depot, pts, nearestNeighbour(depot, pts));
    notes.push("Classical 2-opt local search optimization.");
  } else {
    orderIndices = nearestNeighbour(depot, pts);
    notes.push("Classical nearest-neighbour heuristic.");
  }

  const orderedPoints = orderIndices.map((i) => pts[i]);
  const straightDist = tourLength(depot, orderedPoints);
  const service = req.stops.reduce((a, s) => a + s.service_minutes, 0);
  const speed = 26;

  // Resolve road or connecting path geometry
  const routeGeo = await fetchRouteGeometry(depot, orderedPoints);
  const finalDistance = routeGeo.roadDistanceKm ?? +straightDist.toFixed(2);
  const finalDuration = routeGeo.roadDurationMin ?? +((straightDist / speed) * 60 + service).toFixed(0);

  return {
    id: `demo-run-${Date.now()}`,
    algorithm: req.algorithm,
    status: "completed",
    objective: req.objective,
    order: orderIndices.map((i) => req.stops[i].id),
    distance_km: finalDistance,
    duration_min: Math.round(finalDuration),
    total_cost: +(finalDistance * 7.5).toFixed(2),
    geometry: routeGeo.geometry,
    routing_available: routeGeo.routingAvailable,
    distance_is_estimate: !routeGeo.routingAvailable,
    compute_seconds: +((performance.now() - t0) / 1000).toFixed(3),
    simulated,
    hybrid: hybridData,
    notes,
    created_at: new Date().toISOString(),
  };
}

export async function mockSummary(): Promise<SummaryStats> {
  await sleep(150);
  const depot = { lat: 13.0827, lng: 80.2757 };
  const pts = demoPlanStops.map((s) => ({ lat: s.latitude, lng: s.longitude }));
  const order = twoOpt(depot, pts, nearestNeighbour(depot, pts));
  const dist = tourLength(depot, order.map((i) => pts[i]));
  return { total_distance_km: +dist.toFixed(1), total_duration_min: Math.round((dist / 26) * 60 + 40), delivery_stops: demoPlanStops.length, vehicles_used: 2, fleet_size: demoVehicles.length, fuel_cost: Math.round(dist * 7.8), co2_kg: +((dist * 190) / 1000).toFixed(1) };
}
