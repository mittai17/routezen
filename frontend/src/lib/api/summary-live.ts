import { z } from "zod";
import { request } from "./client";
import { computeAnalytics, loadAnalyticsInput } from "./analytics";
import type { SummaryStats } from "./types";

const countsSchema = z.object({ packages: z.number(), vehicles: z.number() }).passthrough();

/**
 * Real-mode Overview summary: record counts from /analytics/summary plus totals computed from saved plans.
 * Anything without backing data is null (rendered as "—"), never a made-up zero.
 */
export async function liveSummary(): Promise<SummaryStats> {
  const [counts, input] = await Promise.all([request("/analytics/summary", { schema: countsSchema }), loadAnalyticsInput()]);
  const r = computeAnalytics(input, { from: null, to: null });
  const energyCost = r.vehicles.reduce((a, v) => a + v.energyCost, 0);
  return {
    total_distance_km: r.totals.distanceKm !== null ? Math.round(r.totals.distanceKm * 10) / 10 : null,
    total_duration_min: null,
    delivery_stops: counts.packages,
    vehicles_used: r.vehicles.filter((v) => v.assignments > 0).length,
    fleet_size: counts.vehicles,
    fuel_cost: r.hasPlans ? energyCost : null,
    co2_kg: r.totals.emissionsKg,
  };
}
