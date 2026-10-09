import { z } from "zod";
import { request, USE_DEMO_DATA } from "./client";
import { ApiError } from "./errors";

/**
 * Optimization runs API (classical OR-Tools VRP + quantum QAOA *simulation*).
 * Shapes mirror backend/app/schemas/optimization.py. Parsing is deliberately lenient on optional
 * fields so a slightly older/newer backend still renders, but strict on the fields we compute with.
 */

export const RUN_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled", "timed_out"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
export const isActiveStatus = (s: RunStatus) => s === "queued" || s === "running";

export const QUANTUM_MAX_STOPS = 4;

const num = z.number();
const optStop = z.object({
  id: z.string(), latitude: num, longitude: num,
  weight_kg: num.default(0), volume_m3: num.default(0), service_minutes: num.default(5),
  window_start_min: num.nullish(), window_end_min: num.nullish(),
});
const optVehicle = z.object({
  vehicle_id: z.string(), name: z.string().default(""), payload_kg: num, volume_m3: num,
  max_stops: num.optional(), cost_per_km: num.default(0), fixed_cost: num.default(0), emissions_g_per_km: num.default(0),
});
const depot = z.object({ latitude: num, longitude: num, name: z.string().default("Depot") });

export const runRequestSchema = z.object({
  depot: depot.nullish(),
  stops: z.array(optStop).default([]),
  vehicles: z.array(optVehicle).default([]),
  vehicle: optVehicle.nullish(),
  weights: z.object({ distance: num, time: num, cost: num, emissions: num }).partial().nullish(),
  return_to_depot: z.boolean().default(true),
  objective: z.string().nullish(),
  time_limit_s: num.nullish(),
  horizon_min: num.nullish(),
  reps: num.nullish(),
  shots: num.nullish(),
  seed: num.nullish(),
}).passthrough();
export type RunRequest = z.infer<typeof runRequestSchema>;

const stopVisit = z.object({ stop_id: z.string(), arrival_min: num, departure_min: num, cumulative_distance_km: num, load_kg: num, load_m3: num });
const vehicleRoute = z.object({
  vehicle_id: z.string(), stops: z.array(stopVisit), distance_km: num, duration_min: num,
  load_kg: num, load_m3: num, cost: num, emissions_g: num,
});
export const hybridMetadataSchema = z.object({
  simulation: z.boolean(), disclaimer: z.string(), objective: z.string(),
  baseline_distance_km: num, baseline_duration_min: num,
  baseline_objective: num.nullish(), candidate_objective: num.nullish(),
  selected: z.enum(["quantum_seeded", "classical_baseline"]),
  clusters_attempted: num, clusters_solved: num, quantum_runtime_ms: num,
  improvement_pct: num, clusters: z.array(z.object({ stop_ids: z.array(z.string()), status: z.string(), n_qubits: num.nullish(), cost: num.nullish(), brute_force_cost: num.nullish(), gap_vs_brute_force_pct: num.nullish(), order: z.array(z.string()).default([]) }).passthrough()),
});
export const classicalResultSchema = z.object({
  solver: z.string(),
  status: z.enum(["solved", "partial", "infeasible", "empty", "error"]),
  routes: z.array(vehicleRoute).default([]),
  unassigned: z.array(z.object({ stop_id: z.string(), reason: z.string() })).default([]),
  total_distance_km: num.default(0), total_duration_min: num.default(0), total_cost: num.default(0), total_emissions_g: num.default(0),
  objective: num.nullish(), runtime_ms: num.default(0), time_limit_s: num.default(0),
  distance_source: z.string().default("provided"), fallback_estimate: z.boolean().default(false),
  notes: z.array(z.string()).default([]),
  // Pydantic includes `hybrid: null` on ordinary classical results.
  hybrid: hybridMetadataSchema.nullish(),
});
export type ClassicalResult = z.infer<typeof classicalResultSchema>;

export const quantumResultSchema = z.object({
  solver: z.string(),
  simulation: z.boolean().default(true),
  disclaimer: z.string().default("Result from a classical statevector SIMULATION of QAOA (Qiskit Aer). No quantum hardware was used and no quantum advantage is claimed."),
  status: z.enum(["solved", "no_feasible_sample", "infeasible", "error"]),
  n_stops: num, n_qubits: num, reps: num, iterations: num.default(0),
  order: z.array(z.string()).default([]),
  cost: num.nullish(), feasible: z.boolean().default(false), feasibility_issues: z.array(z.string()).default([]),
  feasible_probability: num.default(0), shots: num.default(0),
  brute_force_order: z.array(z.string()).default([]), brute_force_cost: num.nullish(),
  gap_vs_brute_force_pct: num.nullish(), matches_brute_force: z.boolean().nullish(),
  classical_ortools_cost: num.nullish(), runtime_ms: num.default(0),
  objective: z.string().default("distance"), distance_source: z.string().default("provided"), fallback_estimate: z.boolean().default(false),
});
export type QuantumResult = z.infer<typeof quantumResultSchema>;

const runBase = {
  id: z.string(), status: z.enum(RUN_STATUSES),
  created_at: z.string(), started_at: z.string().nullish(), finished_at: z.string().nullish(),
  request: runRequestSchema.catch({ stops: [], vehicles: [], return_to_depot: true } as RunRequest),
  error: z.string().nullish(),
};
export const runRecordSchema = z.discriminatedUnion("kind", [
  z.object({ ...runBase, kind: z.enum(["classical", "hybrid"]), result: classicalResultSchema.nullish().catch(null) }),
  z.object({ ...runBase, kind: z.literal("quantum"), result: quantumResultSchema.nullish().catch(null) }),
]);
export type RunRecord = z.infer<typeof runRecordSchema>;
export type ClassicalRun = Extract<RunRecord, { kind: "classical" | "hybrid" }>;
export type QuantumRun = Extract<RunRecord, { kind: "quantum" }>;

const pageSchema = z.object({ items: z.array(runRecordSchema), total: num, limit: num, offset: num });

/* ------------------------------------------------------------------ real API */

const routeGeometrySchema = z.object({
  distance_km: num, duration_min: num, geometry: z.array(z.tuple([num, num])).default([]), provider: z.string().default("unknown"),
});
export type RoadRoute = z.infer<typeof routeGeometrySchema>;

const nameRowsSchema = z.object({ items: z.array(z.object({ id: z.string(), name: z.string().nullish(), reference: z.string().nullish(), recipient: z.string().nullish() }).passthrough()) });
const vehicleProfileLiteSchema = z.object({
  items: z.array(z.object({
    id: z.string(), name: z.string(), energy_type: z.string(), efficiency_value: num, efficiency_unit: z.string(),
    energy_price: z.union([z.string(), num]).nullish(), verification: z.string().nullish(), source: z.string().nullish(),
  }).passthrough()),
});
export type VehicleProfileLite = z.infer<typeof vehicleProfileLiteSchema>["items"][number];

/** A fixed, clearly labelled Chennai sample (coordinates are real; demand figures are illustrative). */
export const SAMPLE_STOP_NAMES: Record<string, string> = {
  "sample-anna-nagar": "Anna Nagar", "sample-t-nagar": "T. Nagar", "sample-adyar": "Adyar", "sample-velachery": "Velachery",
  "sample-porur": "Porur", "sample-guindy": "Guindy",
};
const SAMPLE_DEPOT = { latitude: 13.0827, longitude: 80.2757, name: "Depot (Chennai Central)" };
const SAMPLE_STOPS = [
  { id: "sample-anna-nagar", latitude: 13.085, longitude: 80.21, weight_kg: 8, volume_m3: 0.05, service_minutes: 5 },
  { id: "sample-t-nagar", latitude: 13.0418, longitude: 80.2341, weight_kg: 12, volume_m3: 0.05, service_minutes: 5 },
  { id: "sample-adyar", latitude: 13.0012, longitude: 80.2565, weight_kg: 5, volume_m3: 0.02, service_minutes: 5 },
  { id: "sample-velachery", latitude: 12.9815, longitude: 80.218, weight_kg: 14, volume_m3: 0.06, service_minutes: 5 },
  { id: "sample-porur", latitude: 13.0382, longitude: 80.1565, weight_kg: 9, volume_m3: 0.04, service_minutes: 5 },
  { id: "sample-guindy", latitude: 13.0067, longitude: 80.2206, weight_kg: 7, volume_m3: 0.03, service_minutes: 5 },
];
const SAMPLE_VEHICLE = { vehicle_id: "sample-scooter", name: "Sample scooter (assumed)", payload_kg: 40, volume_m3: 0.2, cost_per_km: 3, fixed_cost: 10, emissions_g_per_km: 45 };

export const sampleClassicalRequest = () => ({
  depot: SAMPLE_DEPOT, stops: SAMPLE_STOPS,
  vehicles: [SAMPLE_VEHICLE, { ...SAMPLE_VEHICLE, vehicle_id: "sample-scooter-2", name: "Sample scooter 2 (assumed)" }],
  time_limit_s: 5,
});
export const sampleQuantumRequest = () => ({
  depot: SAMPLE_DEPOT, stops: SAMPLE_STOPS.slice(0, QUANTUM_MAX_STOPS), objective: "distance" as const,
});

const longTimeout = 30_000;

/**
 * The backend's stored run.request does not currently include the depot, so the map cannot know where a
 * route starts. For runs started from this page we remember the depot locally (per-browser convenience only).
 */
const DEPOT_KEY = "rz-opt-depot:";
type Depot = { latitude: number; longitude: number; name: string };
function rememberDepot(id: string, depot: Depot) {
  try { localStorage.setItem(DEPOT_KEY + id, JSON.stringify(depot)); } catch { /* storage unavailable */ }
}
export function depotFor(run: RunRecord): Depot | null {
  if (run.request.depot) return run.request.depot;
  try {
    const raw = localStorage.getItem(DEPOT_KEY + run.id);
    const p = raw ? depot.safeParse(JSON.parse(raw)) : null;
    return p?.success ? p.data : null;
  } catch { return null; }
}

export const optimizationApi = {
  demo: USE_DEMO_DATA,

  async listRuns(limit = 50): Promise<RunRecord[]> {
    if (USE_DEMO_DATA) return demoRuns();
    const page = await request("/optimization/runs", { query: { limit }, schema: pageSchema, timeoutMs: longTimeout });
    return page.items;
  },

  async getRun(id: string): Promise<RunRecord> {
    if (USE_DEMO_DATA) {
      const r = demoRuns().find((x) => x.id === id);
      if (!r) throw new ApiError("http", "Run not found", { status: 404 });
      return r;
    }
    return request(`/optimization/runs/${encodeURIComponent(id)}`, { schema: runRecordSchema });
  },

  async start(kind: "classical" | "quantum" | "hybrid"): Promise<RunRecord> {
    if (USE_DEMO_DATA) throw new ApiError("unavailable", "Starting runs is disabled in demo mode. Set NEXT_PUBLIC_USE_DEMO_DATA=false to use the backend.");
    const body = kind !== "quantum" ? sampleClassicalRequest() : sampleQuantumRequest();
    const rec = await request(`/optimization/${kind}`, { method: "POST", schema: runRecordSchema, timeoutMs: longTimeout, body });
    rememberDepot(rec.id, body.depot);
    return rec;
  },

  async cancel(id: string): Promise<RunRecord> {
    if (USE_DEMO_DATA) throw new ApiError("unavailable", "Not available in demo mode.");
    return request(`/optimization/runs/${encodeURIComponent(id)}/cancel`, { method: "POST", schema: runRecordSchema });
  },

  /** Real road geometry. Demo mode and routing failures reject: the UI must then say "routing unavailable". */
  async roadRoute(coords: { lat: number; lng: number }[]): Promise<RoadRoute> {
    if (USE_DEMO_DATA) throw new ApiError("unavailable", "Routing unavailable in demo mode.");
    const r = await request("/routing/route", { method: "POST", body: { coordinates: coords }, schema: routeGeometrySchema, timeoutMs: 30_000 });
    if (r.geometry.length < 2) throw new ApiError("unavailable", "Routing provider returned no geometry.");
    return r;
  },

  /** Best-effort id -> display name for stops (locations + packages). Never throws. */
  async stopNames(): Promise<Record<string, string>> {
    const out: Record<string, string> = { ...SAMPLE_STOP_NAMES };
    if (USE_DEMO_DATA) return { ...out, ...DEMO_NAMES };
    for (const path of ["/locations", "/packages"]) {
      try {
        const page = await request(path, { query: { limit: 200 }, schema: nameRowsSchema });
        for (const r of page.items) {
          const label = r.name ?? (r.reference ? `${r.reference}${r.recipient ? ` - ${r.recipient}` : ""}` : null);
          if (label) out[r.id] = label;
        }
      } catch { /* names are cosmetic; fall back to ids */ }
    }
    return out;
  },

  /** Best-effort vehicle profiles keyed by id (used only to derive energy). Never throws. */
  async vehicleProfiles(): Promise<Record<string, VehicleProfileLite>> {
    if (USE_DEMO_DATA) return DEMO_VEHICLES;
    try {
      const page = await request("/vehicles", { query: { limit: 200 }, schema: vehicleProfileLiteSchema });
      return Object.fromEntries(page.items.map((v) => [v.id, v]));
    } catch { return {}; }
  },
};

/* ------------------------------------------------------------------ demo data (always labelled "Demo data" in the UI) */

const DEMO_NAMES: Record<string, string> = {
  d1: "Anna Nagar", d2: "Mogappair", d3: "T. Nagar", d4: "Adyar", d5: "Velachery", d6: "Porur", d7: "Thiruvanmiyur", d8: "Sholinganallur",
};
const DEMO_VEHICLES: Record<string, VehicleProfileLite> = {
  "demo-van": { id: "demo-van", name: "Demo van", energy_type: "diesel", efficiency_value: 14, efficiency_unit: "km_per_l", energy_price: "92", verification: "assumed", source: "Demo data - illustrative" },
  "demo-ev": { id: "demo-ev", name: "Demo e-scooter", energy_type: "electric", efficiency_value: 30, efficiency_unit: "km_per_kwh", energy_price: "9", verification: "assumed", source: "Demo data - illustrative" },
};
const dStop = (id: string, latitude: number, longitude: number, weight_kg: number, end?: number) => ({
  id, latitude, longitude, weight_kg, volume_m3: weight_kg / 200, service_minutes: 5, window_start_min: null, window_end_min: end ?? null,
});
const DEMO_STOPS = [
  dStop("d1", 13.085, 80.21, 18, 120), dStop("d2", 13.0827, 80.1755, 12), dStop("d3", 13.0418, 80.2341, 22, 45), dStop("d4", 13.0012, 80.2565, 9, 150),
  dStop("d5", 12.9815, 80.218, 16), dStop("d6", 13.0382, 80.1565, 14, 60), dStop("d7", 12.9826, 80.2594, 11), dStop("d8", 12.901, 80.2279, 400),
];
const visit = (stop_id: string, a: number, cum: number, kg: number) => ({ stop_id, arrival_min: a, departure_min: a + 5, cumulative_distance_km: cum, load_kg: kg, load_m3: kg / 200 });

function demoRuns(): RunRecord[] {
  const t = (m: number) => new Date(Date.UTC(2026, 9, 9, 10, 0) + m * 60_000).toISOString();
  const req = { depot: { latitude: 13.0827, longitude: 80.2757, name: "Depot (Chennai Central)" }, stops: DEMO_STOPS, return_to_depot: true,
    vehicles: [
      { vehicle_id: "demo-van", name: "Demo van", payload_kg: 60, volume_m3: 0.4, cost_per_km: 6.6, fixed_cost: 25, emissions_g_per_km: 140 },
      { vehicle_id: "demo-ev", name: "Demo e-scooter", payload_kg: 40, volume_m3: 0.2, cost_per_km: 0.9, fixed_cost: 12, emissions_g_per_km: 0 },
    ], weights: { distance: 0.4, time: 0.3, cost: 0.2, emissions: 0.1 }, time_limit_s: 5 };
  const classical = {
    id: "demo-classical-1", kind: "classical" as const, status: "succeeded" as const, created_at: t(0), started_at: t(0), finished_at: t(0.1), error: null, request: req,
    result: {
      solver: "ortools_vrp", status: "partial" as const,
      routes: [
        { vehicle_id: "demo-van", stops: [visit("d2", 14, 9.1, 12), visit("d1", 31, 15.4, 30), visit("d3", 52, 26.2, 52)], distance_km: 36.3, duration_min: 71, load_kg: 52, load_m3: 0.26, cost: 264.8, emissions_g: 5082 },
        { vehicle_id: "demo-ev", stops: [visit("d7", 19, 11.2, 11), visit("d4", 33, 15.9, 20), visit("d5", 47, 21.4, 36)], distance_km: 27.9, duration_min: 58, load_kg: 36, load_m3: 0.18, cost: 61.1, emissions_g: 0 },
      ],
      unassigned: [{ stop_id: "d6", reason: "Deadline (60 min) cannot be met by any vehicle" }, { stop_id: "d8", reason: "Could not be assigned within capacity, time-window, max-stops or time-limit constraints" }],
      total_distance_km: 64.2, total_duration_min: 129, total_cost: 325.9, total_emissions_g: 5082, objective: 18240, runtime_ms: 5010, time_limit_s: 5,
      distance_source: "demo-estimate", fallback_estimate: true, notes: ["Demo data: figures are illustrative, not solver output."],
    },
  };
  const qreq = { depot: req.depot, stops: DEMO_STOPS.slice(0, 4), return_to_depot: true, objective: "distance", reps: 1, shots: 1024, seed: 7, vehicles: [] };
  const quantum = {
    id: "demo-quantum-1", kind: "quantum" as const, status: "succeeded" as const, created_at: t(5), started_at: t(5), finished_at: t(5.2), error: null, request: qreq,
    result: {
      solver: "qaoa_aer_simulation", simulation: true, disclaimer: "Result from a classical statevector SIMULATION of QAOA (Qiskit Aer). No quantum hardware was used and no quantum advantage is claimed.",
      status: "solved" as const, n_stops: 4, n_qubits: 16, reps: 1, iterations: 60, order: ["d2", "d1", "d3", "d4"], cost: 41.8, feasible: true, feasibility_issues: [],
      feasible_probability: 0.0004, shots: 1024, brute_force_order: ["d1", "d2", "d3", "d4"], brute_force_cost: 38.9, gap_vs_brute_force_pct: 7.46, matches_brute_force: false,
      classical_ortools_cost: null, runtime_ms: 10400, objective: "distance", distance_source: "demo-estimate", fallback_estimate: true,
    },
  };
  return [quantum, classical].map((r) => runRecordSchema.parse(r));
}
