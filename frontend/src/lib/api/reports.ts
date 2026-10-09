/**
 * Reports data layer. Builds report documents (tables + metadata) from the same inputs as Analytics, so a report never
 * contains a number the rest of the app cannot explain. Values that are unknown stay null (rendered "—", empty in CSV).
 *
 * Backend CSV: GET /reports/{kind}.csv exists only for plans, vehicles, packages, locations and events, returns the whole
 * workspace (no date filter, max 10,000 rows) and is an export of stored records. Everything else here is generated in the
 * browser from the preview and says so.
 */
import { z } from "zod";
import { API_BASE_URL, USE_DEMO_DATA } from "./client";
import { ApiError } from "./errors";
import { computeAnalytics, fetchAllItems, loadAnalyticsInput, resolveRange, type AnalyticsInput, type DateRange, type RangePreset } from "./analytics";

export type ReportKind =
  | "delivery_plan_summary" | "vehicle_recommendation" | "route_cost_breakdown" | "mileage_energy" | "optimization_comparison" | "scenario_comparison";

export const REPORT_KINDS: { kind: ReportKind; label: string; description: string; backendCsv: "plans" | "vehicles" | null }[] = [
  { kind: "delivery_plan_summary", label: "Delivery plan summary", description: "Saved plans with deliveries, planned distance and cost, and observed delivery events.", backendCsv: "plans" },
  { kind: "vehicle_recommendation", label: "Vehicle recommendation", description: "Vehicle profiles ranked by rated cost per km, with how often each was actually assigned.", backendCsv: "vehicles" },
  { kind: "route_cost_breakdown", label: "Route cost breakdown", description: "Cost per plan, per delivery and per km, plus estimated energy and operating cost by vehicle.", backendCsv: "plans" },
  { kind: "mileage_energy", label: "Mileage & energy", description: "Distance, energy use, energy cost and emissions by vehicle (estimates from rated efficiency).", backendCsv: null },
  { kind: "optimization_comparison", label: "Optimization comparison", description: "Classical vs simulated-quantum run statistics and per-run cost gaps.", backendCsv: null },
  { kind: "scenario_comparison", label: "Scenario comparison", description: "Saved scenarios side by side with their last stored result summary.", backendCsv: null },
];

/** How trustworthy a column is. Never mix these silently. */
export type Basis = "observed" | "planned" | "estimate" | "profile" | "info";
export const BASIS_LABEL: Record<Basis, string> = {
  observed: "Observed (recorded events)", planned: "Planned (saved plan values, not measured)", estimate: "Estimate (derived from profile assumptions)",
  profile: "Profile value (vehicle profile; see verification)", info: "Descriptive",
};

export type Cell = string | number | null;
export interface Column { label: string; unit?: string; type: "text" | "num" | "inr" | "dt" | "pct"; digits?: number; basis: Basis }
export interface Section { title: string; note?: string; columns: Column[]; rows: Cell[][]; footer?: Cell[] }
export interface ReportDoc {
  kind: ReportKind; title: string; generatedAt: string; source: "demo" | "api";
  range: { label: string; from: string | null; to: string | null };
  sections: Section[]; assumptions: string[]; units: string[]; caveats: string[];
}

/* ------------------------------------------------------------------ scenarios */
export interface ScenarioRow { id: string; name: string; kind: string; created_at: string; last_run_at: string | null; summary: Record<string, unknown> | null }
const scenarioSchema = z.object({
  id: z.string(), name: z.string(), kind: z.string(), created_at: z.string(), last_run_at: z.string().nullish(),
  result: z.record(z.string(), z.unknown()).nullish(),
}).transform((s): ScenarioRow => {
  const sum = s.result?.summary;
  return { id: s.id, name: s.name, kind: s.kind, created_at: s.created_at, last_run_at: s.last_run_at ?? null, summary: sum && typeof sum === "object" ? (sum as Record<string, unknown>) : null };
});

export interface ReportInput extends AnalyticsInput { scenarios: ScenarioRow[] }

export async function loadReportInput(): Promise<ReportInput> {
  const base = await loadAnalyticsInput();
  if (USE_DEMO_DATA) return { ...base, scenarios: demoScenarios() };
  const scenarios = await fetchAllItems("/scenarios", scenarioSchema);
  return { ...base, scenarios };
}

function demoScenarios(now = Date.now()): ScenarioRow[] {
  const iso = (d: number) => new Date(now - d * 86_400_000).toISOString();
  return [
    { id: "demo-s1", name: "Demo: City delivery", kind: "classical", created_at: iso(6), last_run_at: iso(5), summary: { total_distance_km: 38.2, total_cost: 612.4, unassigned: 0, status: "solved" } },
    { id: "demo-s2", name: "Demo: Rural logistics", kind: "classical", created_at: iso(4), last_run_at: iso(3), summary: { total_distance_km: 71.9, total_cost: 1184.0, unassigned: 1, status: "solved" } },
    { id: "demo-s3", name: "Demo: Vehicle mix", kind: "recommendation", created_at: iso(2), last_run_at: null, summary: null },
  ];
}

/* ------------------------------------------------------------------ builders */
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const nz = (v: number | null | undefined): number | null => (v === undefined ? null : v);
const rd = (v: number | null, d = 2): number | null => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);
const ranged = (iso: string | null | undefined, r: DateRange) => {
  const t = iso ? Date.parse(iso) : NaN;
  if (isNaN(t)) return r.from === null && r.to === null;
  return (r.from === null || t >= +r.from) && (r.to === null || t <= +r.to);
};

const T = (label: string, basis: Basis = "info", extra: Partial<Column> = {}): Column => ({ label, type: "text", basis, ...extra });
const N = (label: string, unit: string, basis: Basis, digits = 1): Column => ({ label, unit, type: "num", digits, basis });
const R = (label: string, basis: Basis, unit = "₹", digits = 2): Column => ({ label, unit, type: "inr", digits, basis });

export function rangeLabel(preset: RangePreset, custom: { from: string; to: string }): string {
  if (preset === "7d") return "Last 7 days";
  if (preset === "30d") return "Last 30 days";
  if (preset === "90d") return "Last 90 days";
  if (preset === "all") return "All time";
  return `${custom.from || "start"} to ${custom.to || "today"}`;
}

export function buildReport(kind: ReportKind, input: ReportInput, preset: RangePreset, custom: { from: string; to: string }, now = new Date()): ReportDoc {
  const range = resolveRange(preset, custom, now);
  const a = computeAnalytics(input, range);
  const meta = REPORT_KINDS.find((k) => k.kind === kind) as (typeof REPORT_KINDS)[number];
  const doc: ReportDoc = {
    kind, title: meta.label, generatedAt: now.toISOString(), source: input.source,
    range: { label: rangeLabel(preset, custom), from: range.from?.toISOString() ?? null, to: range.to?.toISOString() ?? null },
    sections: [], units: ["Currency: ₹ (INR)", "Distance: km", "Duration: minutes", "Energy: litres (L) for fuel vehicles, kWh for electric", "Emissions: kg CO₂e (tailpipe)"],
    assumptions: [], caveats: [],
  };
  if (input.source === "demo") doc.caveats.push("Demo data: every figure in this report is illustrative and does not describe real operations.");

  const planById = new Map(input.plans.map((p) => [p.id, p]));
  const delivered = new Map<string, number>();
  for (const e of input.events) if (e.type === "delivered" && e.plan_id && e.package_id) {
    delivered.set(e.plan_id, (delivered.get(e.plan_id) ?? 0) + 1);
  }
  const hasEvents = input.events.length > 0;

  switch (kind) {
    case "delivery_plan_summary": {
      const rows = a.plans.map((p): Cell[] => {
        const raw = planById.get(p.id);
        return [p.name, p.status, p.date, p.deliveries, hasEvents ? (delivered.get(p.id) ?? 0) : null, rd(p.distanceKm), nz(raw?.total_duration_min), rd(p.cost), rd(p.costPerDelivery), rd(p.emissionsKg)];
      });
      doc.sections.push({
        title: "Plans in range", columns: [T("Plan"), T("Status"), T("Start", "info", { type: "dt" }), N("Deliveries", "count", "planned", 0), N("Delivered events", "count", "observed", 0),
          N("Distance", "km", "planned"), N("Duration", "min", "planned", 0), R("Total cost", "planned"), R("Cost / delivery", "planned"), N("Emissions", "kg", "estimate")],
        rows, footer: rows.length ? ["Total", null, null, a.totals.deliveries, null, rd(a.totals.distanceKm), null, rd(a.totals.cost), rd(a.totals.costPerDelivery), rd(a.totals.emissionsKg)] : undefined,
        note: hasEvents ? undefined : "No delivery events are recorded, so observed delivery counts are blank rather than zero.",
      });
      const d = a.deadline;
      if (a.hasPlans) doc.sections.push({
        title: "Deadline compliance", note: "Only packages with a deadline are counted.",
        columns: [T("Measure"), N("On time", "packages", "observed", 0), N("Late / at risk", "packages", "observed", 0), { label: "Rate", type: "pct", basis: "observed", digits: 0 }],
        rows: [["Actual (delivered events)", d.actualOnTime, d.actualLate, d.actualRate], ["Planned (ETA vs deadline, not yet delivered)", d.plannedOnTime, d.plannedLate, d.plannedRate]],
      });
      doc.assumptions.push("Distance, duration and cost are the values stored on each saved plan. They are planned figures, not measured trips.", "Cancelled plans are excluded. Plans are filtered by start time, or creation time when there is no start time.");
      break;
    }
    case "vehicle_recommendation": {
      const used = new Map(a.vehicles.map((v) => [v.vehicleId, v]));
      const veh = input.vehicles.map((v) => {
        const energyPerKm = v.efficiency_value > 0 ? Number(v.energy_price) / v.efficiency_value : null;
        const total = energyPerKm === null ? null : energyPerKm + Number(v.operating_cost_per_km);
        return { v, energyPerKm, total };
      }).sort((x, y) => (x.total ?? Infinity) - (y.total ?? Infinity));
      doc.sections.push({
        title: "Vehicle profiles ranked by rated cost per km",
        note: "Rank uses energy cost per km plus operating cost per km only. The live recommender also weighs time, emissions, utilisation, payload/volume and deadlines per package.",
        columns: [N("Rank", "#", "estimate", 0), T("Vehicle"), T("Energy"), N("Payload", "kg", "profile", 0), N("Efficiency", "km/L or km/kWh", "profile"), R("Energy cost / km", "estimate", "₹/km"),
          R("Operating cost / km", "profile", "₹/km"), R("Rated cost / km", "estimate", "₹/km"), N("Emissions", "g/km", "profile", 0), T("Verification", "profile"), N("Assigned in plans", "packages", "observed", 0), { label: "Avg payload used", type: "pct", basis: "estimate", digits: 0 }],
        rows: veh.map(({ v, energyPerKm, total }, i): Cell[] => {
          const u = used.get(v.id);
          return [i + 1, v.name, v.energy_type, v.payload_kg, v.efficiency_value, rd(energyPerKm), rd(Number(v.operating_cost_per_km)), rd(total), v.emissions_g_per_km, v.verification, u ? u.assignments : 0, u ? u.avgUtilisation : null];
        }),
      });
      doc.assumptions.push("Recommendations are computed on demand and not stored, so this report cannot show historical recommendations. Assignment counts come from saved plans.", "Vehicles with verification \"assumed\" use unverified planning figures.");
      break;
    }
    case "route_cost_breakdown": {
      doc.sections.push({
        title: "Cost by plan", columns: [T("Plan"), T("Start", "info", { type: "dt" }), N("Deliveries", "count", "planned", 0), N("Distance", "km", "planned"), R("Total cost", "planned"), R("Cost / delivery", "planned"), R("Cost / km", "planned")],
        rows: a.plans.map((p): Cell[] => [p.name, p.date, p.deliveries, rd(p.distanceKm), rd(p.cost), rd(p.costPerDelivery), rd(p.costPerKm)]),
        footer: a.plans.length ? ["Total", null, a.totals.deliveries, rd(a.totals.distanceKm), rd(a.totals.cost), rd(a.totals.costPerDelivery), rd(a.totals.costPerKm)] : undefined,
      });
      const byId = new Map(input.vehicles.map((v) => [v.id, v]));
      doc.sections.push({
        title: "Estimated cost components by vehicle", note: "Components are recomputed from distance and vehicle profiles. They need not add up to the stored plan cost.",
        columns: [T("Vehicle"), N("Distance", "km", "estimate"), R("Energy cost", "estimate"), R("Operating cost", "estimate"), R("Energy + operating", "estimate")],
        rows: a.vehicles.map((v): Cell[] => {
          const op = v.distanceKm * Number(byId.get(v.vehicleId)?.operating_cost_per_km ?? 0);
          return [v.name, rd(v.distanceKm), rd(v.energyCost), rd(op), rd(v.energyCost + op)];
        }),
      });
      doc.assumptions.push("Plan cost is the stored total_cost; no cost is invented when a plan lacks one (shown as —).", "Energy cost = distance ÷ rated efficiency × energy price. Operating cost = distance × operating cost per km.");
      break;
    }
    case "mileage_energy": {
      doc.sections.push({
        title: "Distance and energy by vehicle",
        columns: [T("Vehicle"), T("Energy type"), N("Assigned", "packages", "planned", 0), N("Distance", "km", "estimate"), N("Energy used", "L or kWh", "estimate", 2), T("Energy unit"), R("Energy cost", "estimate"), N("Emissions", "kg CO₂e", "estimate"), T("Profile verification", "profile")],
        rows: a.vehicles.map((v): Cell[] => [v.name, v.energyType, v.assignments, rd(v.distanceKm), rd(v.energyUsed), v.energyUnit, rd(v.energyCost), rd(v.emissionsKg), v.verification]),
        footer: a.vehicles.length ? ["Total", null, sum(a.vehicles.map((v) => v.assignments)), rd(sum(a.vehicles.map((v) => v.distanceKm))), null, null, rd(a.totals.energyCost), rd(a.totals.emissionsKg), null] : undefined,
        note: `Fuel total ${rd(a.totals.energyByUnit.L)} L and electricity total ${rd(a.totals.energyByUnit.kWh)} kWh (units are not summed together).`,
      });
      if (a.anyEstimatedDistance) doc.assumptions.push("Some plans have no per-stop distance, so distance is split across vehicles in proportion to assigned packages (estimate).");
      doc.assumptions.push("No fuel or meter readings are stored. Energy = distance ÷ rated efficiency (km/L or km/kWh), so these are not observed consumption figures.", "Emissions use each profile's g/km; electric vehicles show tailpipe 0 and exclude grid emissions. Not a certified carbon account.");
      break;
    }
    case "optimization_comparison": {
      doc.sections.push({
        title: "Runs by solver", note: "Quantum figures come from a classical simulation of QAOA (Qiskit Aer). No quantum advantage is claimed.",
        columns: [T("Solver"), N("Runs", "count", "observed", 0), N("Succeeded", "count", "observed", 0), N("Failed / cancelled", "count", "observed", 0), N("Avg runtime", "ms", "observed", 0)],
        rows: a.solvers.every((s) => s.runs === 0) ? [] : a.solvers.map((s): Cell[] => [s.kind === "quantum" ? "Quantum (simulated)" : s.kind === "hybrid" ? "Hybrid (simulated QAOA + OR-Tools)" : "Classical (OR-Tools)", s.runs, s.succeeded, s.failed, rd(s.avgRuntimeMs, 0)]),
      });
      doc.sections.push({
        title: "Simulated quantum runs vs references", note: "Costs are in distance-matrix units (usually km).",
        columns: [T("Run", "info", { type: "dt" }), N("Stops", "count", "observed", 0), N("Quantum (sim.)", "cost", "observed", 2), N("Classical", "cost", "observed", 2), N("Brute force", "cost", "observed", 2), N("Gap vs brute force", "%", "observed", 1), T("Matches brute force", "observed")],
        rows: a.quantumRows.map((q): Cell[] => [q.created, q.nStops, rd(q.quantumCost), rd(q.classicalCost), rd(q.bruteForceCost), rd(q.gapPct, 1), q.matchesBruteForce === null ? null : q.matchesBruteForce ? "Yes" : "No"]),
      });
      doc.assumptions.push("Values are read from optimisation run results as the solvers reported them.");
      if (input.runsNote) doc.caveats.push(input.runsNote);
      break;
    }
    case "scenario_comparison": {
      const sc = input.scenarios.filter((s) => ranged(s.last_run_at ?? s.created_at, range));
      doc.sections.push({
        title: "Scenarios", note: "Scenarios that were never run have no result and show —.",
        columns: [T("Scenario"), T("Kind"), T("Last run", "info", { type: "dt" }), N("Distance", "km", "planned"), R("Total cost", "planned"), N("Packages", "count", "planned", 0), N("Unassigned / unserved", "count", "planned", 0), T("Solver status")],
        rows: sc.map((s): Cell[] => {
          const m = s.summary;
          return [s.name, s.kind, s.last_run_at, rd(num(m?.total_distance_km)), rd(num(m?.total_cost)), num(m?.packages), num(m?.unassigned) ?? num(m?.unserved), typeof m?.status === "string" ? m.status : null];
        }),
      });
      doc.assumptions.push("Scenarios are filtered by last run time (creation time if never run). Results are whatever was stored when the scenario was last run.");
      break;
    }
  }
  return doc;
}

export function reportHasData(doc: ReportDoc): boolean {
  return doc.sections.some((s) => s.rows.length > 0);
}

/* ------------------------------------------------------------------ formatting + CSV */
export function formatCell(c: Cell, col: Column): string {
  if (c === null || c === undefined || c === "") return "—";
  if (typeof c === "string") {
    if (col.type === "dt") { const d = new Date(c); return isNaN(+d) ? c : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
    return c;
  }
  if (col.type === "pct") return `${Math.round(c * 100)}%`;
  if (col.type === "inr") return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: col.digits ?? 2, maximumFractionDigits: col.digits ?? 2 }).format(c);
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: col.digits ?? 1 }).format(c);
}

/** Neutralise spreadsheet formula injection and quote per RFC 4180. Plain negative numbers are left alone. */
export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !Number.isFinite(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const colHeader = (c: Column) => `${c.label}${c.unit ? ` (${c.unit})` : ""} [${c.basis}]`;

export function reportToCsv(doc: ReportDoc): string {
  const lines: string[] = [];
  const meta = (k: string, v: string) => lines.push([csvCell(k), csvCell(v)].join(","));
  meta("Report", doc.title);
  meta("Generated at (UTC)", doc.generatedAt);
  meta("Date range", doc.range.label);
  meta("Data source", doc.source === "demo" ? "Demo data (illustrative)" : "RouteZen API");
  meta("Units", doc.units.join("; "));
  for (const s of doc.sections) {
    lines.push("");
    lines.push(csvCell(s.title));
    lines.push(s.columns.map((c) => csvCell(colHeader(c))).join(","));
    for (const r of s.rows) lines.push(r.map(csvCell).join(","));
    if (s.footer) lines.push(s.footer.map(csvCell).join(","));
  }
  lines.push("");
  for (const t of [...doc.assumptions, ...doc.caveats]) lines.push(csvCell(`Note: ${t}`));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function reportFilename(doc: ReportDoc, ext = "csv"): string {
  return `routezen-${doc.kind.replace(/_/g, "-")}-${doc.generatedAt.slice(0, 10)}.${ext}`;
}

export function downloadBlob(content: BlobPart, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download the backend export. Throws ApiError on failure. Not available in demo mode (no backend involved). */
export async function downloadBackendCsv(kind: "plans" | "vehicles"): Promise<string> {
  if (USE_DEMO_DATA) throw new ApiError("unavailable", "Backend export is unavailable in demo mode.");
  let res: Response;
  try { res = await fetch(`${API_BASE_URL}/reports/${kind}.csv`, { headers: { Accept: "text/csv" } }); }
  catch (e) { throw new ApiError("network", e instanceof Error ? e.message : "Network error"); }
  if (!res.ok) throw new ApiError("http", `Export failed (${res.status})`, { status: res.status });
  const name = `routezen-${kind}-export-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadBlob(await res.blob(), name, "text/csv");
  return name;
}
