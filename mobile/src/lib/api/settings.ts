/**
 * Settings data access — mirrors `backend/app/api/v1/resources.py` (`settings_router`).
 *
 * GET /settings -> returns Record<string, any> (merged defaults + workspace overrides)
 * PUT /settings -> accepts Record<string, any> (subset of known keys), returns updated settings.
 */
import { apiRequest, ApiError } from "./client";

export interface ScoringWeights {
  cost: number;
  time: number;
  emissions: number;
  utilisation: number;
}

export interface OptimizationWeights {
  distance: number;
  time: number;
  cost: number;
  emissions: number;
}

export interface Settings {
  currency: "INR" | "USD" | "EUR" | string;
  scoring_weights: ScoringWeights;
  optimization_weights: OptimizationWeights;
  round_trip: boolean;
  classical_time_limit_s: number;
  [key: string]: unknown;
}

export const DEFAULT_SETTINGS: Settings = {
  currency: "INR",
  scoring_weights: { cost: 0.5, time: 0.25, emissions: 0.15, utilisation: 0.1 },
  optimization_weights: { distance: 0.4, time: 0.3, cost: 0.2, emissions: 0.1 },
  round_trip: false,
  classical_time_limit_s: 5,
};

export async function getSettings(signal?: AbortSignal): Promise<Settings> {
  return apiRequest<Settings>("/settings", { signal });
}

export async function updateSettings(settings: Partial<Settings>): Promise<Settings> {
  return apiRequest<Settings>("/settings", {
    method: "PUT",
    body: settings,
  });
}

export { ApiError };
