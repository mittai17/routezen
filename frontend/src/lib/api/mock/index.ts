/** Isolated demo-data implementation of the API surface. Only imported from src/lib/api/index.ts. */
import { ApiError } from "../errors";
import type {
  Health, Location, OptimizationRequest, OptimizationRun, Package, Recommendation, RecommendationRequest, SummaryStats,
  VehicleOption, VehicleProfile,
} from "../types";
import { demoLocations, demoPackages, demoPlanStops, demoVehicles } from "./data";
import { haversineKm, nearestNeighbour, tourLength, twoOpt } from "./geo";

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

export async function mockOptimize(req: OptimizationRequest): Promise<OptimizationRun> {
  await sleep(600);
  if (req.algorithm.startsWith("quantum") || req.algorithm === "hybrid") {
    throw new ApiError("unavailable", "Quantum optimisation (Qiskit Aer simulation) needs the backend and is not available in demo mode.");
  }
  const t0 = performance.now();
  const depot = { lat: req.depot.lat, lng: req.depot.lng };
  const pts = req.stops.map((s) => ({ lat: s.latitude, lng: s.longitude }));
  let order = nearestNeighbour(depot, pts);
  if (req.algorithm === "classical_2opt") order = twoOpt(depot, pts, order);
  const dist = tourLength(depot, order.map((i) => pts[i]));
  const speed = 26;
  const service = req.stops.reduce((a, s) => a + s.service_minutes, 0);
  return {
    id: `demo-run-${Date.now()}`, algorithm: req.algorithm, status: "completed", objective: req.objective,
    order: order.map((i) => req.stops[i].id), distance_km: +dist.toFixed(2), duration_min: +((dist / speed) * 60 + service).toFixed(0),
    total_cost: null, geometry: null, routing_available: false, distance_is_estimate: true,
    compute_seconds: +((performance.now() - t0) / 1000).toFixed(3), simulated: false,
    notes: ["Demo data. Distance is a straight-line fallback estimate; road routing is unavailable, so no route line is drawn."],
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
