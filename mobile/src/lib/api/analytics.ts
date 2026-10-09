/**
 * Typed client for GET /analytics/* (backend/app/api/v1/analytics.py). Field names mirror
 * the live handlers exactly — nothing here is invented.
 *
 * IMPORTANT — these endpoints are leaner than a typical "trips/deliveries/distance/
 * utilization/emissions-saved" dashboard might assume. Concretely, the backend does NOT
 * provide, anywhere under /analytics/*:
 *   - a "trips completed" count (there is no trips concept in this router at all — that
 *     word belongs to the separate Smart Travel domain under /travel/*, a different
 *     feature owned by a different agent; this screen is about delivery *plans*)
 *   - total distance (not aggregated anywhere in /analytics/*; /analytics/cost's
 *     `by_plan` entries carry only id/name/total_cost/status, no distance)
 *   - a vehicle utilization percentage (payload/volume capacity vs. load is not computed
 *     here; /analytics/vehicles only returns an `assigned_packages` count per vehicle)
 *   - energy consumption in physical units (liters/kWh) — only a count of vehicles per
 *     energy_type, and total emissions in grams
 *   - emissions saved vs. a baseline — no baseline figure exists anywhere in this API
 *   - date-range query parameters, or per-record dates in /analytics/cost's `by_plan` —
 *     so no server-side date filtering is possible against these endpoints
 * The mobile Analytics screen therefore surfaces exactly what's real and omits the rest
 * (with an explicit note), per docs/MOBILE.md: "do not fabricate it client-side and do
 * not silently fake a successful response."
 */
import { apiRequest } from "./client";

export interface AnalyticsSummary {
  locations: number;
  packages: number;
  vehicles: number;
  plans: number;
  events: number;
  packages_by_status: Record<string, number>;
  plans_by_status: Record<string, number>;
}

export interface AnalyticsCostPlan {
  plan_id: string;
  name: string;
  total_cost: string;
  status: string;
}

export interface AnalyticsCost {
  plans_with_cost: number;
  total_cost: string;
  cost_per_delivery: string | null;
  by_plan: AnalyticsCostPlan[];
}

export interface AnalyticsEnergy {
  vehicles_by_energy_type: Record<string, number>;
  total_planned_emissions_g: number;
  note: string;
}

export interface AnalyticsVehicle {
  vehicle_id: string;
  name: string;
  energy_type: string;
  available: boolean;
  verification: string;
  assigned_packages: number;
}

export interface AnalyticsOptimizationByKindStatus {
  kind: string;
  status: string;
  count: number;
}

export interface AnalyticsOptimization {
  total_runs: number;
  by_kind_status: AnalyticsOptimizationByKindStatus[];
  avg_runtime_ms: number | null;
  note: string;
}

export const getAnalyticsSummary = () => apiRequest<AnalyticsSummary>("/analytics/summary");
export const getAnalyticsCost = () => apiRequest<AnalyticsCost>("/analytics/cost");
export const getAnalyticsEnergy = () => apiRequest<AnalyticsEnergy>("/analytics/energy");
export const getAnalyticsVehicles = () => apiRequest<AnalyticsVehicle[]>("/analytics/vehicles");
export const getAnalyticsOptimization = () => apiRequest<AnalyticsOptimization>("/analytics/optimization");

/** Everything the Analytics screen needs, fetched together. */
export interface AnalyticsBundle {
  summary: AnalyticsSummary;
  cost: AnalyticsCost;
  energy: AnalyticsEnergy;
  vehicles: AnalyticsVehicle[];
  optimization: AnalyticsOptimization;
}

export async function getAnalyticsBundle(): Promise<AnalyticsBundle> {
  const [summary, cost, energy, vehicles, optimization] = await Promise.all([
    getAnalyticsSummary(),
    getAnalyticsCost(),
    getAnalyticsEnergy(),
    getAnalyticsVehicles(),
    getAnalyticsOptimization(),
  ]);
  return { summary, cost, energy, vehicles, optimization };
}
