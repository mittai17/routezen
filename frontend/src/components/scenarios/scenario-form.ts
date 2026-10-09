/** Pure form model for scenario inputs: config <-> form conversion, validation and the template catalogue. */
import type { Location, VehicleProfile } from "@/lib/api/types";
import { META_KEY, readMeta, type Scenario, type ScenarioInput, type ScenarioKind } from "@/lib/api/scenarios";

export interface StopRow { key: string; label: string; latitude: string; longitude: string; weight_kg: string; service_minutes: string }

export interface ScenarioForm {
  name: string;
  description: string;
  kind: Exclude<ScenarioKind, "quantum">;
  template: string | null;
  depotLabel: string;
  depotLat: string;
  depotLng: string;
  stops: StopRow[];
  /** "all" = every available vehicle in the fleet (backend default); "selected" = restrict to vehicleIds. */
  vehicleMode: "all" | "selected";
  vehicleIds: string[];
  recWeights: { cost: string; time: string; emissions: string; utilisation: string };
  optWeights: { distance: string; time: string; cost: string; emissions: string };
  roundTrip: boolean;
  requireDeadline: boolean;
  allowFallback: boolean;
  returnToDepot: boolean;
  timeLimit: string;
  assumptions: string[];
}

let seq = 0;
export const newRowKey = () => `row-${++seq}`;

export const DEFAULT_REC_WEIGHTS = { cost: "0.5", time: "0.25", emissions: "0.15", utilisation: "0.1" };
export const DEFAULT_OPT_WEIGHTS = { distance: "0.4", time: "0.3", cost: "0.2", emissions: "0.1" };

export function emptyForm(): ScenarioForm {
  return {
    name: "", description: "", kind: "recommendation", template: null, depotLabel: "", depotLat: "", depotLng: "", stops: [],
    vehicleMode: "all", vehicleIds: [], recWeights: { ...DEFAULT_REC_WEIGHTS }, optWeights: { ...DEFAULT_OPT_WEIGHTS },
    roundTrip: false, requireDeadline: true, allowFallback: false, returnToDepot: true, timeLimit: "5", assumptions: [],
  };
}

export const stopFromLocation = (l: Location, weight = 10, service = 5): StopRow => ({
  key: newRowKey(), label: l.name, latitude: String(l.latitude), longitude: String(l.longitude), weight_kg: String(weight), service_minutes: String(service),
});

/* ------------------------------------------------------------------ config <-> form */
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, d = "") => (typeof v === "number" || typeof v === "string" ? String(v) : d);

export function scenarioToForm(s: Pick<Scenario, "name" | "description" | "kind" | "config">): ScenarioForm {
  const f = emptyForm();
  const c = rec(s.config);
  const meta = readMeta(s.config);
  f.name = s.name;
  f.description = s.description ?? "";
  f.kind = s.kind === "classical" ? "classical" : "recommendation";
  f.template = meta.template ?? null;
  f.assumptions = meta.assumptions ?? [];
  const depot = rec(c.depot);
  f.depotLat = str(depot.latitude);
  f.depotLng = str(depot.longitude);
  f.depotLabel = meta.depot_label ?? (typeof depot.name === "string" ? depot.name : "");
  const list = f.kind === "classical" ? c.stops : c.packages;
  f.stops = (Array.isArray(list) ? list : []).map((raw, i) => {
    const r = rec(raw);
    return {
      key: newRowKey(), label: str(f.kind === "classical" ? r.id : r.package_id, `Stop ${i + 1}`),
      latitude: str(r.latitude), longitude: str(r.longitude), weight_kg: str(r.weight_kg, "0"), service_minutes: str(r.service_minutes, "5"),
    };
  });
  if (Array.isArray(c.vehicle_ids) && c.vehicle_ids.length) { f.vehicleMode = "selected"; f.vehicleIds = c.vehicle_ids.map(String); }
  if (f.kind === "classical") {
    const w = rec(c.weights);
    f.optWeights = { distance: str(w.distance, "0.4"), time: str(w.time, "0.3"), cost: str(w.cost, "0.2"), emissions: str(w.emissions, "0.1") };
    f.returnToDepot = c.return_to_depot !== false;
    f.timeLimit = str(c.time_limit_s, "5");
    f.allowFallback = c.allow_fallback_estimate === true;
  } else {
    const p = rec(c.preferences);
    const w = rec(p.weights);
    f.recWeights = { cost: str(w.cost, "0.5"), time: str(w.time, "0.25"), emissions: str(w.emissions, "0.15"), utilisation: str(w.utilisation, "0.1") };
    f.roundTrip = p.round_trip === true;
    f.requireDeadline = p.require_deadline !== false;
    f.allowFallback = p.allow_fallback_estimate === true;
  }
  return f;
}

export interface FormErrors { name?: string; depot?: string; stops?: string; weights?: string; timeLimit?: string; vehicles?: string; rows: Record<string, string> }

const finite = (s: string) => s.trim() !== "" && Number.isFinite(Number(s));

export function validateForm(f: ScenarioForm): FormErrors {
  const e: FormErrors = { rows: {} };
  if (!f.name.trim()) e.name = "Name is required";
  else if (f.name.trim().length > 200) e.name = "Name must be 200 characters or fewer";
  if (!finite(f.depotLat) || !finite(f.depotLng) || Math.abs(Number(f.depotLat)) > 90 || Math.abs(Number(f.depotLng)) > 180) e.depot = "Enter a valid depot latitude (-90..90) and longitude (-180..180)";
  if (!f.stops.length) e.stops = "Add at least one stop";
  else if (f.stops.length > 200) e.stops = "At most 200 stops";
  const seen = new Set<string>();
  for (const r of f.stops) {
    const label = r.label.trim();
    if (!label) e.rows[r.key] = "Label required";
    else if (seen.has(label)) e.rows[r.key] = "Duplicate label";
    else if (!finite(r.latitude) || !finite(r.longitude) || Math.abs(Number(r.latitude)) > 90 || Math.abs(Number(r.longitude)) > 180) e.rows[r.key] = "Invalid coordinates";
    else if (!finite(r.weight_kg) || Number(r.weight_kg) < 0) e.rows[r.key] = "Weight must be 0 or more";
    else if (!finite(r.service_minutes) || Number(r.service_minutes) < 0) e.rows[r.key] = "Service minutes must be 0 or more";
    seen.add(label);
  }
  const ws = f.kind === "classical" ? Object.values(f.optWeights) : Object.values(f.recWeights);
  if (ws.some((w) => !finite(w) || Number(w) < 0)) e.weights = "Weights must be numbers of 0 or more";
  else if (ws.reduce((a, w) => a + Number(w), 0) <= 0) e.weights = "At least one weight must be above 0";
  if (f.kind === "classical" && (!Number.isInteger(Number(f.timeLimit)) || Number(f.timeLimit) < 1 || Number(f.timeLimit) > 120)) e.timeLimit = "Whole seconds, 1 to 120";
  if (f.vehicleMode === "selected" && f.vehicleIds.length === 0) e.vehicles = "Select at least one vehicle or use the whole fleet";
  return e;
}
export const hasErrors = (e: FormErrors) => Object.keys(e).some((k) => (k === "rows" ? Object.keys(e.rows).length > 0 : e[k as keyof FormErrors] !== undefined));

/** Builds the API payload. Unknown keys of `prev` (e.g. other tools' config) are preserved; UI metadata goes under META_KEY. */
export function formToInput(f: ScenarioForm, prev?: Pick<Scenario, "config">, now = new Date()): ScenarioInput {
  const base: Record<string, unknown> = { ...(prev?.config ?? {}) };
  const prevMeta = readMeta(prev?.config);
  const lat = Number(f.depotLat), lng = Number(f.depotLng);
  const stops = f.stops.map((r) => ({ label: r.label.trim(), latitude: Number(r.latitude), longitude: Number(r.longitude), weight_kg: Number(r.weight_kg), service_minutes: Number(r.service_minutes) }));
  const vehicle_ids = f.vehicleMode === "selected" ? f.vehicleIds : undefined;
  const wnum = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v)]));

  let config: Record<string, unknown>;
  if (f.kind === "classical") {
    for (const k of ["packages", "preferences"]) delete base[k];
    config = {
      ...base,
      depot: { latitude: lat, longitude: lng, name: f.depotLabel.trim() || "Depot" },
      stops: stops.map((s) => ({ id: s.label, latitude: s.latitude, longitude: s.longitude, weight_kg: s.weight_kg, service_minutes: s.service_minutes })),
      weights: wnum(f.optWeights), return_to_depot: f.returnToDepot, time_limit_s: Number(f.timeLimit), allow_fallback_estimate: f.allowFallback,
    };
  } else {
    for (const k of ["stops", "weights", "return_to_depot", "time_limit_s", "allow_fallback_estimate"]) delete base[k];
    config = {
      ...base,
      depot: { latitude: lat, longitude: lng },
      packages: stops.map((s) => ({ package_id: s.label, latitude: s.latitude, longitude: s.longitude, weight_kg: s.weight_kg, service_minutes: s.service_minutes })),
      preferences: { weights: wnum(f.recWeights), round_trip: f.roundTrip, require_deadline: f.requireDeadline, allow_fallback_estimate: f.allowFallback },
    };
  }
  if (vehicle_ids) config.vehicle_ids = vehicle_ids; else delete config.vehicle_ids;

  // Compare the *inputs* (everything but meta) to know whether results became stale.
  const strip = (c: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k]) => k !== META_KEY).sort(([a], [b]) => a.localeCompare(b))));
  const changed = !prev || strip(prev.config) !== strip(config);
  config[META_KEY] = {
    ...prevMeta,
    template: f.template, depot_label: f.depotLabel.trim() || undefined, assumptions: f.assumptions,
    inputs_edited_at: changed ? now.toISOString() : prevMeta.inputs_edited_at ?? now.toISOString(),
  };
  return { name: f.name.trim(), description: f.description.trim() || null, kind: f.kind, config };
}

/* ------------------------------------------------------------------ templates */
export interface Template {
  id: string;
  title: string;
  description: string;
  tags: string[];
  icon: "building" | "zap" | "gauge" | "leaf" | "plus" | "wallet" | "repeat" | "route" | "fuel";
  /** Why this template cannot be built right now (or at all). */
  unavailable?: (ctx: TemplateContext) => string | null;
  build: (ctx: TemplateContext) => ScenarioForm;
}
export interface TemplateContext { locations: Location[]; vehicles: VehicleProfile[] }

const WEIGHT_CYCLE = [10, 25, 40, 15, 60, 20];
const TEMPLATE_ASSUMPTION = "Template defaults: per-stop weights cycle through 10-60 kg and service time is 5 min. These are placeholders, not real loads; edit them to match your deliveries.";

const depotOf = (ctx: TemplateContext) => ctx.locations.find((l) => l.type === "depot") ?? null;
const stopLocations = (ctx: TemplateContext) => ctx.locations.filter((l) => l.type !== "depot");

function baseForm(ctx: TemplateContext, id: string, name: string, description: string, stopCount: number): ScenarioForm {
  const f = emptyForm();
  const d = depotOf(ctx);
  f.template = id; f.name = name; f.description = description;
  if (d) { f.depotLabel = d.name; f.depotLat = String(d.latitude); f.depotLng = String(d.longitude); }
  f.stops = stopLocations(ctx).slice(0, stopCount).map((l, i) => stopFromLocation(l, WEIGHT_CYCLE[i % WEIGHT_CYCLE.length]));
  f.assumptions = [TEMPLATE_ASSUMPTION];
  return f;
}
const needsData = (min: number) => (ctx: TemplateContext) =>
  !depotOf(ctx) ? "Needs a depot location. Add one in Locations first."
    : stopLocations(ctx).length < min ? `Needs at least ${min} non-depot locations (found ${stopLocations(ctx).length}).`
    : ctx.vehicles.length === 0 ? "Needs at least one vehicle profile." : null;

const weights = (cost: number, time: number, emissions: number, utilisation: number) => ({ cost: String(cost), time: String(time), emissions: String(emissions), utilisation: String(utilisation) });
const BASE_COUNT = 3;

export const TEMPLATES: Template[] = [
  {
    id: "city-delivery", title: "City Delivery", icon: "building", tags: ["Balanced", "Urban"],
    description: "Balanced vehicle recommendation for a short urban delivery run from the depot, using the default scoring weights.",
    unavailable: needsData(1),
    build: (ctx) => baseForm(ctx, "city-delivery", "City Delivery", "Balanced recommendation for a short urban run.", BASE_COUNT),
  },
  {
    id: "ev-preference", title: "EV preference", icon: "zap", tags: ["Electric", "Emissions"],
    description: "Restricts the candidate fleet to electric vehicles and weights emissions higher, to see what an EV-only operation would cost.",
    unavailable: (ctx) => needsData(1)(ctx) ?? (ctx.vehicles.some((v) => v.energy_type === "electric") ? null : "No electric vehicle profiles in the fleet."),
    build: (ctx) => {
      const f = baseForm(ctx, "ev-preference", "EV preference", "Electric vehicles only, emissions weighted higher.", BASE_COUNT);
      f.vehicleMode = "selected"; f.vehicleIds = ctx.vehicles.filter((v) => v.energy_type === "electric").map((v) => v.id);
      f.recWeights = weights(0.35, 0.2, 0.35, 0.1);
      f.assumptions.push("Candidate vehicles are limited to electric profiles present when the scenario was created.");
      return f;
    },
  },
  {
    id: "fastest", title: "Fastest delivery", icon: "gauge", tags: ["Time"],
    description: "Weights travel time at 70% so the quickest eligible vehicle wins, even when it costs more.",
    unavailable: needsData(1),
    build: (ctx) => { const f = baseForm(ctx, "fastest", "Fastest delivery", "Time weighted at 70%.", BASE_COUNT); f.recWeights = weights(0.1, 0.7, 0.1, 0.1); return f; },
  },
  {
    id: "lowest-emissions", title: "Lowest emissions", icon: "leaf", tags: ["Emissions"],
    description: "Weights emissions at 60% to find the greenest vehicle choice for each package.",
    unavailable: needsData(1),
    build: (ctx) => { const f = baseForm(ctx, "lowest-emissions", "Lowest emissions", "Emissions weighted at 60%.", BASE_COUNT); f.recWeights = weights(0.15, 0.1, 0.6, 0.15); return f; },
  },
  {
    id: "lowest-cost", title: "Lowest cost", icon: "wallet", tags: ["Cost"],
    description: "Weights cost at 80% to find the cheapest eligible vehicle for each package.",
    unavailable: needsData(1),
    build: (ctx) => { const f = baseForm(ctx, "lowest-cost", "Lowest cost", "Cost weighted at 80%.", BASE_COUNT); f.recWeights = weights(0.8, 0.1, 0.05, 0.05); return f; },
  },
  {
    id: "extra-stops", title: "Extra stops", icon: "plus", tags: ["Volume"],
    description: "Same setup as City Delivery but with every available location as a stop, to see how volume changes cost and feasibility.",
    unavailable: needsData(BASE_COUNT + 1),
    build: (ctx) => baseForm(ctx, "extra-stops", "Extra stops", "City Delivery with all available locations as stops.", 200),
  },
  {
    id: "round-trip", title: "Round-trip billing", icon: "repeat", tags: ["Distance"],
    description: "Bills the return leg to the depot for each package, so cost, time and emissions reflect going out and coming back.",
    unavailable: needsData(1),
    build: (ctx) => { const f = baseForm(ctx, "round-trip", "Round-trip billing", "Return leg billed for each package.", BASE_COUNT); f.roundTrip = true; return f; },
  },
  {
    id: "multi-stop-route", title: "Multi-stop route", icon: "route", tags: ["Optimisation", "OR-Tools"],
    description: "Runs the classical OR-Tools vehicle-routing solver over the stops to get an optimised route, cost and unassigned stops.",
    unavailable: needsData(2),
    build: (ctx) => { const f = baseForm(ctx, "multi-stop-route", "Multi-stop route", "Classical routing across all stops.", 200); f.kind = "classical"; return f; },
  },
  {
    id: "higher-fuel-price", title: "Higher fuel price", icon: "fuel", tags: ["Not available"],
    description: "What if fuel costs more? Scenario runs read energy prices from the stored vehicle profiles and cannot override them per scenario.",
    unavailable: () => "The backend has no per-scenario price override. Change a vehicle's energy price in Vehicles to model this, then re-run.",
    build: (ctx) => baseForm(ctx, "higher-fuel-price", "Higher fuel price", "", BASE_COUNT),
  },
];
