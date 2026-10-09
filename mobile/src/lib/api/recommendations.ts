/**
 * Vehicle recommendation requests — field names mirror `backend/app/schemas/recommendation.py`
 * exactly. Do not add fields here that are not in that schema.
 *
 * The backend already enforces hard constraints: a vehicle that fails payload/volume capacity
 * or the delivery deadline is returned under `ineligible` (with reasons), never under
 * `recommended`/`alternatives`. Screens must preserve that separation and must never merge
 * ineligible vehicles into the recommended list.
 */
import { apiRequest } from "./client";

export interface RecommendationWeights {
  cost: number;
  time: number;
  emissions: number;
  utilisation: number;
}

export interface RecommendationPreferences {
  weights?: RecommendationWeights;
  departure_time?: string | null;
  round_trip?: boolean;
  require_deadline?: boolean;
  allow_fallback_estimate?: boolean;
  top_n?: number;
}

export interface RecommendationPackageInput {
  package_id?: string | null;
  weight_kg: number;
  volume_m3?: number;
  latitude: number;
  longitude: number;
  deadline?: string | null;
  service_minutes?: number;
}

export interface RecommendationDepotInput {
  latitude: number;
  longitude: number;
}

export interface RecommendationRequestBody {
  package?: RecommendationPackageInput;
  packages?: RecommendationPackageInput[];
  package_ids?: string[];
  depot?: RecommendationDepotInput;
  depot_location_id?: string;
  preferences?: RecommendationPreferences;
  vehicle_ids?: string[];
}

export interface VehicleOption {
  vehicle_id: string;
  name: string;
  category: string;
  verification: string;
  energy_used: number;
  energy_unit: "L" | "kWh";
  /** Decimal(12,2) fields — serialised as strings by the API. */
  energy_cost: string;
  operating_cost: string;
  variable_cost: string;
  fixed_cost: string;
  total_cost: string;
  cost_per_km: string;
  travel_minutes: number;
  eta: string | null;
  deadline_slack_min: number | null;
  emissions_g: number;
  payload_utilisation: number;
  volume_utilisation: number;
  deadline_feasible: boolean;
  score: number;
}

export interface IneligibleVehicle {
  vehicle_id: string;
  name: string;
  reasons: string[];
}

export interface PackageRecommendation {
  package_id: string | null;
  recommended: VehicleOption | null;
  alternatives: VehicleOption[];
  ineligible: IneligibleVehicle[];
  distance_km: number;
  billed_distance_km: number;
  duration_min: number;
  distance_source: "osrm" | "fallback_estimate" | "provided";
  fallback_estimate: boolean;
  explanation: string;
  assumptions: string[];
}

export async function postRecommendations(body: RecommendationRequestBody, signal?: AbortSignal): Promise<PackageRecommendation[]> {
  return apiRequest<PackageRecommendation[]>("/recommendations", { method: "POST", body, signal });
}

/** Convenience: recommend vehicles for one existing package by id, against a given depot. */
export async function recommendForPackage(
  packageId: string,
  depot: RecommendationDepotInput | { depot_location_id: string },
  opts: { topN?: number; allowFallbackEstimate?: boolean; signal?: AbortSignal } = {},
): Promise<PackageRecommendation | null> {
  const body: RecommendationRequestBody = {
    package_ids: [packageId],
    preferences: { top_n: opts.topN ?? 5, allow_fallback_estimate: opts.allowFallbackEstimate ?? false },
    ...("depot_location_id" in depot ? { depot_location_id: depot.depot_location_id } : { depot }),
  };
  const results = await postRecommendations(body, opts.signal);
  return results[0] ?? null;
}
