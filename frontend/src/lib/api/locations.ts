/**
 * Locations data layer. Real mode reads the paginated `{items,total,limit,offset}` endpoint (all pages);
 * demo mode uses the in-memory mock store. Create/update/delete reuse the shared `api.locations` CRUD.
 */
import { z } from "zod";
import { api, ApiError, USE_DEMO_DATA, type Location } from "@/lib/api";
import { fetchAllItems } from "@/lib/api/analytics";
import { locationSchema } from "@/lib/schemas";

export type LocationInput = Omit<Location, "id">;

export async function listLocations(): Promise<Location[]> {
  if (USE_DEMO_DATA) return api.locations.list();
  return fetchAllItems("/locations", locationSchema, { sort: "name", order: "asc" });
}

export const createLocation = (d: LocationInput) => api.locations.create(d);
export const updateLocation = (id: string, d: LocationInput) => api.locations.update(id, d);
export const deleteLocation = (id: string) => api.locations.remove(id);

/** Human-readable message, expanding FastAPI 422 detail arrays. */
export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.details;
    if (Array.isArray(d)) {
      const parts = d.map((x) => {
        const o = z.object({ msg: z.string(), loc: z.array(z.union([z.string(), z.number()])).optional() }).safeParse(x);
        return o.success ? `${o.data.loc?.filter((p) => p !== "body").join(".") ?? ""} ${o.data.msg}`.trim() : null;
      }).filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
    return e.userMessage;
  }
  return e instanceof Error ? e.message : "Unexpected error";
}
