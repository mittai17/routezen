import type { z } from "zod";
import type {
  locationSchema, packageSchema, vehicleSchema, routeResultSchema, vehicleOptionSchema, recommendationSchema,
  optimizationRunSchema, summaryStatsSchema, healthSchema,
} from "@/lib/schemas";

export type Location = z.infer<typeof locationSchema>;
export type Package = z.infer<typeof packageSchema>;
export type VehicleProfile = z.infer<typeof vehicleSchema>;
export type RouteResult = z.infer<typeof routeResultSchema>;
export type VehicleOption = z.infer<typeof vehicleOptionSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type OptimizationRun = z.infer<typeof optimizationRunSchema>;
export type SummaryStats = z.infer<typeof summaryStatsSchema>;
export type Health = z.infer<typeof healthSchema>;

export type LatLng = { lat: number; lng: number };
export type Priority = "low" | "medium" | "high";

/** Stop as used by planning screens (one stop = one package group at a location). */
export interface PlanStop {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  zone_kind: "Residential" | "Commercial" | "Office";
  packages: number;
  weight_kg: number;
  priority: Priority;
  window_start: string;
  window_end: string;
  service_minutes: number;
  kind: "delivery" | "pickup";
}

export interface RecommendationRequest {
  stops: PlanStop[];
  depot: LatLng;
  preferences?: { prefer_electric?: boolean };
  vehicle_ids?: string[];
}
export interface OptimizationRequest {
  stops: PlanStop[];
  depot: { id: string; name: string; lat: number; lng: number };
  algorithm: string;
  objective: string;
  max_vehicles: number;
}
