import { z } from "zod";
import type { VehicleProfile } from "@/lib/api/types";

export type EnergyType = VehicleProfile["energy_type"];
export type Verification = VehicleProfile["verification"];
export type EfficiencyUnit = VehicleProfile["efficiency_unit"];

export const ENERGY_TYPES: EnergyType[] = ["petrol", "diesel", "cng", "electric"];
export const VERIFICATIONS: Verification[] = ["measured", "external", "user", "assumed"];
export const COMMON_CATEGORIES = ["two_wheeler", "three_wheeler", "light_commercial", "van", "truck"];

export const ENERGY_LABEL: Record<EnergyType, string> = { petrol: "Petrol", diesel: "Diesel", cng: "CNG", electric: "Electric" };
export const VERIFICATION_LABEL: Record<Verification, string> = { measured: "Measured", external: "External source", user: "User supplied", assumed: "Assumed" };
export const VERIFICATION_HELP: Record<Verification, string> = {
  measured: "Measured on your own vehicle or trips.",
  external: "Taken from a manufacturer, regulator or published dataset.",
  user: "Entered by a user without independent evidence.",
  assumed: "Placeholder planning estimate, not verified.",
};

/** Electric vehicles use km/kWh; all fuel vehicles use km/L (backend contract). */
export const unitForEnergy = (e: EnergyType): EfficiencyUnit => (e === "electric" ? "km_per_kwh" : "km_per_l");
export const efficiencyUnitLabel = (u: EfficiencyUnit) => (u === "km_per_kwh" ? "km/kWh" : "km/L");
export const priceUnitLabel = (e: EnergyType) => (e === "electric" ? "₹/kWh" : "₹/L");

export const categoryLabel = (c: string) => {
  const s = c.replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Uncategorised";
};

/** Energy cost per km = price / efficiency. */
export const energyCostPerKm = (v: Pick<VehicleProfile, "energy_price" | "efficiency_value">): number =>
  v.efficiency_value > 0 ? Number(v.energy_price) / v.efficiency_value : 0;
/** Total cost per km = energy cost per km + non-energy operating cost per km (matches backend recommendation costing). */
export const costPerKm = (v: Pick<VehicleProfile, "energy_price" | "efficiency_value" | "operating_cost_per_km">): number =>
  energyCostPerKm(v) + Number(v.operating_cost_per_km);

export type IssueSeverity = "error" | "warning" | "info";
export interface SpecIssue { field: string; severity: IssueSeverity; message: string }

/** Explains missing / suspicious specs that weaken cost and emissions estimates. */
export function specIssues(v: Omit<VehicleProfile, "id">): SpecIssue[] {
  const out: SpecIssue[] = [];
  const add = (field: string, severity: IssueSeverity, message: string) => out.push({ field, severity, message });
  if ((v.energy_type === "electric") !== (v.efficiency_unit === "km_per_kwh")) {
    add("efficiency_unit", "error", "Efficiency unit does not match the energy type: electric vehicles use km/kWh, fuel vehicles use km/L.");
  }
  if (!(v.payload_kg > 0)) add("payload_kg", "error", "Payload is missing, so this vehicle cannot be checked against package weight.");
  if (!(v.volume_m3 > 0)) add("volume_m3", "error", "Cargo volume is missing, so volume fit cannot be checked.");
  if (!(v.efficiency_value > 0)) add("efficiency_value", "error", "Efficiency is missing, so energy use and cost cannot be estimated.");
  if (Number(v.energy_price) === 0) add("energy_price", "warning", `Energy price is 0, so energy cost is treated as free. Enter the current ${priceUnitLabel(v.energy_type)} price.`);
  if (Number(v.operating_cost_per_km) === 0) add("operating_cost_per_km", "warning", "Operating cost per km is 0, so maintenance, tyres and driver cost are excluded from cost per km.");
  if (Number(v.fixed_cost_per_delivery) === 0) add("fixed_cost_per_delivery", "info", "Fixed cost per delivery is 0, so stop handling cost is ignored.");
  if (v.energy_type !== "electric" && v.emissions_g_per_km === 0) add("emissions_g_per_km", "warning", "A fuel vehicle with 0 g/km emissions is unlikely; emissions comparisons will understate it.");
  if (v.range_km == null) add("range_km", "warning", "Range is not set, so the planner cannot flag routes this vehicle cannot complete (important for electric vehicles).");
  if (v.energy_type !== "electric" && v.efficiency_value > 100) add("efficiency_value", "warning", "Efficiency above 100 km/L is implausible for a fuel vehicle; check the unit.");
  if (v.energy_type === "electric" && v.efficiency_value > 50) add("efficiency_value", "warning", "Efficiency above 50 km/kWh is implausible; check the value.");
  if (!v.source.trim()) add("source", "warning", "No data source recorded, so the origin of these figures cannot be audited.");
  if (v.verification === "assumed") add("verification", "info", "Specs are assumptions, not verified figures. Treat cost and emission results as estimates.");
  return out;
}

export const issueCounts = (issues: SpecIssue[]) => ({
  errors: issues.filter((i) => i.severity === "error").length,
  warnings: issues.filter((i) => i.severity === "warning").length,
});

/* ---------------- form ---------------- */
export interface VehicleFormValues {
  name: string; category: string; payload_kg: string; volume_m3: string; energy_type: EnergyType;
  efficiency_value: string; energy_price: string; fixed_cost_per_delivery: string; operating_cost_per_km: string;
  avg_speed_kmph: string; emissions_g_per_km: string; range_km: string; available: boolean; source: string; verification: Verification;
}

export const emptyFormValues = (): VehicleFormValues => ({
  name: "", category: "van", payload_kg: "", volume_m3: "", energy_type: "diesel", efficiency_value: "", energy_price: "",
  fixed_cost_per_delivery: "0", operating_cost_per_km: "0", avg_speed_kmph: "25", emissions_g_per_km: "0", range_km: "",
  available: true, source: "", verification: "user",
});

export const toFormValues = (v: Omit<VehicleProfile, "id">): VehicleFormValues => ({
  name: v.name, category: v.category, payload_kg: String(v.payload_kg), volume_m3: String(v.volume_m3), energy_type: v.energy_type,
  efficiency_value: String(v.efficiency_value), energy_price: String(Number(v.energy_price)),
  fixed_cost_per_delivery: String(Number(v.fixed_cost_per_delivery)), operating_cost_per_km: String(Number(v.operating_cost_per_km)),
  avg_speed_kmph: String(v.avg_speed_kmph), emissions_g_per_km: String(v.emissions_g_per_km), range_km: v.range_km == null ? "" : String(v.range_km),
  available: v.available, source: v.source, verification: v.verification,
});

/** A required number: blank must be an error (never silently 0). */
const num = (label: string, opts: { min?: number; gt?: number; max?: number; money?: boolean } = {}) =>
  z.string().trim().min(1, `${label} is required`).transform((s, ctx) => {
    const n = Number(s);
    if (!Number.isFinite(n)) { ctx.addIssue({ code: "custom", message: `${label} must be a number` }); return z.NEVER; }
    if (opts.gt !== undefined && !(n > opts.gt)) { ctx.addIssue({ code: "custom", message: `${label} must be greater than ${opts.gt}` }); return z.NEVER; }
    if (opts.min !== undefined && n < opts.min) { ctx.addIssue({ code: "custom", message: `${label} cannot be negative` }); return z.NEVER; }
    if (opts.max !== undefined && n > opts.max) { ctx.addIssue({ code: "custom", message: `${label} must be at most ${opts.max}` }); return z.NEVER; }
    if (opts.money && Math.round(n * 100) / 100 !== n) { ctx.addIssue({ code: "custom", message: `${label} allows at most 2 decimal places` }); return z.NEVER; }
    return n;
  });

export const vehicleFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be 200 characters or fewer"),
  category: z.string().trim().min(1, "Category is required").max(50, "Category must be 50 characters or fewer"),
  payload_kg: num("Payload", { gt: 0, max: 1_000_000 }),
  volume_m3: num("Cargo volume", { gt: 0, max: 10_000 }),
  energy_type: z.enum(ENERGY_TYPES),
  efficiency_value: num("Efficiency", { gt: 0, max: 1000 }),
  energy_price: num("Energy price", { min: 0, money: true, max: 100_000 }),
  fixed_cost_per_delivery: num("Fixed cost per delivery", { min: 0, money: true, max: 1_000_000 }),
  operating_cost_per_km: num("Operating cost per km", { min: 0, money: true, max: 100_000 }),
  avg_speed_kmph: num("Average speed", { gt: 0, max: 200 }),
  emissions_g_per_km: num("Emissions factor", { min: 0, max: 100_000 }),
  range_km: z.string().trim().transform((s, ctx) => {
    if (s === "") return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0) { ctx.addIssue({ code: "custom", message: "Range must be a number greater than 0, or left blank" }); return z.NEVER; }
    return n;
  }),
  available: z.boolean(),
  source: z.string().trim().max(2000, "Source is too long"),
  verification: z.enum(VERIFICATIONS),
}).superRefine((v, ctx) => {
  if (v.verification !== "assumed" && v.source === "") {
    ctx.addIssue({ code: "custom", path: ["source"], message: `Record the data source: "${VERIFICATION_LABEL[v.verification]}" figures need a source. Choose "Assumed" if there is none.` });
  }
});

export type VehicleInput = Omit<VehicleProfile, "id">;
export type FormErrors = Partial<Record<keyof VehicleFormValues, string>>;

export function parseVehicleForm(values: VehicleFormValues): { ok: true; data: VehicleInput } | { ok: false; errors: FormErrors } {
  const r = vehicleFormSchema.safeParse(values);
  if (r.success) return { ok: true, data: { ...r.data, efficiency_unit: unitForEnergy(r.data.energy_type) } };
  const errors: FormErrors = {};
  for (const i of r.error.issues) {
    const k = i.path[0] as keyof VehicleFormValues | undefined;
    if (k && !errors[k]) errors[k] = i.message;
  }
  return { ok: false, errors };
}
