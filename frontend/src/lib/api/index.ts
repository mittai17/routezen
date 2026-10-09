import { z } from "zod";
import { request, USE_DEMO_DATA } from "./client";
import * as mock from "./mock";
import { liveSummary } from "./summary-live";
import { liveOptimize, liveRecommend } from "./plan-live";
import {
  healthSchema, locationSchema, packageSchema, routeResultSchema, vehicleSchema,
} from "@/lib/schemas";
import type {
  LatLng, Location, OptimizationRequest, OptimizationRun, Package, RecommendationRequest, VehicleProfile,
} from "./types";

export { ApiError, isApiError } from "./errors";
export { USE_DEMO_DATA, API_BASE_URL } from "./client";
export * from "./types";

interface DemoStore<T> {
  list(): Promise<T[]>;
  get(id: string): Promise<T>;
  create(d: Omit<T, "id">): Promise<T>;
  update(id: string, d: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
}

function crud<T extends { id: string }>(path: string, schema: z.ZodType<T>, store: DemoStore<T>) {
  return {
    // Backend lists return {items,total,limit,offset}; a bare array is also accepted.
    list: (): Promise<T[]> =>
      USE_DEMO_DATA
        ? store.list()
        : request(`${path}?limit=500`, {
            schema: z.union([z.array(schema), z.object({ items: z.array(schema) })]),
          }).then((r) => (Array.isArray(r) ? r : r.items)),
    get: (id: string): Promise<T> => (USE_DEMO_DATA ? store.get(id) : request(`${path}/${id}`, { schema })),
    create: (data: Omit<T, "id">): Promise<T> => (USE_DEMO_DATA ? store.create(data) : request(path, { method: "POST", body: data, schema })),
    update: (id: string, data: Partial<T>): Promise<T> => (USE_DEMO_DATA ? store.update(id, data) : request(`${path}/${id}`, { method: "PUT", body: data, schema })),
    remove: (id: string): Promise<void> => (USE_DEMO_DATA ? store.remove(id) : request(`${path}/${id}`, { method: "DELETE", schema: z.unknown() }).then(() => undefined)),
  };
}

export const api = {
  demo: USE_DEMO_DATA,
  health: () => (USE_DEMO_DATA ? mock.mockHealth() : request("/health", { schema: healthSchema })),
  ready: () => (USE_DEMO_DATA ? mock.mockHealth() : request("/ready", { schema: healthSchema })),
  locations: crud<Location>("/locations", locationSchema, mock.mockLocations),
  packages: crud<Package>("/packages", packageSchema, mock.mockPackages),
  vehicles: crud<VehicleProfile>("/vehicles", vehicleSchema, mock.mockVehicles),
  /** Road route. In demo mode there is no routing provider, so this rejects as "unavailable" (never a straight line). */
  route: async (coordinates: LatLng[]) => {
    if (USE_DEMO_DATA) {
      const { ApiError } = await import("./errors");
      throw new ApiError("unavailable", "Routing unavailable in demo mode.");
    }
    return request("/routing/route", { method: "POST", body: { coordinates }, schema: routeResultSchema, timeoutMs: 30_000 });
  },
  recommendations: (req: RecommendationRequest) => (USE_DEMO_DATA ? mock.mockRecommend(req) : liveRecommend(req)),
  optimize: async (req: OptimizationRequest): Promise<OptimizationRun> => {
    if (USE_DEMO_DATA) return mock.mockOptimize(req);
    return liveOptimize(req, await api.vehicles.list());
  },
  summary: () => (USE_DEMO_DATA ? mock.mockSummary() : liveSummary()),
  /** Sample stops for the planner's "Load demo stops" action. Demo mode only. */
  demoPlanStops: () => mock.mockPlanStops(),
};
