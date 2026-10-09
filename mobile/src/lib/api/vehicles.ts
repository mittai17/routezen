/**
 * Vehicle profiles data access — field names mirror `backend/app/schemas/resources.py`
 * (`VehicleIn`/`VehicleOut`) exactly. Do not add fields here that are not in that schema.
 */
import { apiRequest } from "./client";
import type { Page } from "./packages";

export type EnergyType = "petrol" | "diesel" | "cng" | "electric";
export type EfficiencyUnit = "km_per_l" | "km_per_kwh";
export type VehicleVerification = "measured" | "external" | "user" | "assumed";

export interface VehicleProfile {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  category: string;
  payload_kg: number;
  volume_m3: number;
  energy_type: EnergyType;
  efficiency_value: number;
  efficiency_unit: EfficiencyUnit;
  /** Decimal(12,2) — the API serialises these as strings, e.g. "100.00". */
  energy_price: string;
  fixed_cost_per_delivery: string;
  operating_cost_per_km: string;
  avg_speed_kmph: number;
  emissions_g_per_km: number;
  range_km: number | null;
  available: boolean;
  source: string;
  verification: VehicleVerification;
}

export type VehicleInput = Omit<VehicleProfile, "id" | "created_at" | "updated_at">;

export interface ListVehiclesParams {
  q?: string;
  energy_type?: EnergyType;
  category?: string;
  available?: boolean;
  verification?: VehicleVerification;
  sort?: string;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export async function listVehicles(params: ListVehiclesParams = {}): Promise<Page<VehicleProfile>> {
  const { signal, ...query } = params;
  return apiRequest<Page<VehicleProfile>>("/vehicles", { query: { limit: 100, offset: 0, sort: "name", order: "asc", ...query }, signal });
}

export async function getVehicle(id: string, signal?: AbortSignal): Promise<VehicleProfile> {
  return apiRequest<VehicleProfile>(`/vehicles/${encodeURIComponent(id)}`, { signal });
}

/**
 * Display-category grouping for the "Vehicle Recommendations" categories the product spec
 * lists (motorcycle, electric two-wheeler, auto-rickshaw/three-wheeler, cargo electric
 * three-wheeler, car, van, mini truck, truck). The backend's `category` column is a free-text
 * field (observed values: two_wheeler, three_wheeler, light_commercial, van) — this is a UI-only
 * heuristic derived from real `category` + `energy_type` + `payload_kg`, never a fabricated field.
 * The raw `category`/`energy_type` are always shown alongside it for transparency.
 */
export type DisplayCategoryKey =
  | "motorcycle"
  | "electric_two_wheeler"
  | "auto_rickshaw"
  | "cargo_electric_three_wheeler"
  | "car"
  | "van"
  | "mini_truck"
  | "truck"
  | "other";

export const DISPLAY_CATEGORY_LABELS: Record<DisplayCategoryKey, string> = {
  motorcycle: "Motorcycle",
  electric_two_wheeler: "Electric two-wheeler",
  auto_rickshaw: "Auto-rickshaw / three-wheeler",
  cargo_electric_three_wheeler: "Cargo electric three-wheeler",
  car: "Car",
  van: "Van",
  mini_truck: "Mini truck",
  truck: "Truck",
  other: "Other vehicle",
};

export const DISPLAY_CATEGORY_ORDER: DisplayCategoryKey[] = [
  "motorcycle",
  "electric_two_wheeler",
  "auto_rickshaw",
  "cargo_electric_three_wheeler",
  "car",
  "van",
  "mini_truck",
  "truck",
  "other",
];

const MINI_TRUCK_MAX_PAYLOAD_KG = 1000;

export function displayCategoryFor(v: Pick<VehicleProfile, "category" | "energy_type" | "payload_kg">): DisplayCategoryKey {
  const cat = v.category.trim().toLowerCase();
  const electric = v.energy_type === "electric";
  if (cat === "two_wheeler" || cat === "motorcycle" || cat === "scooter") return electric ? "electric_two_wheeler" : "motorcycle";
  if (cat === "three_wheeler" || cat === "auto_rickshaw" || cat === "auto-rickshaw") return electric ? "cargo_electric_three_wheeler" : "auto_rickshaw";
  if (cat === "car") return "car";
  if (cat === "van") return "van";
  if (cat === "truck") return "truck";
  if (cat === "light_commercial" || cat === "mini_truck" || cat === "mini-truck") {
    return v.payload_kg > MINI_TRUCK_MAX_PAYLOAD_KG ? "truck" : "mini_truck";
  }
  return "other";
}

/** `n` -> `n.toFixed(2)` string payload for Decimal(12,2) fields on write. */
function money(n: number | string): string {
  return Number(n).toFixed(2);
}

export function toVehiclePayload(v: VehicleInput): Record<string, unknown> {
  return {
    name: v.name.trim(),
    category: v.category,
    payload_kg: v.payload_kg,
    volume_m3: v.volume_m3,
    energy_type: v.energy_type,
    efficiency_value: v.efficiency_value,
    efficiency_unit: v.efficiency_unit,
    energy_price: money(v.energy_price),
    fixed_cost_per_delivery: money(v.fixed_cost_per_delivery),
    operating_cost_per_km: money(v.operating_cost_per_km),
    avg_speed_kmph: v.avg_speed_kmph,
    emissions_g_per_km: v.emissions_g_per_km,
    range_km: v.range_km ?? null,
    available: v.available,
    source: v.source,
    verification: v.verification,
  };
}

export async function createVehicle(input: VehicleInput): Promise<VehicleProfile> {
  return apiRequest<VehicleProfile>("/vehicles", { method: "POST", body: toVehiclePayload(input) });
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<VehicleProfile> {
  return apiRequest<VehicleProfile>(`/vehicles/${encodeURIComponent(id)}`, { method: "PUT", body: toVehiclePayload(input) });
}
