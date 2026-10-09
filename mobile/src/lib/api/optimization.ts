/**
 * Typed client for POST /optimization/{classical,quantum,annealing,hybrid,reroute} and
 * GET /optimization/runs{,/:id}. Shapes mirror backend/app/schemas/optimization.py and
 * backend/app/api/v1/optimization.py exactly — field names are not guessed.
 *
 * classical/quantum/annealing/hybrid are async: POST returns 202 + a RunRecord with
 * status "queued"/"running"; poll GET /optimization/runs/{id} until a terminal status
 * (succeeded|failed|cancelled|timed_out). `pollRun` below implements that loop.
 *
 * Quantum (Qiskit Aer) is a classical SIMULATION of QAOA, capped server-side at
 * `settings.quantum_max_stops` stops (4 in this deployment — verified against the live
 * backend's /optimization/quantum 422 behavior). It is never run on-device; this module
 * only calls the backend.
 */
import { apiRequest, ApiError } from "./client";

/* ------------------------------------------------------------------ shared primitives */

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "timed_out";
export const isActiveRunStatus = (s: RunStatus) => s === "queued" || s === "running";

export interface OptDepot {
  latitude: number;
  longitude: number;
  name?: string;
}

export interface OptStop {
  id: string;
  latitude: number;
  longitude: number;
  weight_kg?: number;
  volume_m3?: number;
  service_minutes?: number;
  window_start_min?: number | null;
  window_end_min?: number | null;
}

export interface OptVehicle {
  vehicle_id: string;
  name?: string;
  payload_kg: number;
  volume_m3: number;
  available?: boolean;
  max_stops?: number;
  cost_per_km?: number;
  fixed_cost?: number;
  emissions_g_per_km?: number;
}

export interface OptWeights {
  distance?: number;
  time?: number;
  cost?: number;
  emissions?: number;
}

/* ------------------------------------------------------------------ classical */

export interface OptimizationRequest {
  depot?: OptDepot | null;
  depot_location_id?: string | null;
  stops?: OptStop[];
  package_ids?: string[];
  vehicles?: OptVehicle[];
  vehicle_ids?: string[];
  weights?: OptWeights;
  return_to_depot?: boolean;
  time_limit_s?: number | null;
  horizon_min?: number;
  allow_fallback_estimate?: boolean;
}

export interface StopVisit {
  stop_id: string;
  arrival_min: number;
  departure_min: number;
  cumulative_distance_km: number;
  load_kg: number;
  load_m3: number;
}

export interface VehicleRoute {
  vehicle_id: string;
  stops: StopVisit[];
  distance_km: number;
  duration_min: number;
  load_kg: number;
  load_m3: number;
  cost: number;
  emissions_g: number;
}

export interface Unassigned {
  stop_id: string;
  reason: string;
}

export interface OptimizationResult {
  solver: "ortools_vrp" | "hybrid_qaoa_ortools";
  status: "solved" | "partial" | "infeasible" | "empty" | "error";
  routes: VehicleRoute[];
  unassigned: Unassigned[];
  total_distance_km: number;
  total_duration_min: number;
  total_cost: number;
  total_emissions_g: number;
  objective: number | null;
  runtime_ms: number;
  time_limit_s: number;
  distance_source: string;
  fallback_estimate: boolean;
  notes: string[];
  hybrid?: unknown;
}

/* ------------------------------------------------------------------ quantum / annealing */

export interface QuantumRequest {
  depot?: OptDepot | null;
  depot_location_id?: string | null;
  /** Server caps this at settings.quantum_max_stops (4 here); schema max_length is 10. */
  stops?: OptStop[];
  package_ids?: string[];
  vehicle?: OptVehicle | null;
  vehicle_id?: string | null;
  objective?: "distance" | "duration";
  return_to_depot?: boolean;
  reps?: number; // 1-3
  max_iterations?: number; // 1-300
  restarts?: number; // 1-4
  shots?: number; // 16-8192
  seed?: number | null;
  timeout_s?: number | null;
  allow_fallback_estimate?: boolean;
}

export interface AnnealingRequest {
  depot?: OptDepot | null;
  depot_location_id?: string | null;
  stops?: OptStop[];
  package_ids?: string[];
  vehicle?: OptVehicle | null;
  vehicle_id?: string | null;
  objective?: "distance" | "duration";
  return_to_depot?: boolean;
  initial_temp?: number;
  final_temp?: number;
  cooling_rate?: number;
  steps?: number;
  seed?: number | null;
  timeout_s?: number | null;
  allow_fallback_estimate?: boolean;
}

/** QuantumResult is also the response shape for /optimization/annealing (`AnnealingResult = QuantumResult` server-side). */
export interface QuantumResult {
  solver: "qaoa_aer_simulation" | "simulated_annealing_qubo";
  simulation: boolean;
  disclaimer: string;
  status: "solved" | "no_feasible_sample" | "infeasible" | "error";
  n_stops: number;
  n_qubits: number;
  reps: number;
  iterations: number;
  order: string[];
  cost: number | null;
  feasible: boolean;
  feasibility_issues: string[];
  feasible_probability: number;
  shots: number;
  brute_force_order: string[];
  brute_force_cost: number | null;
  gap_vs_brute_force_pct: number | null;
  matches_brute_force: boolean | null;
  classical_ortools_cost: number | null;
  runtime_ms: number;
  objective: string;
  distance_source: string;
  fallback_estimate: boolean;
}

/* ------------------------------------------------------------------ run records */

export type RunKind = "classical" | "quantum" | "hybrid" | "annealing";

export interface RunRecord<TResult = OptimizationResult | QuantumResult> {
  id: string;
  kind: RunKind;
  status: RunStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  request: Record<string, unknown>;
  result: TResult | null;
  error: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/* ------------------------------------------------------------------ calls */

export async function startClassical(body: OptimizationRequest): Promise<RunRecord<OptimizationResult>> {
  return apiRequest<RunRecord<OptimizationResult>>("/optimization/classical", { method: "POST", body });
}

export async function startQuantum(body: QuantumRequest): Promise<RunRecord<QuantumResult>> {
  return apiRequest<RunRecord<QuantumResult>>("/optimization/quantum", { method: "POST", body });
}

export async function startAnnealing(body: AnnealingRequest): Promise<RunRecord<QuantumResult>> {
  return apiRequest<RunRecord<QuantumResult>>("/optimization/annealing", { method: "POST", body });
}

export async function getRun<TResult = OptimizationResult | QuantumResult>(id: string): Promise<RunRecord<TResult>> {
  return apiRequest<RunRecord<TResult>>(`/optimization/runs/${encodeURIComponent(id)}`);
}

export async function listRuns(params: { kind?: RunKind; status?: RunStatus; limit?: number; offset?: number } = {}): Promise<Page<RunRecord>> {
  return apiRequest<Page<RunRecord>>("/optimization/runs", { query: params });
}

export async function cancelRun(id: string): Promise<RunRecord> {
  return apiRequest<RunRecord>(`/optimization/runs/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

/** True when the backend's quantum stop limit was exceeded (HTTP 422, code "quantum_size_limit"). */
export function isQuantumSizeLimitError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 422 && err.code === "quantum_size_limit";
}

/**
 * Poll a run until it reaches a terminal status. Resolves with the final RunRecord, or
 * rejects with ApiError("timeout") if `maxWaitMs` elapses first (the run keeps going
 * server-side; the caller may poll again later or just re-fetch by id).
 */
export async function pollRun<TResult = OptimizationResult | QuantumResult>(
  id: string,
  opts: { intervalMs?: number; maxWaitMs?: number; onUpdate?: (rec: RunRecord<TResult>) => void; signal?: AbortSignal } = {},
): Promise<RunRecord<TResult>> {
  const { intervalMs = 1200, maxWaitMs = 120_000, onUpdate, signal } = opts;
  const start = Date.now();
  for (;;) {
    if (signal?.aborted) throw new ApiError("Polling cancelled", { code: "cancelled" });
    const rec = await getRun<TResult>(id);
    onUpdate?.(rec);
    if (!isActiveRunStatus(rec.status)) return rec;
    if (Date.now() - start > maxWaitMs) {
      throw new ApiError(`Run ${id} did not finish within ${Math.round(maxWaitMs / 1000)}s (still ${rec.status} server-side)`, { code: "poll_timeout" });
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/* ------------------------------------------------------------------ fixed sample instance (Chennai) */

/**
 * A small, fixed, clearly-labelled Chennai instance used by the Quantum Lab so the same
 * stop set can be run through classical/quantum/annealing for a fair side-by-side
 * comparison. Coordinates are real Chennai locations; weights/volumes are illustrative
 * demand figures, not measured. This mirrors frontend/src/lib/api/optimization.ts's
 * sample instance (same coordinates), kept independent per mobile's own ownership.
 */
export const LAB_DEPOT: OptDepot = { latitude: 13.0827, longitude: 80.2707, name: "Depot (Chennai Central)" };

export const LAB_STOPS: (OptStop & { label: string })[] = [
  { id: "lab-anna-nagar", label: "Anna Nagar", latitude: 13.085, longitude: 80.21, weight_kg: 8, volume_m3: 0.05, service_minutes: 5 },
  { id: "lab-t-nagar", label: "T. Nagar", latitude: 13.0418, longitude: 80.2341, weight_kg: 12, volume_m3: 0.05, service_minutes: 5 },
  { id: "lab-adyar", label: "Adyar", latitude: 13.0012, longitude: 80.2565, weight_kg: 5, volume_m3: 0.02, service_minutes: 5 },
  { id: "lab-velachery", label: "Velachery", latitude: 12.9815, longitude: 80.218, weight_kg: 14, volume_m3: 0.06, service_minutes: 5 },
];

export const LAB_VEHICLE: OptVehicle = {
  vehicle_id: "lab-scooter",
  name: "Lab scooter (assumed specs)",
  payload_kg: 40,
  volume_m3: 0.2,
  cost_per_km: 3,
  fixed_cost: 10,
  emissions_g_per_km: 45,
};

/** Server-enforced cap, confirmed live against GET /ready → quantum: "ok (simulation only)". */
export const QUANTUM_MAX_STOPS = 4;
