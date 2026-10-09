import { z } from "zod";

export const PRIORITIES = ["low", "medium", "high"] as const;
export const STATUSES = ["pending", "assigned", "in_transit", "delivered", "failed", "cancelled"] as const;
export const KINDS = ["delivery", "pickup"] as const;

/** Blank input must stay "absent" (never coerce "" to 0). */
const optNum = (label: string, check: (n: z.ZodNumber) => z.ZodNumber) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v)) ? undefined : typeof v === "string" ? Number(v) : v),
    check(z.number({ error: `${label} must be a number` })).optional(),
  );

const reqNum = (label: string, check: (n: z.ZodNumber) => z.ZodNumber) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : typeof v === "string" ? Number(v) : v),
    check(z.number({ error: `${label} is required` })),
  );

const optText = (max: number) => z.string().trim().max(max, `At most ${max} characters`).optional();

export const packageFormSchema = z
  .object({
    reference: z.string().trim().min(1, "Reference is required").max(200, "At most 200 characters"),
    recipient: optText(200),
    address: optText(500),
    weight_kg: reqNum("Weight", (n) => n.min(0, "Weight cannot be negative").max(20000, "Weight must be at most 20000 kg")),
    length_cm: optNum("Length", (n) => n.positive("Must be above 0").max(10000)),
    width_cm: optNum("Width", (n) => n.positive("Must be above 0").max(10000)),
    height_cm: optNum("Height", (n) => n.positive("Must be above 0").max(10000)),
    latitude: optNum("Latitude", (n) => n.min(-90, "Between -90 and 90").max(90, "Between -90 and 90")),
    longitude: optNum("Longitude", (n) => n.min(-180, "Between -180 and 180").max(180, "Between -180 and 180")),
    priority: z.enum(PRIORITIES, { error: "Choose low, medium or high" }),
    kind: z.enum(KINDS, { error: "Choose delivery or pickup" }),
    status: z.enum(STATUSES, { error: "Invalid status" }),
    service_minutes: reqNum("Service time", (n) => n.min(0, "Cannot be negative").max(240, "At most 240 minutes")),
    handling: z.string().optional(),
    notes: optText(2000),
  })
  .superRefine((v, ctx) => {
    const dims = [v.length_cm, v.width_cm, v.height_cm];
    if (dims.some((d) => d !== undefined) && dims.some((d) => d === undefined)) {
      for (const [k, d] of [["length_cm", v.length_cm], ["width_cm", v.width_cm], ["height_cm", v.height_cm]] as const) {
        if (d === undefined) ctx.addIssue({ code: "custom", path: [k], message: "Enter all three dimensions or none" });
      }
    }
    if ((v.latitude === undefined) !== (v.longitude === undefined)) {
      ctx.addIssue({ code: "custom", path: [v.latitude === undefined ? "latitude" : "longitude"], message: "Latitude and longitude go together" });
    }
  });

export type PackageFormInput = z.input<typeof packageFormSchema>;
export type PackageFormValues = z.output<typeof packageFormSchema>;

/** m³ from cm dimensions, rounded like the backend (6 dp). */
export function computeVolumeM3(l?: number | null, w?: number | null, h?: number | null): number | null {
  if (!l || !w || !h || l <= 0 || w <= 0 || h <= 0) return null;
  return Math.round(((l * w * h) / 1_000_000) * 1e6) / 1e6;
}

export function parseHandling(s: string | undefined | null): string[] {
  return [...new Set((s ?? "").split(/[;,|]/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
}

export const normRef = (r: string) => r.trim().toLowerCase();

/** Case-insensitive reference duplicate check against existing references (optionally ignoring one id). */
export function isDuplicateReference(ref: string, existing: { id: string; reference: string }[], ignoreId?: string): boolean {
  const n = normRef(ref);
  return !!n && existing.some((p) => p.id !== ignoreId && normRef(p.reference) === n);
}
