import { z } from "zod";

/** Money arrives as decimal string or number (₹). */
export const moneySchema = z.union([z.string(), z.number()]).transform((v) => Number(v));
const nullableStr = z.string().nullish();

export const locationTypeSchema = z.enum(["depot", "stop", "warehouse"]);
export const locationSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullish(),
  latitude: z.number(),
  longitude: z.number(),
  type: locationTypeSchema,
  zone: nullableStr,
  notes: nullableStr,
});

export const prioritySchema = z.enum(["low", "medium", "high"]);
export const packageSchema = z.object({
  id: z.string(),
  reference: z.string(),
  recipient: nullableStr,
  location_id: z.string().nullish(),
  address: nullableStr,
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  weight_kg: z.number(),
  length_cm: z.number().nullish(),
  width_cm: z.number().nullish(),
  height_cm: z.number().nullish(),
  volume_m3: z.number().nullish(),
  priority: prioritySchema,
  handling: z.array(z.string()).default([]),
  window_start: nullableStr,
  window_end: nullableStr,
  deadline: nullableStr,
  service_minutes: z.number().default(5),
  kind: z.enum(["delivery", "pickup"]).default("delivery"),
  status: z.string().default("pending"),
  notes: nullableStr,
});

export const energyTypeSchema = z.enum(["petrol", "diesel", "cng", "electric"]);
export const verificationSchema = z.enum(["measured", "external", "user", "assumed"]);
export const vehicleSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  payload_kg: z.number(),
  volume_m3: z.number(),
  energy_type: energyTypeSchema,
  efficiency_value: z.number(),
  efficiency_unit: z.enum(["km_per_l", "km_per_kwh"]),
  energy_price: moneySchema,
  fixed_cost_per_delivery: moneySchema,
  operating_cost_per_km: moneySchema,
  avg_speed_kmph: z.number(),
  emissions_g_per_km: z.number(),
  range_km: z.number().nullish(),
  available: z.boolean(),
  source: z.string(),
  verification: verificationSchema,
});

export const latLngSchema = z.object({ lat: z.number(), lng: z.number() });
export const geometrySchema = z.array(z.tuple([z.number(), z.number()]));

export const routeResultSchema = z.object({
  distance_km: z.number(),
  duration_min: z.number(),
  geometry: geometrySchema.nullish(),
  legs: z.array(z.object({ distance_km: z.number(), duration_min: z.number() })).default([]),
  provider: z.string(),
});

export const routingStatusSchema = z.object({ available: z.boolean().optional(), provider: z.string().optional(), status: z.string().optional() }).passthrough();

export const healthSchema = z.object({
  status: z.string(),
  db: z.string().optional(),
  routing: z.string().optional(),
  optimizer: z.string().optional(),
  quantum: z.string().optional(),
});

export const vehicleOptionSchema = z.object({
  vehicle_id: z.string(),
  name: z.string(),
  category: z.string(),
  energy_used: z.number(),
  energy_unit: z.string(),
  variable_cost: moneySchema,
  fixed_cost: moneySchema,
  total_cost: moneySchema,
  cost_per_km: moneySchema,
  payload_utilisation: z.number(),
  volume_utilisation: z.number(),
  deadline_feasible: z.boolean(),
  score: z.number(),
});
export const recommendationSchema = z.object({
  package_id: z.string(),
  recommended: vehicleOptionSchema.nullable(),
  alternatives: z.array(vehicleOptionSchema).default([]),
  ineligible: z.array(z.object({ vehicle_id: z.string(), reasons: z.array(z.string()) })).default([]),
  distance_km: z.number(),
  duration_min: z.number(),
  explanation: z.string(),
  assumptions: z.array(z.string()).default([]),
  distance_source: z.string().optional(),
  fallback_estimate: z.boolean().optional(),
});
export const recommendationsSchema = z.array(recommendationSchema);

export const optimizationRunSchema = z.object({
  id: z.string(),
  algorithm: z.string(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  objective: z.string().optional(),
  order: z.array(z.string()).default([]),
  distance_km: z.number().nullish(),
  duration_min: z.number().nullish(),
  total_cost: moneySchema.nullish(),
  geometry: geometrySchema.nullish(),
  routing_available: z.boolean().default(false),
  distance_is_estimate: z.boolean().default(false),
  compute_seconds: z.number().nullish(),
  simulated: z.boolean().default(false),
  notes: z.array(z.string()).default([]),
  created_at: z.string().nullish(),
});

export const summaryStatsSchema = z.object({
  total_distance_km: z.number().nullable(),
  total_duration_min: z.number().nullable(),
  delivery_stops: z.number(),
  vehicles_used: z.number(),
  fleet_size: z.number(),
  fuel_cost: moneySchema.nullable(),
  co2_kg: z.number().nullable(),
});

export const apiErrorBodySchema = z.object({ detail: z.unknown().optional(), message: z.string().optional(), code: z.string().optional() }).passthrough();

/* ---- Plan form (frontend-only draft stop) ---- */
/** Blank input must not coerce to 0 (a real coordinate). */
const coord = (label: string, lim: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ error: `${label} is required` }).min(-lim, `Must be between -${lim} and ${lim}`).max(lim, `Must be between -${lim} and ${lim}`),
  );
export const stopFormSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  latitude: coord("Latitude", 90),
  longitude: coord("Longitude", 180),
  zone_kind: z.enum(["Residential", "Commercial", "Office"]),
  packages: z.coerce.number().int("Whole number").min(1, "At least 1 package").max(500),
  weight_kg: z.coerce.number().positive("Weight must be above 0").max(20000),
  priority: prioritySchema,
  window_start: z.string().regex(/^$|^\d{2}:\d{2}$/, "HH:MM").optional().or(z.literal("")),
  window_end: z.string().regex(/^$|^\d{2}:\d{2}$/, "HH:MM").optional().or(z.literal("")),
  service_minutes: z.coerce.number().min(0).max(240),
  kind: z.enum(["delivery", "pickup"]),
}).refine((v) => !v.window_start || !v.window_end || v.window_start < v.window_end, { path: ["window_end"], message: "End must be after start" });
export type StopFormInput = z.input<typeof stopFormSchema>;
export type StopFormValues = z.output<typeof stopFormSchema>;

export const constraintsSchema = z.object({
  depot_id: z.string().min(1),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  max_vehicles: z.coerce.number().int().min(1).max(20),
  respect_capacity: z.boolean(),
  respect_time_windows: z.boolean(),
  priority_handling: z.enum(["ignore", "consider", "strict"]),
  return_to_depot: z.boolean(),
  prefer_electric: z.boolean(),
});
export type Constraints = z.infer<typeof constraintsSchema>;

export const optimizeConfigSchema = z.object({
  algorithm: z.enum(["classical_greedy", "classical_2opt", "quantum_simulated"]),
  objective: z.enum(["distance", "time", "cost"]),
});
export type OptimizeConfig = z.infer<typeof optimizeConfigSchema>;
