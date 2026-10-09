/**
 * Scenarios data layer: typed client for /scenarios (+ run, compare), a labelled in-memory demo store, and pure
 * metric derivation. Results are NEVER invented here: in real mode every number comes from a backend run; in demo
 * mode runs are computed by a clearly-labelled demo engine (straight-line fallback distances, assumed vehicle specs).
 * Missing values stay `null` ("not reported"), never 0.
 */
import { z } from "zod";
import { request, USE_DEMO_DATA } from "./client";
import { ApiError, isApiError } from "./errors";
import { fetchAllItems } from "./analytics";
import { locationSchema, vehicleSchema } from "@/lib/schemas";
import type { Location, VehicleProfile } from "./types";
import { demoLocations, demoVehicles } from "./mock/data";
import { haversineKm, nearestNeighbour, tourLength, twoOpt } from "./mock/geo";

/* ------------------------------------------------------------------ schemas / types */
export const scenarioKindSchema = z.enum(["recommendation", "classical", "quantum"]);
export type ScenarioKind = z.infer<typeof scenarioKindSchema>;

export const scenarioSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  kind: scenarioKindSchema,
  config: z.record(z.string(), z.unknown()).default({}),
  result: z.record(z.string(), z.unknown()).nullish(),
  last_run_at: z.string().nullish(),
});
export type Scenario = z.infer<typeof scenarioSchema>;

export interface ScenarioInput {
  name: string;
  description: string | null;
  kind: ScenarioKind;
  config: Record<string, unknown>;
}

export const compareResponseSchema = z.object({
  scenarios: z.array(z.object({
    id: z.string(), name: z.string(), kind: scenarioKindSchema, last_run_at: z.string().nullish(),
    result: z.record(z.string(), z.unknown()).nullish(), summary: z.record(z.string(), z.unknown()).nullish(),
  })),
  note: z.string().nullish(),
});
export type CompareResponse = z.infer<typeof compareResponseSchema>;
export type CompareEntry = CompareResponse["scenarios"][number];

/** UI-only metadata kept inside `config` (the backend preserves unknown config keys and ignores them when running). */
export const META_KEY = "_routezen";
export interface ScenarioMeta {
  archived?: boolean;
  template?: string | null;
  depot_label?: string;
  /** ISO time the *inputs* were last edited; compared with last_run_at to flag stale results. */
  inputs_edited_at?: string;
  assumptions?: string[];
}
export function readMeta(config: Record<string, unknown> | null | undefined): ScenarioMeta {
  const raw = config?.[META_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const m = raw as Record<string, unknown>;
  return {
    archived: m.archived === true,
    template: typeof m.template === "string" ? m.template : null,
    depot_label: typeof m.depot_label === "string" ? m.depot_label : undefined,
    inputs_edited_at: typeof m.inputs_edited_at === "string" ? m.inputs_edited_at : undefined,
    assumptions: Array.isArray(m.assumptions) ? m.assumptions.filter((a): a is string => typeof a === "string") : [],
  };
}
export const withMeta = (config: Record<string, unknown>, patch: Partial<ScenarioMeta>): Record<string, unknown> => ({
  ...config, [META_KEY]: { ...readMeta(config), ...patch },
});

/** True when inputs were edited after the stored result was produced, so the result no longer matches the inputs. */
export function isResultStale(s: Pick<Scenario, "config" | "last_run_at">): boolean {
  const edited = readMeta(s.config).inputs_edited_at;
  if (!edited || !s.last_run_at) return false;
  return Date.parse(edited) > Date.parse(s.last_run_at);
}

/* ------------------------------------------------------------------ errors */
/** Turns FastAPI 422 detail arrays into one readable line. */
export function describeError(e: unknown): string {
  if (isApiError(e)) {
    if (e.kind === "http" && Array.isArray(e.details)) {
      const parts = (e.details as { loc?: unknown[]; msg?: string }[]).slice(0, 4).map((d) => {
        const loc = (d.loc ?? []).filter((p) => p !== "body").join(".");
        return loc ? `${loc}: ${d.msg ?? "invalid"}` : (d.msg ?? "invalid");
      });
      if (parts.length) return parts.join("; ");
    }
    if (e.kind === "http" && e.details && typeof e.details === "object" && "message" in (e.details as object)) {
      return String((e.details as { message: unknown }).message);
    }
    return e.userMessage;
  }
  return e instanceof Error ? e.message : "Unexpected error";
}

/* ------------------------------------------------------------------ real + demo API */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
const rid = () => `demo-scn-${Math.random().toString(36).slice(2, 9)}`;
let demoStore: Scenario[] = [];

/** Test hook: reset the in-memory demo store. */
export function __resetDemoScenarios() { demoStore = []; }

export async function listScenarios(): Promise<Scenario[]> {
  if (USE_DEMO_DATA) { await sleep(150); return structuredClone(demoStore).sort((a, b) => b.created_at.localeCompare(a.created_at)); }
  return fetchAllItems("/scenarios", scenarioSchema, { sort: "created_at", order: "desc" });
}

export async function createScenario(input: ScenarioInput): Promise<Scenario> {
  if (USE_DEMO_DATA) {
    await sleep(120);
    const t = nowIso();
    const s: Scenario = { id: rid(), created_at: t, updated_at: t, ...input, result: null, last_run_at: null };
    demoStore = [s, ...demoStore];
    return structuredClone(s);
  }
  return request("/scenarios", { method: "POST", body: input, schema: scenarioSchema });
}

/** PUT replaces name/description/kind/config. Note: the backend keeps the old `result` (see isResultStale). */
export async function updateScenario(id: string, input: ScenarioInput): Promise<Scenario> {
  if (USE_DEMO_DATA) {
    await sleep(120);
    const i = demoStore.findIndex((s) => s.id === id);
    if (i < 0) throw new ApiError("http", "scenario not found", { status: 404 });
    demoStore[i] = { ...demoStore[i], ...input, updated_at: nowIso() };
    return structuredClone(demoStore[i]);
  }
  return request(`/scenarios/${encodeURIComponent(id)}`, { method: "PUT", body: input, schema: scenarioSchema });
}

export async function deleteScenario(id: string): Promise<void> {
  if (USE_DEMO_DATA) { await sleep(100); demoStore = demoStore.filter((s) => s.id !== id); return; }
  await request(`/scenarios/${encodeURIComponent(id)}`, { method: "DELETE", schema: z.unknown() });
}

export async function runScenario(id: string): Promise<Scenario> {
  if (USE_DEMO_DATA) {
    await sleep(350);
    const i = demoStore.findIndex((s) => s.id === id);
    if (i < 0) throw new ApiError("http", "scenario not found", { status: 404 });
    const s = demoStore[i];
    if (s.kind === "quantum") throw new ApiError("http", "quantum scenarios must be run through POST /optimization/quantum", { status: 422 });
    const result = s.kind === "recommendation" ? demoRecommendation(s.config) : demoClassical(s.config);
    demoStore[i] = { ...s, result, last_run_at: nowIso(), updated_at: nowIso() };
    return structuredClone(demoStore[i]);
  }
  return request(`/scenarios/${encodeURIComponent(id)}/run`, { method: "POST", schema: scenarioSchema, timeoutMs: 60_000 });
}

export async function compareScenarios(ids: string[]): Promise<CompareResponse> {
  if (USE_DEMO_DATA) {
    await sleep(150);
    const scenarios = ids.map((id) => {
      const s = demoStore.find((x) => x.id === id);
      if (!s) throw new ApiError("http", `scenario ${id} not found`, { status: 404 });
      return { id: s.id, name: s.name, kind: s.kind, last_run_at: s.last_run_at, result: s.result ?? null, summary: (s.result?.summary as Record<string, unknown> | undefined) ?? null };
    });
    return { scenarios, note: "Scenarios without a result have not been run yet." };
  }
  return request("/scenarios/compare", { method: "POST", body: { scenario_ids: ids }, schema: compareResponseSchema });
}

/** Locations + vehicles used to build scenario inputs. Real mode reads the paginated list endpoints. */
export async function loadFleet(): Promise<{ locations: Location[]; vehicles: VehicleProfile[] }> {
  if (USE_DEMO_DATA) { await sleep(120); return { locations: structuredClone(demoLocations), vehicles: structuredClone(demoVehicles) }; }
  const [locations, vehicles] = await Promise.all([
    fetchAllItems("/locations", locationSchema),
    fetchAllItems("/vehicles", vehicleSchema),
  ]);
  return { locations, vehicles };
}

/* ------------------------------------------------------------------ metric derivation (pure) */
export interface ScenarioMetrics {
  /** A stored result exists. When false every number below is null. */
  hasResult: boolean;
  kind: ScenarioKind;
  cost: number | null;
  distanceKm: number | null;
  timeMin: number | null;
  /** Energy by unit, or null when the run type does not report energy. */
  energy: { L: number; kWh: number } | null;
  emissionsG: number | null;
  items: number | null;
  served: number | null;
  unserved: number | null;
  /** Count of chosen vehicles that miss a package deadline; null if not reported. */
  deadlineMisses: number | null;
  status: string | null;
  /** True when any distance is a straight-line fallback estimate rather than road routing. */
  estimated: boolean;
  /** How `distanceKm`/`timeMin`/`cost` were aggregated, so unlike scenario types are never silently compared. */
  basis: "sum_of_single_package_trips" | "optimised_routes" | null;
}

const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return null;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function emptyMetrics(kind: ScenarioKind): ScenarioMetrics {
  return { hasResult: false, kind, cost: null, distanceKm: null, timeMin: null, energy: null, emissionsG: null, items: null, served: null, unserved: null, deadlineMisses: null, status: null, estimated: false, basis: null };
}

export function deriveMetrics(kind: ScenarioKind, result: Record<string, unknown> | null | undefined): ScenarioMetrics {
  if (!result) return emptyMetrics(kind);
  const base = { ...emptyMetrics(kind), hasResult: true };

  if (kind === "recommendation") {
    const recs = arr(result.recommendations).filter(isRec);
    if (!recs.length && !isRec(result.summary)) return emptyMetrics(kind);
    let cost = 0, dist = 0, time = 0, em = 0, served = 0, misses = 0, estimated = false;
    const energy = { L: 0, kWh: 0 };
    let costOk = true, timeOk = true, emOk = true, energyOk = true, distOk = true;
    for (const r of recs) {
      if (r.fallback_estimate === true || r.distance_source === "fallback_estimate") estimated = true;
      const rec = isRec(r.recommended) ? r.recommended : null;
      if (!rec) continue;
      served++;
      const c = num(rec.total_cost); if (c === null) costOk = false; else cost += c;
      const d = num(r.billed_distance_km) ?? num(r.distance_km); if (d === null) distOk = false; else dist += d;
      const t = num(rec.travel_minutes); if (t === null) timeOk = false; else time += t;
      const e = num(rec.emissions_g); if (e === null) emOk = false; else em += e;
      const en = num(rec.energy_used);
      if (en === null) energyOk = false; else if (rec.energy_unit === "kWh") energy.kWh += en; else energy.L += en;
      if (rec.deadline_feasible === false) misses++;
    }
    const any = served > 0;
    return {
      ...base, basis: "sum_of_single_package_trips", items: recs.length, served, unserved: recs.length - served,
      cost: any && costOk ? cost : null, distanceKm: any && distOk ? dist : null, timeMin: any && timeOk ? time : null,
      emissionsG: any && emOk ? em : null, energy: any && energyOk ? energy : null, deadlineMisses: misses, estimated,
      status: recs.length - served === 0 ? "all served" : served === 0 ? "none served" : "partially served",
    };
  }

  if (kind === "classical") {
    const opt = isRec(result.optimization) ? result.optimization : null;
    const sum = isRec(result.summary) ? result.summary : {};
    if (!opt && !isRec(result.summary)) return emptyMetrics(kind);
    const routes = arr(opt?.routes).filter(isRec);
    const served = routes.reduce((a, r) => a + arr(r.stops).length, 0);
    const unassigned = arr(opt?.unassigned).length;
    const unserved = opt ? unassigned : num(sum.unassigned);
    return {
      ...base, basis: "optimised_routes",
      cost: num(opt?.total_cost) ?? num(sum.total_cost), distanceKm: num(opt?.total_distance_km) ?? num(sum.total_distance_km),
      timeMin: num(opt?.total_duration_min), emissionsG: num(opt?.total_emissions_g), energy: null,
      served: opt ? served : null, unserved, items: opt && unserved !== null ? served + unserved : null, deadlineMisses: null,
      status: typeof opt?.status === "string" ? opt.status : typeof sum.status === "string" ? sum.status : null,
      estimated: opt?.fallback_estimate === true || opt?.distance_source === "fallback_estimate",
    };
  }
  return { ...base };
}

/** Feasible = everything served, no deadline misses reported and a clean solver status. null when it cannot be told. */
export function isFeasible(m: ScenarioMetrics): boolean | null {
  if (!m.hasResult || m.unserved === null) return null;
  if (m.status && ["infeasible", "error", "partial", "none served", "partially served", "empty"].includes(m.status)) return false;
  return m.unserved === 0 && (m.deadlineMisses ?? 0) === 0;
}

export type MetricKey = "cost" | "distanceKm" | "timeMin" | "energyL" | "energyKWh" | "emissionsG" | "unserved" | "deadlineMisses";
export interface Delta { abs: number; pct: number | null; /** negative = better for every metric here (all are "lower is better"). */ better: "better" | "worse" | "same" }

export function metricValue(m: ScenarioMetrics, key: MetricKey): number | null {
  switch (key) {
    case "energyL": return m.energy ? m.energy.L : null;
    case "energyKWh": return m.energy ? m.energy.kWh : null;
    default: return m[key];
  }
}

/** Whether deltas between two scenarios are meaningful (same run type, both with results). */
export function comparable(a: ScenarioMetrics, b: ScenarioMetrics): boolean {
  return a.hasResult && b.hasResult && a.kind === b.kind;
}

/** Delta of `m` relative to `baseline`; null if either side is missing or the two are not comparable. All metrics: lower is better. */
export function deltaVs(baseline: ScenarioMetrics, m: ScenarioMetrics, key: MetricKey): Delta | null {
  if (!comparable(baseline, m)) return null;
  const a = metricValue(baseline, key), b = metricValue(m, key);
  if (a === null || b === null) return null;
  const abs = b - a;
  const eps = Math.max(1e-9, Math.abs(a) * 1e-9);
  return { abs, pct: Math.abs(a) > eps ? (abs / Math.abs(a)) * 100 : null, better: Math.abs(abs) <= eps ? "same" : abs < 0 ? "better" : "worse" };
}

/* ------------------------------------------------------------------ demo engine (labelled demo data only) */
const DEMO_NOTE = "Demo data: computed in the browser from assumed vehicle specs. Distances are straight-line fallback estimates (no routing in demo mode), so real road distances will be longer.";

interface DemoPkg { package_id?: string; weight_kg: number; latitude: number; longitude: number; service_minutes?: number }
const getNum = (o: unknown, k: string, d: number) => (isRec(o) ? num(o[k]) ?? d : d);

function demoRecommendation(config: Record<string, unknown>): Record<string, unknown> {
  const depot = isRec(config.depot) ? config.depot : null;
  if (!depot || num(depot.latitude) === null || num(depot.longitude) === null) throw new ApiError("http", "depot or depot_location_id is required", { status: 422 });
  const pkgs = arr(config.packages).filter(isRec) as unknown as DemoPkg[];
  if (!pkgs.length) throw new ApiError("http", "at least one package is required", { status: 422 });
  const prefs = isRec(config.preferences) ? config.preferences : {};
  const w = isRec(prefs.weights) ? prefs.weights : {};
  const wt = { cost: getNum(w, "cost", 0.5), time: getNum(w, "time", 0.25), emissions: getNum(w, "emissions", 0.15), utilisation: getNum(w, "utilisation", 0.1) };
  const wsum = wt.cost + wt.time + wt.emissions + wt.utilisation || 1;
  const roundTrip = prefs.round_trip === true;
  const ids = Array.isArray(config.vehicle_ids) ? (config.vehicle_ids as string[]) : null;
  const fleet = demoVehicles.filter((v) => v.available && (!ids || ids.includes(v.id)));
  const dep = { lat: num(depot.latitude) as number, lng: num(depot.longitude) as number };

  const recs = pkgs.map((p, i) => {
    const dist = haversineKm(dep, { lat: p.latitude, lng: p.longitude });
    const billed = roundTrip ? dist * 2 : dist;
    const ineligible: { vehicle_id: string; name: string; reasons: string[] }[] = [];
    const opts = [] as Record<string, unknown>[];
    for (const v of fleet) {
      const reasons: string[] = [];
      if (p.weight_kg > v.payload_kg) reasons.push(`Package weight ${p.weight_kg} kg exceeds payload capacity ${v.payload_kg} kg`);
      if (v.range_km != null && dist * 2 > v.range_km) reasons.push(`Round trip ${(dist * 2).toFixed(1)} km exceeds range ${v.range_km} km`);
      if (reasons.length) { ineligible.push({ vehicle_id: v.id, name: v.name, reasons }); continue; }
      const energy = billed / v.efficiency_value;
      const energyCost = energy * Number(v.energy_price);
      const opCost = billed * Number(v.operating_cost_per_km);
      const variable = energyCost + opCost;
      const total = variable + Number(v.fixed_cost_per_delivery);
      opts.push({
        vehicle_id: v.id, name: v.name, category: v.category, verification: v.verification, energy_used: +energy.toFixed(4),
        energy_unit: v.efficiency_unit === "km_per_kwh" ? "kWh" : "L", energy_cost: energyCost.toFixed(2), operating_cost: opCost.toFixed(2),
        variable_cost: variable.toFixed(2), fixed_cost: Number(v.fixed_cost_per_delivery).toFixed(2), total_cost: total.toFixed(2),
        cost_per_km: billed > 0 ? (variable / billed).toFixed(2) : "0.00", travel_minutes: +((billed / v.avg_speed_kmph) * 60).toFixed(2),
        emissions_g: +(billed * v.emissions_g_per_km).toFixed(1), payload_utilisation: +Math.min(1, p.weight_kg / v.payload_kg).toFixed(3),
        volume_utilisation: 0, deadline_feasible: true, score: 0,
      });
    }
    const norm = (key: string, higherBetter = false) => {
      const vals = opts.map((o) => Number(o[key]));
      const lo = Math.min(...vals), hi = Math.max(...vals);
      return (o: Record<string, unknown>) => (hi === lo ? 1 : higherBetter ? (Number(o[key]) - lo) / (hi - lo) : (hi - Number(o[key])) / (hi - lo));
    };
    if (opts.length) {
      const nc = norm("total_cost"), nt = norm("travel_minutes"), ne = norm("emissions_g"), nu = norm("payload_utilisation", true);
      for (const o of opts) o.score = +(100 * ((wt.cost * nc(o) + wt.time * nt(o) + wt.emissions * ne(o) + wt.utilisation * nu(o)) / wsum)).toFixed(2);
      opts.sort((a, b) => Number(b.score) - Number(a.score));
    }
    const best = opts[0] ?? null;
    return {
      package_id: p.package_id ?? `package-${i + 1}`, recommended: best, alternatives: opts.slice(1, 5), ineligible,
      distance_km: +dist.toFixed(3), billed_distance_km: +billed.toFixed(3),
      duration_min: best ? Number(best.travel_minutes) : 0, distance_source: "fallback_estimate", fallback_estimate: true,
      explanation: best
        ? `${String(best.name)} scores highest under the stored weights for ${p.weight_kg} kg over about ${billed.toFixed(1)} km (straight-line estimate): total ₹${String(best.total_cost)}.`
        : "No available vehicle can carry this load over this distance.",
      assumptions: [DEMO_NOTE, "Vehicle specs are assumed, not verified.", "Score = weighted min-max normalisation of cost, travel time, emissions and payload utilisation across eligible vehicles."],
    };
  });
  const served = recs.filter((r) => r.recommended);
  return {
    summary: { packages: recs.length, total_cost: +served.reduce((a, r) => a + Number((r.recommended as Record<string, unknown>).total_cost), 0).toFixed(2), unserved: recs.length - served.length },
    recommendations: recs,
  };
}

function demoClassical(config: Record<string, unknown>): Record<string, unknown> {
  const depot = isRec(config.depot) ? config.depot : null;
  if (!depot || num(depot.latitude) === null || num(depot.longitude) === null) throw new ApiError("http", "depot or depot_location_id is required", { status: 422 });
  const stops = arr(config.stops).filter(isRec);
  if (!stops.length) throw new ApiError("http", "at least one stop is required", { status: 422 });
  const ids = Array.isArray(config.vehicle_ids) && config.vehicle_ids.length ? (config.vehicle_ids as string[]) : null;
  const fleet = demoVehicles.filter((v) => v.available && (!ids || ids.includes(v.id)));
  const dep = { lat: num(depot.latitude) as number, lng: num(depot.longitude) as number };
  const pts = stops.map((s) => ({ lat: num(s.latitude) as number, lng: num(s.longitude) as number }));
  const kg = stops.map((s) => num(s.weight_kg) ?? 0);
  const total = kg.reduce((a, b) => a + b, 0);
  const rt = config.return_to_depot !== false;
  const v = fleet.filter((x) => x.payload_kg >= total).sort((a, b) => Number(a.operating_cost_per_km) - Number(b.operating_cost_per_km))[0];
  if (!v) {
    const unassigned = stops.map((s) => ({ stop_id: String(s.id), reason: "No single demo vehicle can carry the combined load" }));
    const opt = { solver: "ortools_vrp", status: "infeasible", routes: [], unassigned, total_distance_km: 0, total_duration_min: 0, total_cost: 0, total_emissions_g: 0, objective: null, runtime_ms: 0, time_limit_s: 0, distance_source: "fallback_estimate", fallback_estimate: true, notes: [DEMO_NOTE] };
    return { summary: { total_distance_km: 0, total_cost: 0, unassigned: unassigned.length, status: "infeasible" }, optimization: opt };
  }
  const order = twoOpt(dep, pts, nearestNeighbour(dep, pts));
  const dist = tourLength(dep, order.map((i) => pts[i]), rt);
  const svc = stops.reduce((a, s) => a + (num(s.service_minutes) ?? 0), 0);
  const dur = (dist / v.avg_speed_kmph) * 60 + svc;
  const cost = dist * (Number(v.operating_cost_per_km) + Number(v.energy_price) / v.efficiency_value) + Number(v.fixed_cost_per_delivery) * stops.length;
  let cum = 0, prev = dep, load = 0, clock = 0;
  const visits = order.map((i) => {
    const leg = haversineKm(prev, pts[i]); cum += leg; prev = pts[i]; load += kg[i]; clock += (leg / v.avg_speed_kmph) * 60;
    const arrival = clock; clock += num(stops[i].service_minutes) ?? 0;
    return { stop_id: String(stops[i].id), arrival_min: +arrival.toFixed(2), departure_min: +clock.toFixed(2), cumulative_distance_km: +cum.toFixed(3), load_kg: load, load_m3: 0 };
  });
  const emissions = dist * v.emissions_g_per_km;
  const opt = {
    solver: "ortools_vrp", status: "solved",
    routes: [{ vehicle_id: v.id, stops: visits, distance_km: +dist.toFixed(3), duration_min: +dur.toFixed(2), load_kg: total, load_m3: 0, cost: +cost.toFixed(2), emissions_g: +emissions.toFixed(1) }],
    unassigned: [], total_distance_km: +dist.toFixed(3), total_duration_min: +dur.toFixed(2), total_cost: +cost.toFixed(2), total_emissions_g: +emissions.toFixed(1),
    objective: null, runtime_ms: 0, time_limit_s: 0, distance_source: "fallback_estimate", fallback_estimate: true,
    notes: [DEMO_NOTE, "Demo engine: nearest-neighbour + 2-opt on one vehicle. The real backend solves a capacitated VRP with OR-Tools."],
  };
  return { summary: { total_distance_km: opt.total_distance_km, total_cost: opt.total_cost, unassigned: 0, status: "solved" }, optimization: opt };
}
