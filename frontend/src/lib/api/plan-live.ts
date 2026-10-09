import { z } from "zod";
import { request } from "./client";
import { ApiError } from "./errors";
import { optimizationRunSchema, recommendationsSchema, routeResultSchema } from "@/lib/schemas";
import type { OptimizationRequest, OptimizationRun, Recommendation, RecommendationRequest, VehicleProfile } from "./types";

/**
 * Live (non-demo) planning calls against the FastAPI backend.
 * - Recommendations: POST /recommendations (synchronous).
 * - Optimization: POST /optimization/{classical|quantum} returns a run record; we poll
 *   GET /optimization/runs/{id} until it reaches a terminal status, then fetch OSRM road
 *   geometry for the resulting visit order. No straight lines are ever produced as geometry.
 */

export async function liveRecommend(req: RecommendationRequest): Promise<Recommendation[]> {
  return request("/recommendations", {
    method: "POST",
    body: {
      packages: req.stops.map((s) => ({
        package_id: s.id,
        weight_kg: s.weight_kg,
        latitude: s.latitude,
        longitude: s.longitude,
        service_minutes: s.service_minutes,
      })),
      depot: { latitude: req.depot.lat, longitude: req.depot.lng },
      preferences: {},
      vehicle_ids: req.vehicle_ids,
    },
    schema: recommendationsSchema,
    timeoutMs: 60_000,
  });
}

const OBJECTIVE_WEIGHTS: Record<string, { distance: number; time: number; cost: number; emissions: number }> = {
  distance: { distance: 1, time: 0.1, cost: 0.1, emissions: 0 },
  time: { distance: 0.1, time: 1, cost: 0.1, emissions: 0 },
  cost: { distance: 0.1, time: 0.1, cost: 1, emissions: 0 },
  emissions: { distance: 0.1, time: 0.1, cost: 0.1, emissions: 1 },
};

/** All-in per-km cost: energy price / efficiency (₹/L ÷ km/L or ₹/kWh ÷ km/kWh) + non-energy operating cost. */
export const perKmCost = (v: Pick<VehicleProfile, "energy_price" | "efficiency_value" | "operating_cost_per_km">) =>
  Number(v.energy_price) / v.efficiency_value + Number(v.operating_cost_per_km);

const runStatusSchema = z.object({
  id: z.string(),
  kind: z.enum(["classical", "quantum"]),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled", "timed_out"]),
  error: z.string().nullish(),
  result: z.record(z.string(), z.unknown()).nullish(),
});
type RunStatusRecord = z.infer<typeof runStatusSchema>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pollRun(id: string, budgetMs: number): Promise<RunStatusRecord> {
  const start = Date.now();
  for (;;) {
    const run = await request(`/optimization/runs/${encodeURIComponent(id)}`, { schema: runStatusSchema });
    if (run.status !== "queued" && run.status !== "running") return run;
    if (Date.now() - start > budgetMs) throw new ApiError("timeout", "The optimization is still running. Check Optimization Results for its outcome.");
    await sleep(1000);
  }
}

const numArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export async function liveOptimize(
  req: OptimizationRequest,
  vehicles: VehicleProfile[],
): Promise<OptimizationRun> {
  const quantum = req.algorithm.startsWith("quantum");
  const depot = { latitude: req.depot.lat, longitude: req.depot.lng, name: req.depot.name };
  const stops = req.stops.map((s) => ({
    id: s.id, latitude: s.latitude, longitude: s.longitude, weight_kg: s.weight_kg, service_minutes: s.service_minutes,
  }));
  const usable = vehicles.filter((v) => v.available).slice(0, Math.max(1, req.max_vehicles));
  if (!quantum && usable.length === 0) {
    throw new ApiError("validation", "No available vehicle profiles. Add or enable one on the Vehicle Profiles page.");
  }
  const body = quantum
    ? { depot, stops, objective: req.objective === "time" ? "duration" : "distance", return_to_depot: true }
    : {
        depot, stops, return_to_depot: true,
        weights: OBJECTIVE_WEIGHTS[req.objective] ?? OBJECTIVE_WEIGHTS.distance,
        vehicles: usable.map((v) => ({
          vehicle_id: v.id, name: v.name, payload_kg: v.payload_kg, volume_m3: v.volume_m3,
          cost_per_km: perKmCost(v), fixed_cost: Number(v.fixed_cost_per_delivery), emissions_g_per_km: v.emissions_g_per_km,
        })),
      };

  const started = await request(`/optimization/${quantum ? "quantum" : "classical"}`, {
    method: "POST", body, schema: runStatusSchema, timeoutMs: 30_000,
  });
  const run = await pollRun(started.id, quantum ? 120_000 : 150_000);
  if (run.status !== "succeeded" || !run.result) {
    throw new ApiError("unavailable", run.error || `Optimization ${run.status.replace("_", " ")}.`);
  }
  const res = run.result as Record<string, unknown>;

  let order: string[] = [];
  let distance: number | null = null;
  let duration: number | null = null;
  let cost: number | null = null;
  let seconds = Number(res.runtime_ms ?? 0) / 1000;
  const notes: string[] = [];
  let isEstimate = Boolean(res.fallback_estimate);

  if (quantum) {
    order = numArr(res.order);
    if (res.feasible === false) notes.push(`Decoded quantum sample was not feasible: ${numArr(res.feasibility_issues).join("; ") || "constraint violated"}.`);
    if (res.cost != null && String(res.objective) === "distance") distance = Number(res.cost);
    if (res.gap_vs_brute_force_pct != null) notes.push(`Gap vs brute-force optimum on the same matrix: ${Number(res.gap_vs_brute_force_pct).toFixed(1)}%.`);
    notes.push(String(res.disclaimer ?? "Qiskit Aer statevector simulation; no quantum hardware used and no advantage claimed."));
  } else {
    const routes = (res.routes as { stops: { stop_id: string }[] }[] | undefined) ?? [];
    order = routes.flatMap((r) => r.stops.map((s) => s.stop_id));
    distance = Number(res.total_distance_km ?? 0);
    duration = Number(res.total_duration_min ?? 0);
    cost = Number(res.total_cost ?? 0);
    notes.push(...numArr(res.notes));
    const un = (res.unassigned as { stop_id: string; reason: string }[] | undefined) ?? [];
    for (const u of un) notes.push(`Unassigned ${u.stop_id}: ${u.reason}`);
    notes.push(`Solver status: ${String(res.status)}.`);
    if (routes.length > 1) notes.push(`${routes.length} vehicle routes; the order shown concatenates them in route order.`);
  }
  if (!seconds || !Number.isFinite(seconds)) seconds = 0;

  // Road geometry for the visit order. Failure => routing unavailable, never a straight line.
  let geometry: [number, number][] | null = null;
  let routingAvailable = false;
  const byId = new Map(req.stops.map((s) => [s.id, s]));
  const ordered = order.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  if (ordered.length > 0) {
    const coords = [req.depot, ...ordered.map((s) => ({ lat: s.latitude, lng: s.longitude })), req.depot].map((c) => ({ lat: c.lat, lng: c.lng }));
    try {
      const r = await request("/routing/route", { method: "POST", body: { coordinates: coords }, schema: routeResultSchema, timeoutMs: 30_000 });
      if (r.geometry && r.geometry.length > 1) {
        geometry = r.geometry;
        routingAvailable = true;
        if (quantum || distance == null || isEstimate) { distance = r.distance_km; duration = r.duration_min; isEstimate = false; }
      }
    } catch {
      notes.push("Road routing was unavailable, so no route line is drawn.");
    }
  }

  return optimizationRunSchema.parse({
    id: run.id,
    algorithm: req.algorithm,
    status: "completed",
    objective: req.objective,
    order,
    distance_km: distance,
    duration_min: duration,
    total_cost: cost,
    geometry,
    routing_available: routingAvailable,
    distance_is_estimate: isEstimate,
    compute_seconds: seconds,
    simulated: quantum,
    notes,
    created_at: new Date().toISOString(),
  });
}
