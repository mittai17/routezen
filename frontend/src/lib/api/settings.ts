/** Workspace settings: flat JSON object (GET/PUT /settings). Demo mode keeps values in memory + localStorage (best effort). */
import { z } from "zod";
import { request, USE_DEMO_DATA } from "./client";
import { routingStatusSchema, healthSchema, locationSchema } from "@/lib/schemas";
import { fetchAllItems } from "./analytics";
import { demoLocations } from "./mock/data";

const weight = z.number().min(0).max(1);
export const scoringWeightsSchema = z.object({ cost: weight, time: weight, emissions: weight, utilisation: weight });
export const optimizationWeightsSchema = z.object({ distance: weight, time: weight, cost: weight, emissions: weight });

export interface WorkspaceSettings {
  workspace_name: string;
  default_depot_id: string;
  currency: "INR" | "USD" | "EUR";
  unit_system: "metric";
  petrol_price: number;
  diesel_price: number;
  cng_price: number;
  electricity_price: number;
  prefer_electric: boolean;
  scoring_weights: z.infer<typeof scoringWeightsSchema>;
  optimization_weights: z.infer<typeof optimizationWeightsSchema>;
  round_trip: boolean;
  classical_time_limit_s: number;
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  workspace_name: "Dev workspace",
  default_depot_id: "",
  currency: "INR",
  unit_system: "metric",
  petrol_price: 105,
  diesel_price: 92,
  cng_price: 80,
  electricity_price: 9,
  prefer_electric: false,
  scoring_weights: { cost: 0.5, time: 0.25, emissions: 0.15, utilisation: 0.1 },
  optimization_weights: { distance: 0.4, time: 0.3, cost: 0.2, emissions: 0.1 },
  round_trip: false,
  classical_time_limit_s: 5,
};

export const settingsFormSchema = z.object({
  workspace_name: z.string().trim().min(1, "Name is required").max(80, "Max 80 characters"),
  default_depot_id: z.string(),
  currency: z.enum(["INR", "USD", "EUR"]),
  petrol_price: z.number({ error: "Enter a number" }).min(0, "Must be 0 or more").max(100000),
  diesel_price: z.number({ error: "Enter a number" }).min(0, "Must be 0 or more").max(100000),
  cng_price: z.number({ error: "Enter a number" }).min(0, "Must be 0 or more").max(100000),
  electricity_price: z.number({ error: "Enter a number" }).min(0, "Must be 0 or more").max(100000),
  prefer_electric: z.boolean(),
  scoring_weights: scoringWeightsSchema,
  optimization_weights: optimizationWeightsSchema,
  round_trip: z.boolean(),
  classical_time_limit_s: z.number({ error: "Enter a number" }).int("Whole seconds").min(1, "At least 1 s").max(120, "At most 120 s"),
});

export const weightSum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);
/** Weights must total 1 (tolerance for float entry). */
export const weightsValid = (w: Record<string, number>) => Math.abs(weightSum(w) - 1) < 0.005;
export function normaliseWeights<T extends Record<string, number>>(w: T): T {
  const s = weightSum(w);
  if (s <= 0) return w;
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, Math.round((v / s) * 1000) / 1000])) as T;
}

/** Merge a (possibly partial / unknown-typed) flat server object over defaults, keeping only well-typed known keys. */
export function mergeSettings(raw: Record<string, unknown>): WorkspaceSettings {
  const out: WorkspaceSettings = { ...DEFAULT_SETTINGS, scoring_weights: { ...DEFAULT_SETTINGS.scoring_weights }, optimization_weights: { ...DEFAULT_SETTINGS.optimization_weights } };
  const o = out as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof WorkspaceSettings)[]) {
    const v = raw[key];
    if (v === undefined || v === null) continue;
    const def = DEFAULT_SETTINGS[key];
    if (key === "scoring_weights") { const p = scoringWeightsSchema.safeParse(v); if (p.success) out.scoring_weights = p.data; }
    else if (key === "optimization_weights") { const p = optimizationWeightsSchema.safeParse(v); if (p.success) out.optimization_weights = p.data; }
    else if (key === "currency") { if (v === "INR" || v === "USD" || v === "EUR") out.currency = v; }
    else if (key === "unit_system") continue;
    else if (typeof v === typeof def) o[key] = v;
  }
  return out;
}

const LS_KEY = "routezen.demo.settings";
let demoSettings: Record<string, unknown> | null = null;
function readDemo(): Record<string, unknown> {
  if (demoSettings) return demoSettings;
  try { const s = window.localStorage.getItem(LS_KEY); demoSettings = s ? (JSON.parse(s) as Record<string, unknown>) : {}; } catch { demoSettings = {}; }
  return demoSettings;
}

const flat = z.record(z.string(), z.unknown());

export async function getSettings(): Promise<WorkspaceSettings> {
  if (USE_DEMO_DATA) { await new Promise((r) => setTimeout(r, 150)); return mergeSettings(readDemo()); }
  return mergeSettings(await request("/settings", { schema: flat }));
}

export async function saveSettings(values: WorkspaceSettings): Promise<WorkspaceSettings> {
  const { unit_system: _unit, ...body } = values;
  void _unit;
  if (USE_DEMO_DATA) {
    await new Promise((r) => setTimeout(r, 150));
    demoSettings = { ...readDemo(), ...body };
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(demoSettings)); } catch { /* storage unavailable: kept in memory only */ }
    return mergeSettings(demoSettings);
  }
  return mergeSettings(await request("/settings", { method: "PUT", body, schema: flat }));
}

/* ------------------------------------------------------------------ status panels */
export const routingStatusFullSchema = routingStatusSchema.extend({ reachable: z.boolean().optional(), latency_ms: z.number().nullish(), error: z.string().nullish(), base_url: z.string().optional() });
export type RoutingStatusInfo = z.infer<typeof routingStatusFullSchema>;
export type ReadyInfo = z.infer<typeof healthSchema>;

export interface SystemStatus { demo: boolean; routing: RoutingStatusInfo | null; routingError: string | null; ready: ReadyInfo | null; readyError: string | null; checkedAt: number }

export async function getSystemStatus(): Promise<SystemStatus> {
  if (USE_DEMO_DATA) return { demo: true, routing: null, routingError: null, ready: null, readyError: null, checkedAt: Date.now() };
  const [r, h] = await Promise.allSettled([
    request("/routing/status", { schema: routingStatusFullSchema, timeoutMs: 20_000 }),
    request("/ready", { schema: healthSchema }),
  ]);
  const msg = (x: PromiseRejectedResult) => (x.reason instanceof Error ? x.reason.message : "Request failed");
  return {
    demo: false,
    routing: r.status === "fulfilled" ? r.value : null, routingError: r.status === "rejected" ? msg(r) : null,
    ready: h.status === "fulfilled" ? h.value : null, readyError: h.status === "rejected" ? msg(h) : null,
    checkedAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ depot options */
export async function getLocationOptions(): Promise<{ id: string; name: string; type: string }[]> {
  if (USE_DEMO_DATA) return demoLocations.map((l) => ({ id: l.id, name: l.name, type: l.type }));
  const rows = await fetchAllItems("/locations", locationSchema);
  return rows.map((l) => ({ id: l.id, name: l.name, type: l.type }));
}
