/**
 * Smart Travel API client (mobile).
 *
 * Mirrors the REAL backend contract in `backend/app/schemas/travel.py` and
 * `backend/app/api/v1/travel.py` exactly — no fabricated fields. Differences
 * from the web app's `frontend/src/lib/api/travel.ts` (which is a demo-data
 * reference, not a spec) are intentional:
 *  - No `emissions_kg` field exists on TravelRouteOptionOut. We compute a
 *    clearly-labelled client-side estimate (see `estimateEmissionsKg`) and
 *    never claim it came from the API.
 *  - Checkpoints have no `travel_mode` / `vehicle_profile_id` field (only the
 *    trip does) — MOBILE.md's field list for TravelCheckpointOut is wrong
 *    about this; the Pydantic schema is the source of truth.
 *  - There is no endpoint to persist which route option is "selected" — only
 *    the first option the backend returns is flagged `is_selected: true`
 *    server-side. Selecting a different option in the UI (see the
 *    `selectedId` state in routes.tsx) is local-only; it is NOT written back
 *    to the server, and build-itinerary / budget are computed from the
 *    trip's checkpoints, not from whichever route option the user picked.
 *  - `POST /trips/{id}/route-options` takes NO request body — there is no
 *    "optimization objective" parameter server-side. The backend always
 *    returns the same 3 alternatives (Recommended / Fastest / Scenic &
 *    Heritage). The planner's objective selector re-sorts/highlights those
 *    three client-side; it never fabricates new routes.
 */
import { z } from "zod";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, ApiError, API_BASE_URL } from "./client";

// ── Config ───────────────────────────────────────────────────────────────
// Uses the shared `apiRequest`/`ApiError` from ./client (Android emulator
// 10.0.2.2 fallback, request timeout, FastAPI `{detail}` error parsing) so
// network/error behaviour matches every other mobile API module. This file
// adds zod response validation on top, since the shared client intentionally
// stays schema-free.

export { ApiError, API_BASE_URL };

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; schema: z.ZodType<T>; query?: Record<string, string | undefined> },
): Promise<T> {
  const json = await apiRequest<unknown>(path, {
    method: (opts.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE") ?? "GET",
    body: opts.body,
    query: opts.query,
  });
  if (json === null || json === undefined) return undefined as T;
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(`Response shape mismatch for ${path}: ${parsed.error.message}`, { code: "schema" });
  }
  return parsed.data;
}

// ── Schemas (exact mirror of backend/app/schemas/travel.py) ────────────────

/** Real modes the backend meaningfully supports (verified against
 * app/services/travel_budget.py + app/db/travel_models.py default).
 * `travel_mode` is a free-text column with no DB/Pydantic enum constraint,
 * but only these three get distinct fuel-cost math; everything else
 * (including the task brief's bus/train/walking/cycling) silently falls
 * back to the car-petrol formula, which would misrepresent cost/time for a
 * non-driving mode. We only present modes the backend can actually cost
 * correctly — see the report for detail. */
export const TRAVEL_MODES = ["car", "motorcycle", "ev"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const tripSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  status: z.string(),
  origin_name: z.string(),
  origin_lat: z.number(),
  origin_lng: z.number(),
  destination_name: z.string(),
  destination_lat: z.number(),
  destination_lng: z.number(),
  departure_date: z.string().nullable(),
  return_date: z.string().nullable(),
  is_one_way: z.boolean(),
  adults: z.number(),
  children: z.number(),
  older_travellers: z.number(),
  travel_mode: z.string(),
  vehicle_profile_id: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TravelTrip = z.infer<typeof tripSchema>;

export const preferencesSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  pace: z.string(),
  budget_category: z.string(),
  total_budget_inr: z.number().nullable(),
  accommodation_types: z.array(z.string()),
  max_price_per_night: z.number().nullable(),
  food_preference: z.string(),
  interests: z.array(z.string()),
  max_drive_hours_per_day: z.number(),
  max_drive_km_per_day: z.number().nullable(),
  avoid_night_driving: z.boolean(),
  meal_budget_per_person: z.number().nullable(),
  contingency_pct: z.number(),
});
export type TravelPreferences = z.infer<typeof preferencesSchema>;

export const checkpointSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  sequence: z.number(),
  name: z.string(),
  address: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  type: z.string(),
  is_mandatory: z.boolean(),
  stay_overnight: z.boolean(),
  planned_arrival: z.string().nullable(),
  planned_departure: z.string().nullable(),
  activity_duration_min: z.number(),
  notes: z.string().nullable(),
  distance_from_prev_km: z.number().nullable(),
  duration_from_prev_min: z.number().nullable(),
});
export type TravelCheckpoint = z.infer<typeof checkpointSchema>;

export const routeOptionSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  label: z.string(),
  description: z.string(),
  total_distance_km: z.number(),
  total_duration_min: z.number(),
  estimated_days: z.number(),
  estimated_fuel_cost_inr: z.number().nullable(),
  estimated_total_cost_inr: z.number().nullable(),
  geometry: z.array(z.array(z.number()).length(2)),
  checkpoints: z.array(z.string()),
  is_selected: z.boolean(),
  data_source: z.string(),
  fallback_estimate: z.boolean(),
  note: z.string().nullable(),
});
export type RouteOption = z.infer<typeof routeOptionSchema>;

export const placeSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  checkpoint_id: z.string().nullable(),
  category: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  description: z.string().nullable(),
  rating: z.number().nullable(),
  review_count: z.number().nullable(),
  price_min: z.number().nullable(),
  price_max: z.number().nullable(),
  price_label: z.string().nullable(),
  amenities: z.array(z.string()),
  opening_hours: z.string().nullable(),
  website: z.string().nullable(),
  source: z.string(),
  is_selected: z.boolean(),
  distance_from_route_km: z.number().nullable(),
  detour_km: z.number().nullable(),
  estimated_visit_min: z.number().nullable(),
  entry_price_inr: z.number().nullable(),
  last_checked: z.string().nullable(),
});
export type TravelPlace = z.infer<typeof placeSchema>;

export const itineraryItemSchema = z.object({
  id: z.string(),
  sequence: z.number(),
  type: z.string(),
  label: z.string(),
  place_id: z.string().nullable(),
  checkpoint_id: z.string().nullable(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  duration_min: z.number(),
  cost_inr: z.number(),
  notes: z.string().nullable(),
});

export const itineraryDaySchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  day_number: z.number(),
  date: z.string().nullable(),
  start_checkpoint_id: z.string().nullable(),
  end_checkpoint_id: z.string().nullable(),
  drive_distance_km: z.number(),
  drive_duration_min: z.number(),
  estimated_cost_inr: z.number(),
  notes: z.string().nullable(),
  items: z.array(itineraryItemSchema),
});
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;

export const budgetSchema = z.object({
  trip_id: z.string(),
  target_budget_inr: z.number().nullable(),
  estimated_total_inr: z.number(),
  fuel_inr: z.number(),
  accommodation_inr: z.number(),
  meals_inr: z.number(),
  attractions_inr: z.number(),
  tolls_inr: z.number().nullable(),
  parking_inr: z.number(),
  other_inr: z.number(),
  contingency_inr: z.number(),
  unknown_items: z.array(z.string()),
  over_budget: z.boolean(),
  day_totals: z.array(z.record(z.string(), z.unknown())),
  assumptions: z.array(z.string()),
  data_source: z.string(),
});
export type TripBudget = z.infer<typeof budgetSchema>;

// ── Trips ───────────────────────────────────────────────────────────────

export function listTrips() {
  return request(`/travel/trips`, { schema: z.array(tripSchema) });
}

export function getTrip(id: string) {
  return request(`/travel/trips/${id}`, { schema: tripSchema });
}

export interface CreateTripInput {
  name: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  departure_date?: string | null;
  return_date?: string | null;
  is_one_way?: boolean;
  adults?: number;
  children?: number;
  older_travellers?: number;
  travel_mode?: string;
  notes?: string | null;
  preferences?: Partial<Omit<TravelPreferences, "id" | "trip_id">>;
  checkpoints?: CheckpointInput[];
}

export interface CheckpointInput {
  sequence: number;
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  type?: string;
  is_mandatory?: boolean;
  stay_overnight?: boolean;
  planned_arrival?: string | null;
  planned_departure?: string | null;
  activity_duration_min?: number;
  notes?: string | null;
}

export function createTrip(body: CreateTripInput) {
  return request(`/travel/trips`, { method: "POST", body, schema: tripSchema });
}

export function updateTrip(id: string, body: Partial<CreateTripInput>) {
  return request(`/travel/trips/${id}`, { method: "PATCH", body, schema: tripSchema });
}

export function deleteTrip(id: string) {
  return request<void>(`/travel/trips/${id}`, { method: "DELETE", schema: z.void() });
}

// ── Preferences ─────────────────────────────────────────────────────────

export function getTripPreferences(tripId: string) {
  return request(`/travel/trips/${tripId}/preferences`, { schema: preferencesSchema });
}

export function saveTripPreferences(tripId: string, body: Partial<TravelPreferences>) {
  return request(`/travel/trips/${tripId}/preferences`, { method: "POST", body, schema: preferencesSchema });
}

// ── Checkpoints ─────────────────────────────────────────────────────────

export function listCheckpoints(tripId: string) {
  return request(`/travel/trips/${tripId}/checkpoints`, { schema: z.array(checkpointSchema) });
}

export function addCheckpoint(tripId: string, body: CheckpointInput) {
  return request(`/travel/trips/${tripId}/checkpoints`, { method: "POST", body, schema: checkpointSchema });
}

export function updateCheckpoint(tripId: string, cid: string, body: Partial<TravelCheckpoint>) {
  return request(`/travel/trips/${tripId}/checkpoints/${cid}`, { method: "PATCH", body, schema: checkpointSchema });
}

export function deleteCheckpoint(tripId: string, cid: string) {
  return request<void>(`/travel/trips/${tripId}/checkpoints/${cid}`, { method: "DELETE", schema: z.void() });
}

/** Body is a bare JSON array of checkpoint ids in the new order — confirmed
 * against the live FastAPI OpenAPI schema, not assumed. */
export function reorderCheckpoints(tripId: string, checkpointIds: string[]) {
  return request(`/travel/trips/${tripId}/reorder-checkpoints`, {
    method: "POST",
    body: checkpointIds,
    schema: z.array(checkpointSchema),
  });
}

// ── Route options ───────────────────────────────────────────────────────

/** No request body — the backend always computes the same 3 alternatives
 * from the trip's stored origin/destination/checkpoints. */
export function generateRouteOptions(tripId: string) {
  return request(`/travel/trips/${tripId}/route-options`, { method: "POST", schema: z.array(routeOptionSchema) });
}

// ── Places ──────────────────────────────────────────────────────────────

export function listStays(tripId: string, checkpointId?: string) {
  return request(`/travel/trips/${tripId}/stays`, { query: { checkpoint_id: checkpointId }, schema: z.array(placeSchema) });
}

export function listRestaurants(tripId: string, checkpointId?: string) {
  return request(`/travel/trips/${tripId}/restaurants`, { query: { checkpoint_id: checkpointId }, schema: z.array(placeSchema) });
}

export function listAttractions(tripId: string, checkpointId?: string) {
  return request(`/travel/trips/${tripId}/attractions`, { query: { checkpoint_id: checkpointId }, schema: z.array(placeSchema) });
}

// ── Itinerary & budget ──────────────────────────────────────────────────

export function buildItinerary(tripId: string) {
  return request(`/travel/trips/${tripId}/build-itinerary`, { method: "POST", schema: z.array(itineraryDaySchema) });
}

export function getTripBudget(tripId: string) {
  return request(`/travel/trips/${tripId}/budget`, { schema: budgetSchema });
}

// ── Client-side emissions estimate (NOT a backend field — always labelled) ──

/** Grams CO2e per km, well-cited rough averages for an India-market petrol
 * vehicle. There is no emissions field anywhere in the backend schema; this
 * is a clearly-labelled assumption, shown with its factor every time it is
 * rendered, never presented as if it came from the API. */
const EMISSIONS_FACTOR_KG_PER_KM: Record<TravelMode, number> = {
  car: 0.14,
  motorcycle: 0.07,
  ev: 0.05, // grid-mix emissions, not "zero", since India's grid is coal-heavy
};

export function estimateEmissionsKg(distanceKm: number, mode: string): number {
  const factor = EMISSIONS_FACTOR_KG_PER_KM[mode as TravelMode] ?? EMISSIONS_FACTOR_KG_PER_KM.car;
  return Math.round(distanceKm * factor * 10) / 10;
}

export function emissionsAssumptionLabel(mode: string): string {
  const factor = EMISSIONS_FACTOR_KG_PER_KM[mode as TravelMode] ?? EMISSIONS_FACTOR_KG_PER_KM.car;
  return `Estimated, not from the API: ${factor} kg CO2e/km assumed for ${mode}`;
}

// ── Draft persistence (AsyncStorage) ───────────────────────────────────
// If trip creation fails (offline / backend down), keep the in-progress
// planner form so the traveller's input isn't lost.

const DRAFT_KEY = "routezen.travel.trip_draft.v1";

export async function saveTripDraft(draft: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), draft }));
  } catch {
    // best-effort; never block the UI on storage failures
  }
}

export async function loadTripDraft<T = unknown>(): Promise<{ savedAt: string; draft: T } | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearTripDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
