import { z } from "zod";
import { request, USE_DEMO_DATA } from "./client";
import { ApiError } from "./errors";
import * as mock from "./mock";
import { vehicleSchema } from "@/lib/schemas";
import type { VehicleProfile } from "./types";

/** Backend list envelope: {items,total,limit,offset}. */
const pageSchema = z.object({ items: z.array(vehicleSchema), total: z.number(), limit: z.number(), offset: z.number() });
const PAGE = 500; // backend max

export type VehicleInput = Omit<VehicleProfile, "id">;

/** Money is sent as 2-decimal strings (backend Numeric(12,2)); the backend PUT is a full replacement. */
function toPayload(v: VehicleInput) {
  const m = (n: number | string) => Number(n).toFixed(2);
  return { ...v, energy_price: m(v.energy_price), fixed_cost_per_delivery: m(v.fixed_cost_per_delivery), operating_cost_per_km: m(v.operating_cost_per_km) };
}

/** Field-level messages from a FastAPI 422 body ({detail:[{loc,msg}]}), keyed by field name. */
export function fieldErrorsFrom(e: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (e instanceof ApiError && Array.isArray(e.details)) {
    for (const d of e.details as { loc?: unknown[]; msg?: string }[]) {
      const f = Array.isArray(d.loc) ? d.loc.filter((x) => typeof x === "string" && x !== "body").pop() : undefined;
      if (typeof f === "string" && d.msg && !out[f]) out[f] = d.msg;
    }
  }
  return out;
}

/** User-facing message for failed writes; explains 409/422 rather than showing a generic error. */
export function describeWriteError(e: unknown): string {
  if (e instanceof ApiError && e.kind === "http") {
    const fe = Object.entries(fieldErrorsFrom(e));
    if (e.status === 422 && fe.length) return fe.map(([k, m]) => `${k}: ${m}`).join("; ");
    if (e.status === 409) return "This vehicle is referenced by plans or other records and cannot be deleted. Archive it instead.";
    if (e.status === 404) return "This vehicle no longer exists. Refresh the list.";
  }
  return e instanceof ApiError ? e.userMessage : "Unexpected error";
}

export const vehiclesApi = {
  demo: USE_DEMO_DATA,
  async list(): Promise<VehicleProfile[]> {
    if (USE_DEMO_DATA) return mock.mockVehicles.list();
    const all: VehicleProfile[] = [];
    for (let offset = 0; offset < 100_000; offset += PAGE) {
      const p = await request("/vehicles", { schema: pageSchema, query: { limit: PAGE, offset, sort: "name" } });
      all.push(...p.items);
      if (all.length >= p.total || p.items.length === 0) break;
    }
    return all;
  },
  create(v: VehicleInput): Promise<VehicleProfile> {
    return USE_DEMO_DATA ? mock.mockVehicles.create(v) : request("/vehicles", { method: "POST", body: toPayload(v), schema: vehicleSchema });
  },
  update(id: string, v: VehicleInput): Promise<VehicleProfile> {
    return USE_DEMO_DATA ? mock.mockVehicles.update(id, v) : request(`/vehicles/${id}`, { method: "PUT", body: toPayload(v), schema: vehicleSchema });
  },
  /** Archive = mark unavailable (the backend has no archive flag). Archived profiles are skipped by recommendations. */
  setAvailable(v: VehicleProfile, available: boolean): Promise<VehicleProfile> {
    const { id, ...rest } = v;
    return this.update(id, { ...rest, available });
  },
  async remove(id: string): Promise<void> {
    if (USE_DEMO_DATA) return mock.mockVehicles.remove(id);
    await request(`/vehicles/${id}`, { method: "DELETE", schema: z.unknown() });
  },
};
