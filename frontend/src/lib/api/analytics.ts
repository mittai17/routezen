/**
 * Analytics data layer: loads plans / vehicles / packages / events / optimisation runs and derives metrics client-side.
 * Real mode reads the backend list endpoints; demo mode uses a deterministic, clearly-labelled in-memory dataset.
 * Pure compute functions (computeAnalytics) are unit-tested and never invent data: missing inputs yield null, not zero.
 */
import { z } from "zod";
import { request, USE_DEMO_DATA } from "./client";
import { moneySchema, packageSchema, vehicleSchema } from "@/lib/schemas";
import type { Package, VehicleProfile } from "./types";
import { demoPackages, demoVehicles, DEPOT } from "./mock/data";

/* ------------------------------------------------------------------ schemas */
const assignmentSchema = z.object({
  vehicle_id: z.string(),
  package_id: z.string(),
  sequence: z.number().default(0),
  eta: z.string().nullish(),
  distance_km: z.number().nullish(),
  cost: moneySchema.nullish(),
});
export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  depot_location_id: z.string().nullish(),
  start_time: z.string().nullish(),
  total_distance_km: z.number().nullish(),
  total_duration_min: z.number().nullish(),
  total_cost: moneySchema.nullish(),
  total_emissions_g: z.number().nullish(),
  notes: z.string().nullish(),
  created_at: z.string(),
  assignments: z.array(assignmentSchema).default([]),
});
export const eventSchema = z.object({
  id: z.string(),
  plan_id: z.string().nullish(),
  package_id: z.string().nullish(),
  vehicle_id: z.string().nullish(),
  type: z.string(),
  message: z.string().nullish(),
  occurred_at: z.string(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
});
export const runSchema = z.object({
  id: z.string(),
  kind: z.enum(["classical", "quantum", "hybrid"]),
  status: z.string(),
  created_at: z.string(),
  result: z.record(z.string(), z.unknown()).nullish(),
});

export type Plan = z.infer<typeof planSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type DeliveryEvent = z.infer<typeof eventSchema>;
export type OptRun = z.infer<typeof runSchema>;

export interface AnalyticsInput {
  source: "demo" | "api";
  plans: Plan[];
  vehicles: VehicleProfile[];
  packages: Package[];
  events: DeliveryEvent[];
  runs: OptRun[];
  /** Server-reported caveat about run history (in-memory, resets on restart). */
  runsNote?: string | null;
}

/* ------------------------------------------------------------------ fetching */
const PAGE = 200;
const MAX_PAGES = 10;

/** Fetch every item of a paginated `{items,total,limit,offset}` endpoint. */
export async function fetchAllItems<T>(path: string, item: z.ZodType<T>, query: Record<string, string | number> = {}): Promise<T[]> {
  const pageSchema = z.object({ items: z.array(item), total: z.number() });
  const out: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await request(path, { schema: pageSchema, query: { ...query, limit: PAGE, offset: i * PAGE } });
    out.push(...page.items);
    if (out.length >= page.total || page.items.length === 0) break;
  }
  return out;
}

export async function loadAnalyticsInput(): Promise<AnalyticsInput> {
  if (USE_DEMO_DATA) {
    await new Promise((r) => setTimeout(r, 250));
    return buildDemoInput();
  }
  const [plans, vehicles, packages, events, runs, optNote] = await Promise.all([
    fetchAllItems("/plans", planSchema),
    fetchAllItems("/vehicles", vehicleSchema),
    fetchAllItems("/packages", packageSchema),
    fetchAllItems("/events", eventSchema),
    fetchAllItems("/optimization/runs", runSchema, { limit: 500 }).catch(() => [] as OptRun[]),
    request("/analytics/optimization", { schema: z.object({ note: z.string().nullish() }).passthrough() }).catch(() => null),
  ]);
  return { source: "api", plans, vehicles, packages, events, runs, runsNote: optNote?.note ?? null };
}

/* ------------------------------------------------------------------ date ranges */
export type RangePreset = "7d" | "30d" | "90d" | "all" | "custom";
export interface DateRange { from: Date | null; to: Date | null }

export function resolveRange(preset: RangePreset, custom: { from: string; to: string }, now = new Date()): DateRange {
  if (preset === "all") return { from: null, to: null };
  if (preset === "custom") {
    const from = custom.from ? new Date(`${custom.from}T00:00:00`) : null;
    const to = custom.to ? new Date(`${custom.to}T23:59:59.999`) : null;
    return { from: from && !isNaN(+from) ? from : null, to: to && !isNaN(+to) ? to : null };
  }
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  return { from: new Date(now.getTime() - days * 86_400_000), to: null };
}
const inRange = (iso: string | null | undefined, r: DateRange) => {
  if (!iso) return r.from === null && r.to === null;
  const t = Date.parse(iso);
  if (isNaN(t)) return false;
  return (r.from === null || t >= +r.from) && (r.to === null || t <= +r.to);
};

/* ------------------------------------------------------------------ computation */
export interface PlanMetric {
  id: string; name: string; status: string; date: string; deliveries: number;
  distanceKm: number | null; cost: number | null; costPerDelivery: number | null; costPerKm: number | null; emissionsKg: number | null;
  emissionsEstimated: boolean;
}
export interface VehicleMetric {
  vehicleId: string; name: string; energyType: VehicleProfile["energy_type"]; assignments: number; plans: number;
  distanceKm: number; distanceEstimated: boolean; energyUsed: number; energyUnit: "L" | "kWh"; energyCost: number;
  emissionsKg: number; avgUtilisation: number | null; verification: VehicleProfile["verification"];
}
export interface EfficiencyRow { name: string; energyType: string; efficiency: number; unit: string; energyCostPerKm: number | null; operatingCostPerKm: number; emissionsGPerKm: number; verification: string }
export interface DeadlineStats { actualOnTime: number; actualLate: number; plannedOnTime: number; plannedLate: number; noDeadline: number; unknown: number; actualRate: number | null; plannedRate: number | null }
export interface SolverStats { kind: "classical" | "quantum" | "hybrid"; runs: number; succeeded: number; failed: number; avgRuntimeMs: number | null }
export interface QuantumRow { id: string; created: string; nStops: number | null; quantumCost: number | null; classicalCost: number | null; bruteForceCost: number | null; gapPct: number | null; matchesBruteForce: boolean | null }

export interface AnalyticsResult {
  plans: PlanMetric[];
  totals: { plans: number; deliveries: number; distanceKm: number | null; cost: number | null; costPerDelivery: number | null; costPerKm: number | null; emissionsKg: number | null; energyByUnit: { L: number; kWh: number }; energyCost: number | null };
  vehicles: VehicleMetric[];
  efficiency: EfficiencyRow[];
  utilisationOverall: number | null;
  deadline: DeadlineStats;
  solvers: SolverStats[];
  quantumRows: QuantumRow[];
  hasPlans: boolean;
  anyEstimatedDistance: boolean;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ratio = (a: number | null, b: number | null) => (a !== null && b !== null && b > 0 ? a / b : null);

export function computeAnalytics(input: AnalyticsInput, range: DateRange): AnalyticsResult {
  const vById = new Map(input.vehicles.map((v) => [v.id, v]));
  const pById = new Map(input.packages.map((p) => [p.id, p]));
  const plans = input.plans.filter((p) => p.status !== "cancelled" && inRange(p.start_time ?? p.created_at, range));

  const vAgg = new Map<string, { assignments: number; plans: Set<string>; dist: number; est: boolean; energy: number; cost: number; kg: number; utils: number[] }>();
  const planMetrics: PlanMetric[] = [];
  let anyEstimatedDistance = false;

  for (const plan of plans) {
    const n = plan.assignments.length;
    const asgDist = plan.assignments.map((a) => a.distance_km);
    const allAsgDist = n > 0 && asgDist.every((d) => d != null);
    const distanceKm = plan.total_distance_km ?? (allAsgDist ? sum(asgDist as number[]) : null);
    const cost = plan.total_cost ?? null;

    const byVehicle = new Map<string, Assignment[]>();
    for (const a of plan.assignments) byVehicle.set(a.vehicle_id, [...(byVehicle.get(a.vehicle_id) ?? []), a]);
    let emissionsKg = plan.total_emissions_g != null ? plan.total_emissions_g / 1000 : null;
    const emissionsEstimated = emissionsKg === null;
    let estEm = 0;
    let estEmOk = emissionsKg === null && byVehicle.size > 0;

    for (const [vid, list] of byVehicle) {
      const v = vById.get(vid);
      const agg = vAgg.get(vid) ?? { assignments: 0, plans: new Set<string>(), dist: 0, est: false, energy: 0, cost: 0, kg: 0, utils: [] };
      const exact = list.every((a) => a.distance_km != null);
      let d: number | null = null;
      if (exact) d = sum(list.map((a) => a.distance_km as number));
      else if (distanceKm !== null && n > 0) { d = (distanceKm * list.length) / n; agg.est = true; anyEstimatedDistance = true; }
      if (d !== null) {
        agg.dist += d;
        if (v) {
          agg.energy += d / v.efficiency_value;
          agg.cost += (d / v.efficiency_value) * Number(v.energy_price);
          if (emissionsKg === null) estEm += (d * v.emissions_g_per_km) / 1000;
        } else estEmOk = false;
      } else estEmOk = false;
      agg.assignments += list.length;
      agg.plans.add(plan.id);
      if (v) {
        const kg = sum(list.map((a) => pById.get(a.package_id)?.weight_kg ?? 0));
        agg.kg += kg;
        if (v.payload_kg > 0) agg.utils.push(Math.min(kg / v.payload_kg, 9.99));
      }
      vAgg.set(vid, agg);
    }
    if (emissionsKg === null && estEmOk) emissionsKg = estEm;

    planMetrics.push({
      id: plan.id, name: plan.name, status: plan.status, date: plan.start_time ?? plan.created_at, deliveries: n,
      distanceKm, cost, costPerDelivery: ratio(cost, n), costPerKm: ratio(cost, distanceKm), emissionsKg, emissionsEstimated: emissionsEstimated && emissionsKg !== null,
    });
  }

  const vehicles: VehicleMetric[] = [...vAgg.entries()].map(([vid, a]) => {
    const v = vById.get(vid);
    return {
      vehicleId: vid, name: v?.name ?? "Unknown vehicle", energyType: v?.energy_type ?? "petrol", assignments: a.assignments, plans: a.plans.size,
      distanceKm: a.dist, distanceEstimated: a.est, energyUsed: a.energy, energyUnit: v?.efficiency_unit === "km_per_kwh" ? "kWh" : "L",
      energyCost: a.cost, emissionsKg: v ? (a.dist * v.emissions_g_per_km) / 1000 : 0,
      avgUtilisation: a.utils.length ? sum(a.utils) / a.utils.length : null, verification: v?.verification ?? "assumed",
    } as VehicleMetric;
  }).sort((a, b) => b.assignments - a.assignments);

  const withCost = planMetrics.filter((p) => p.cost !== null);
  const withDist = planMetrics.filter((p) => p.distanceKm !== null);
  const withEm = planMetrics.filter((p) => p.emissionsKg !== null);
  const totalCost = withCost.length ? sum(withCost.map((p) => p.cost as number)) : null;
  const totalDeliveries = sum(planMetrics.map((p) => p.deliveries));
  const costDeliveries = sum(withCost.map((p) => p.deliveries));
  const costDist = sum(withCost.filter((p) => p.distanceKm !== null).map((p) => p.distanceKm as number));
  const energyByUnit = { L: 0, kWh: 0 };
  for (const v of vehicles) energyByUnit[v.energyUnit] += v.energyUsed;

  const utils = vehicles.map((v) => v.avgUtilisation).filter((u): u is number => u !== null);

  const efficiency: EfficiencyRow[] = input.vehicles.map((v) => ({
    name: v.name, energyType: v.energy_type, efficiency: v.efficiency_value, unit: v.efficiency_unit === "km_per_kwh" ? "km/kWh" : "km/L",
    energyCostPerKm: v.efficiency_value > 0 ? Number(v.energy_price) / v.efficiency_value : null, operatingCostPerKm: Number(v.operating_cost_per_km),
    emissionsGPerKm: v.emissions_g_per_km, verification: v.verification,
  }));

  return {
    plans: planMetrics,
    totals: {
      plans: plans.length, deliveries: totalDeliveries,
      distanceKm: withDist.length ? sum(withDist.map((p) => p.distanceKm as number)) : null,
      cost: totalCost, costPerDelivery: ratio(totalCost, costDeliveries || null), costPerKm: ratio(totalCost, costDist || null),
      emissionsKg: withEm.length ? sum(withEm.map((p) => p.emissionsKg as number)) : null,
      energyByUnit, energyCost: vehicles.length ? sum(vehicles.map((v) => v.energyCost)) : null,
    },
    vehicles, efficiency,
    utilisationOverall: utils.length ? sum(utils) / utils.length : null,
    deadline: computeDeadlines(plans, input.packages, input.events, range),
    ...computeSolvers(input.runs, range),
    hasPlans: plans.length > 0,
    anyEstimatedDistance,
  };
}

function computeDeadlines(plans: Plan[], packages: Package[], events: DeliveryEvent[], range: DateRange): DeadlineStats {
  const pById = new Map(packages.map((p) => [p.id, p]));
  const delivered = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "delivered" || !e.package_id || !inRange(e.occurred_at, range)) continue;
    const t = Date.parse(e.occurred_at);
    if (!isNaN(t) && (!delivered.has(e.package_id) || t < (delivered.get(e.package_id) as number))) delivered.set(e.package_id, t);
  }
  const s: DeadlineStats = { actualOnTime: 0, actualLate: 0, plannedOnTime: 0, plannedLate: 0, noDeadline: 0, unknown: 0, actualRate: null, plannedRate: null };
  const seen = new Set<string>();
  for (const plan of plans) {
    for (const a of plan.assignments) {
      if (seen.has(a.package_id)) continue;
      seen.add(a.package_id);
      const pkg = pById.get(a.package_id);
      const deadline = pkg?.deadline ? Date.parse(pkg.deadline) : NaN;
      if (isNaN(deadline)) { s.noDeadline++; continue; }
      const actual = delivered.get(a.package_id);
      if (actual !== undefined) { if (actual <= deadline) s.actualOnTime++; else s.actualLate++; continue; }
      const eta = a.eta ? Date.parse(a.eta) : NaN;
      if (isNaN(eta)) { s.unknown++; continue; }
      if (eta <= deadline) s.plannedOnTime++; else s.plannedLate++;
    }
  }
  const actualN = s.actualOnTime + s.actualLate;
  const plannedN = s.plannedOnTime + s.plannedLate;
  s.actualRate = actualN ? s.actualOnTime / actualN : null;
  s.plannedRate = plannedN ? s.plannedOnTime / plannedN : null;
  return s;
}

function computeSolvers(runs: OptRun[], range: DateRange): { solvers: SolverStats[]; quantumRows: QuantumRow[] } {
  const inR = runs.filter((r) => inRange(r.created_at, range));
  const solvers: SolverStats[] = (["classical", "quantum", "hybrid"] as const).map((kind) => {
    const rs = inR.filter((r) => r.kind === kind);
    const rt = rs.map((r) => num(r.result?.runtime_ms)).filter((x): x is number => x !== null);
    return {
      kind, runs: rs.length, succeeded: rs.filter((r) => r.status === "succeeded").length,
      failed: rs.filter((r) => ["failed", "timed_out", "cancelled"].includes(r.status)).length,
      avgRuntimeMs: rt.length ? sum(rt) / rt.length : null,
    };
  });
  const quantumRows: QuantumRow[] = inR.filter((r) => r.kind === "quantum" && r.status === "succeeded" && r.result).map((r) => ({
    id: r.id, created: r.created_at, nStops: num(r.result?.n_stops), quantumCost: num(r.result?.cost),
    classicalCost: num(r.result?.classical_ortools_cost), bruteForceCost: num(r.result?.brute_force_cost),
    gapPct: num(r.result?.gap_vs_brute_force_pct), matchesBruteForce: typeof r.result?.matches_brute_force === "boolean" ? r.result.matches_brute_force : null,
  }));
  return { solvers, quantumRows };
}

/* ------------------------------------------------------------------ demo dataset (deterministic) */
const iso = (t: number) => new Date(t).toISOString();

/** Demo plans/events. Package deadlines are set here so deadline compliance has something to show. Not real operations. */
export function buildDemoInput(now = Date.now()): AnalyticsInput {
  const vehicles = demoVehicles;
  const day = 86_400_000;
  const packages: Package[] = demoPackages.map((p, i) => ({ ...p, deadline: iso(now - (i + 1) * 2 * day + 16 * 3_600_000), status: "delivered" }));
  const vehIds = ["veh-bike", "veh-auto", "veh-car", "veh-van", "veh-minitruck"];
  const plans: Plan[] = [];
  const events: DeliveryEvent[] = [];
  for (let i = 0; i < 8; i++) {
    const start = now - (i * 3 + 1) * day;
    const pkgs = [packages[i % 8], packages[(i + 3) % 8]];
    const veh = vehicles.find((v) => v.id === vehIds[i % vehIds.length]) as VehicleProfile;
    const dist = 18 + ((i * 7) % 13);
    const cost = dist * Number(veh.operating_cost_per_km) + pkgs.length * Number(veh.fixed_cost_per_delivery);
    plans.push({
      id: `demo-plan-${i + 1}`, name: `Demo route ${i + 1}`, status: i === 0 ? "dispatched" : "completed", depot_location_id: DEPOT.id, start_time: iso(start),
      total_distance_km: dist, total_duration_min: Math.round((dist / veh.avg_speed_kmph) * 60), total_cost: Math.round(cost * 100) / 100,
      total_emissions_g: null, notes: "Demo data", created_at: iso(start),
      assignments: pkgs.map((p, k) => ({ vehicle_id: veh.id, package_id: p.id, sequence: k, eta: iso(start + (k + 1) * 3_000_000), distance_km: dist / pkgs.length, cost: null })),
    });
    pkgs.forEach((p, k) => {
      if (i === 0) return;
      events.push({ id: `demo-ev-${i}-${k}`, plan_id: `demo-plan-${i + 1}`, package_id: p.id, vehicle_id: veh.id, type: "delivered", message: "Demo data", occurred_at: iso(start + (k + 1) * 3_000_000 + ((i + k) % 3) * 900_000), latitude: null, longitude: null });
    });
  }
  const runs: OptRun[] = [];
  for (let i = 0; i < 6; i++) {
    runs.push({ id: `demo-c-${i}`, kind: "classical", status: "succeeded", created_at: iso(now - i * 2 * day), result: { runtime_ms: 180 + i * 35, status: "solved", total_distance_km: 30 + i } });
  }
  for (let i = 0; i < 3; i++) {
    runs.push({ id: `demo-q-${i}`, kind: "quantum", status: "succeeded", created_at: iso(now - (i + 1) * 3 * day), result: { runtime_ms: 4200 + i * 900, n_stops: 4 + i, cost: 21.4 + i * 3, classical_ortools_cost: 21.4 + i * 3, brute_force_cost: 21.4 + i * 3 - (i === 2 ? 1.2 : 0), gap_vs_brute_force_pct: i === 2 ? 5.6 : 0, matches_brute_force: i !== 2 } });
  }
  return { source: "demo", plans, vehicles, packages, events, runs, runsNote: "Demo data: run history is illustrative." };
}
