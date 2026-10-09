/**
 * Packages data access — field names mirror `backend/app/schemas/resources.py`
 * (`PackageIn`/`PackageOut`) and `docs/ARCHITECTURE.md` exactly. Do not add
 * fields here that are not in that schema.
 *
 * The backend models a package as ONE location (`address`/`latitude`/`longitude`,
 * optionally resolved from `location_id`) plus a `kind` of `"delivery" | "pickup"`.
 * There is no separate pickup *and* delivery coordinate pair on a package — the
 * mobile spec's "pickup/delivery location" maps to this single location, labelled
 * by `kind`. Screens must not invent a second coordinate.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, ApiError } from "./client";

export type PackagePriority = "low" | "medium" | "high";
export type PackageKind = "delivery" | "pickup";
export type PackageStatus = "pending" | "assigned" | "in_transit" | "delivered" | "failed" | "cancelled";

export interface Package {
  id: string;
  created_at: string;
  updated_at: string;
  reference: string;
  recipient: string | null;
  location_id: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  weight_kg: number;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  volume_m3: number | null;
  priority: PackagePriority;
  handling: string[];
  window_start: string | null;
  window_end: string | null;
  deadline: string | null;
  service_minutes: number;
  kind: PackageKind;
  status: PackageStatus;
  notes: string | null;
}

export type PackageInput = Omit<Package, "id" | "created_at" | "updated_at">;

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListPackagesParams {
  q?: string;
  status?: PackageStatus;
  priority?: PackagePriority;
  kind?: PackageKind;
  location_id?: string;
  sort?: string;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export const STATUS_LABELS: Record<PackageStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_transit: "In transit",
  delivered: "Delivered",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const PRIORITY_LABELS: Record<PackagePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const HANDLING_PRESETS = ["fragile", "perishable", "hazardous", "this_side_up", "keep_dry", "handle_with_care"];

export async function listPackages(params: ListPackagesParams = {}): Promise<Page<Package>> {
  const { signal, ...query } = params;
  return apiRequest<Page<Package>>("/packages", { query: { limit: 50, offset: 0, sort: "created_at", order: "desc", ...query }, signal });
}

export async function getPackage(id: string, signal?: AbortSignal): Promise<Package> {
  return apiRequest<Package>(`/packages/${encodeURIComponent(id)}`, { signal });
}

/** Explicit allow-list so we never send unknown/server-only fields; PUT replaces the whole record. */
export function toPackagePayload(p: PackageInput): Record<string, unknown> {
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

export async function createPackage(input: PackageInput): Promise<Package> {
  return apiRequest<Package>("/packages", { method: "POST", body: toPackagePayload(input) });
}

export async function updatePackage(id: string, input: PackageInput): Promise<Package> {
  return apiRequest<Package>(`/packages/${encodeURIComponent(id)}`, { method: "PUT", body: toPackagePayload(input) });
}

export async function deletePackage(id: string): Promise<void> {
  await apiRequest<unknown>(`/packages/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** l*w*h in cm -> m^3, matching the backend's own PackageIn volume auto-fill. */
export function computeVolumeM3(lengthCm: number, widthCm: number, heightCm: number): number {
  return Math.round(((lengthCm * widthCm * heightCm) / 1_000_000) * 1_000_000) / 1_000_000;
}

const ACTIVE_STATUSES: PackageStatus[] = ["pending", "assigned", "in_transit"];

/** A package is "delayed" when it's still active and its deadline has passed. Derived client-side from real fields — not a backend field. */
export function isDelayed(p: Pick<Package, "status" | "deadline">): boolean {
  if (!p.deadline || !ACTIVE_STATUSES.includes(p.status)) return false;
  return new Date(p.deadline).getTime() < Date.now();
}

// ---- Cross-resource lookups (plans/events have no dedicated owner in docs/MOBILE.md's
// file-ownership table; package detail needs them, so they're read-only helpers here,
// mirroring the pattern frontend/src/lib/api/packages.ts uses for the same problem.)

export interface PackageAssignment {
  vehicle_id: string;
  vehicle_name: string | null;
  cost: string | null;
  plan_name: string;
  plan_id: string;
}

interface PlanRow {
  id: string;
  name: string;
  status: string;
  assignments: { vehicle_id: string; package_id: string; cost: string | null }[];
}

/** Most recent plan assignment for a package, if any. Read-only; never mutates plans. */
export async function fetchAssignmentForPackage(packageId: string): Promise<PackageAssignment | null> {
  try {
    const [plansPage, vehiclesPage] = await Promise.all([
      apiRequest<Page<PlanRow>>("/plans", { query: { limit: 100, offset: 0 } }),
      apiRequest<Page<{ id: string; name: string }>>("/vehicles", { query: { limit: 200, offset: 0 } }),
    ]);
    const vehicleName = new Map(vehiclesPage.items.map((v) => [v.id, v.name]));
    for (const plan of plansPage.items) {
      const match = plan.assignments.find((a) => a.package_id === packageId);
      if (match) {
        return {
          vehicle_id: match.vehicle_id,
          vehicle_name: vehicleName.get(match.vehicle_id) ?? null,
          cost: match.cost,
          plan_name: plan.name,
          plan_id: plan.id,
        };
      }
    }
    return null;
  } catch {
    // Non-fatal: package detail still renders without the assignment panel.
    return null;
  }
}

export interface PackageEvent {
  id: string;
  type: string;
  message: string | null;
  occurred_at: string;
  latitude: number | null;
  longitude: number | null;
}

/** Real delivery events for the status timeline, oldest first. Empty array (not an error) when none were ever recorded. */
export async function fetchPackageEvents(packageId: string): Promise<PackageEvent[]> {
  try {
    const page = await apiRequest<Page<PackageEvent>>("/events", {
      query: { package_id: packageId, sort: "occurred_at", order: "asc", limit: 50 },
    });
    return page.items;
  } catch {
    return [];
  }
}

export { ApiError };

// ---- Offline-safe draft persistence (AsyncStorage) for unfinished package forms.
// Keyed by "new" for the create form, or the package id for an edit in progress.

const DRAFT_PREFIX = "routezen:package-draft:";

/** `data` is the screen's own raw form-values shape (strings as typed by the user), not `PackageInput` —
 *  storing the raw form lets "Restore draft" put the user back exactly where they left off, including
 *  invalid-but-in-progress values, without a lossy round-trip through parsed numbers/dates. */
export async function savePackageDraft(key: string, data: Record<string, unknown>): Promise<void> {
  try {
    await AsyncStorage.setItem(`${DRAFT_PREFIX}${key}`, JSON.stringify({ savedAt: new Date().toISOString(), data }));
  } catch {
    // Best-effort only; losing a draft save must never block the UI.
  }
}

export async function loadPackageDraft(key: string): Promise<{ savedAt: string; data: Record<string, unknown> } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${DRAFT_PREFIX}${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearPackageDraft(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${DRAFT_PREFIX}${key}`);
  } catch {
    // Ignore.
  }
}
