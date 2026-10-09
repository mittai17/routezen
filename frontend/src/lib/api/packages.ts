/**
 * Packages data access. The shared `api.packages` CRUD helper expects a bare array, but the real backend returns
 * `{items,total,limit,offset}`, so real-API calls live here. Demo mode delegates to the in-memory mock store.
 */
import { z } from "zod";
import { api, USE_DEMO_DATA, type Package } from "./index";
import { request } from "./client";
import { moneySchema, packageSchema } from "@/lib/schemas";

const PAGE_LIMIT = 500;
const MAX_ITEMS = 10_000;

const pageOf = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), total: z.number(), limit: z.number(), offset: z.number() });

async function listAll<T extends z.ZodType>(path: string, item: T, query: Record<string, string | number | boolean | undefined> = {}): Promise<z.infer<T>[]> {
  const out: z.infer<T>[] = [];
  for (let offset = 0; offset < MAX_ITEMS; offset += PAGE_LIMIT) {
    const page = await request(path, { query: { ...query, limit: PAGE_LIMIT, offset }, schema: pageOf(item) });
    out.push(...page.items);
    if (out.length >= page.total || page.items.length === 0) break;
  }
  return out;
}

export type PackageInput = Omit<Package, "id">;

export interface Assignment { vehicle_id: string; vehicle_name: string | null; cost: number | null; plan_name: string }

export interface PackagesData {
  packages: Package[];
  /** location id -> name */
  locations: Record<string, string>;
  /** package id -> most recent plan assignment (real API only; demo data has no plans) */
  assignments: Record<string, Assignment>;
  /** True when plan/vehicle lookups failed; table still renders without vehicle/cost. */
  lookupsFailed: boolean;
}

const nameRef = z.object({ id: z.string(), name: z.string() });
const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  assignments: z.array(z.object({ vehicle_id: z.string(), package_id: z.string(), cost: moneySchema.nullish() })).default([]),
});

export async function fetchPackagesData(): Promise<PackagesData> {
  if (USE_DEMO_DATA) {
    const [packages, locs] = await Promise.all([api.packages.list(), api.locations.list()]);
    return { packages, locations: Object.fromEntries(locs.map((l) => [l.id, l.name])), assignments: {}, lookupsFailed: false };
  }
  const packages = await listAll("/packages", packageSchema);
  let lookupsFailed = false;
  const [locs, vehicles, plans] = await Promise.all([
    listAll("/locations", nameRef).catch(() => { lookupsFailed = true; return []; }),
    listAll("/vehicles", nameRef).catch(() => { lookupsFailed = true; return []; }),
    listAll("/plans", planSchema).catch(() => { lookupsFailed = true; return []; }),
  ]);
  const vName = new Map(vehicles.map((v) => [v.id, v.name]));
  const assignments: Record<string, Assignment> = {};
  // Plans are returned newest first; the first assignment seen per package is the most recent.
  for (const plan of plans) {
    for (const a of plan.assignments) {
      if (assignments[a.package_id]) continue;
      assignments[a.package_id] = { vehicle_id: a.vehicle_id, vehicle_name: vName.get(a.vehicle_id) ?? null, cost: a.cost ?? null, plan_name: plan.name };
    }
  }
  return { packages, locations: Object.fromEntries(locs.map((l) => [l.id, l.name])), assignments, lookupsFailed };
}

/** Explicit allow-list: never send server-only or unknown fields (backend PUT replaces the whole record). */
export function toPayload(p: PackageInput): Record<string, unknown> {
  return {
    reference: p.reference.trim(),
    recipient: p.recipient || null,
    location_id: p.location_id || null,
    address: p.address || null,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    weight_kg: p.weight_kg,
    length_cm: p.length_cm ?? null,
    width_cm: p.width_cm ?? null,
    height_cm: p.height_cm ?? null,
    volume_m3: p.volume_m3 ?? null,
    priority: p.priority,
    handling: p.handling ?? [],
    window_start: p.window_start || null,
    window_end: p.window_end || null,
    deadline: p.deadline || null,
    service_minutes: p.service_minutes,
    kind: p.kind,
    status: p.status,
    notes: p.notes || null,
  };
}

export const packagesApi = {
  create: (data: PackageInput): Promise<Package> =>
    USE_DEMO_DATA ? api.packages.create(data) : request("/packages", { method: "POST", body: toPayload(data), schema: packageSchema }),
  update: (id: string, data: PackageInput): Promise<Package> =>
    USE_DEMO_DATA ? api.packages.update(id, data) : request(`/packages/${id}`, { method: "PUT", body: toPayload(data), schema: packageSchema }),
  remove: (id: string): Promise<void> =>
    USE_DEMO_DATA ? api.packages.remove(id) : request(`/packages/${id}`, { method: "DELETE", schema: z.unknown() }).then(() => undefined),
};

export interface BulkResult { ok: number; failed: { id: string; label: string; message: string }[] }

/** Run an operation over items with bounded concurrency, collecting failures instead of aborting. */
export async function runBulk<T>(items: T[], label: (t: T) => string, id: (t: T) => string, op: (t: T) => Promise<unknown>, concurrency = 4): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: [] };
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try { await op(item); result.ok++; }
      catch (e) { result.failed.push({ id: id(item), label: label(item), message: e instanceof Error ? ((e as { userMessage?: string }).userMessage ?? e.message) : "Failed" }); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return result;
}
