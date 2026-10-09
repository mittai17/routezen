import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
  __resetDemoScenarios, compareScenarios, createScenario, deleteScenario, deltaVs, deriveMetrics, isFeasible, isResultStale, listScenarios, loadFleet,
  readMeta, runScenario, updateScenario, type CompareEntry, type Scenario,
} from "@/lib/api/scenarios";
import { CompareView } from "./compare-view";
import { formToInput, hasErrors, scenarioToForm, TEMPLATES, validateForm } from "./scenario-form";

const option = (over: Record<string, unknown> = {}) => ({
  vehicle_id: "v1", name: "Electric scooter", energy_used: 0.2, energy_unit: "kWh", total_cost: "20.47", travel_minutes: 17, emissions_g: 0, deadline_feasible: true, ...over,
});
const recResult = (opts: Record<string, unknown>[], unserved = 0) => ({
  summary: {},
  recommendations: [
    ...opts.map((o, i) => ({ package_id: `p${i}`, recommended: o, billed_distance_km: 7, distance_km: 7, distance_source: "osrm", fallback_estimate: false })),
    ...Array.from({ length: unserved }, (_, i) => ({ package_id: `u${i}`, recommended: null, billed_distance_km: 9, distance_km: 9 })),
  ],
});

describe("deriveMetrics", () => {
  it("returns an empty, all-null metrics object when there is no result (never zeros)", () => {
    const m = deriveMetrics("recommendation", null);
    expect(m.hasResult).toBe(false);
    expect(m.cost).toBeNull();
    expect(m.energy).toBeNull();
    expect(isFeasible(m)).toBeNull();
  });

  it("sums recommendation results from the backend shape, splitting fuel and electric energy", () => {
    const m = deriveMetrics("recommendation", recResult([option(), option({ energy_unit: "L", energy_used: 1.5, total_cost: "30.00", emissions_g: 100 })]));
    expect(m.cost).toBeCloseTo(50.47);
    expect(m.distanceKm).toBe(14);
    expect(m.timeMin).toBe(34);
    expect(m.energy).toEqual({ L: 1.5, kWh: 0.2 });
    expect(m.emissionsG).toBe(100);
    expect(m.served).toBe(2);
    expect(isFeasible(m)).toBe(true);
  });

  it("reports unserved packages and deadline misses as infeasible, and nulls totals it cannot sum", () => {
    const m = deriveMetrics("recommendation", recResult([option({ deadline_feasible: false })], 1));
    expect(m.unserved).toBe(1);
    expect(m.deadlineMisses).toBe(1);
    expect(isFeasible(m)).toBe(false);
    const missing = deriveMetrics("recommendation", recResult([option({ travel_minutes: undefined })]));
    expect(missing.timeMin).toBeNull();
  });

  it("reads classical results and does not invent energy", () => {
    const m = deriveMetrics("classical", {
      summary: { total_distance_km: 34.1, total_cost: 52.97, unassigned: 1, status: "partial" },
      optimization: { status: "partial", total_distance_km: 34.1, total_duration_min: 60, total_cost: 52.97, total_emissions_g: 0, fallback_estimate: false, routes: [{ stops: [{ stop_id: "a" }, { stop_id: "b" }] }], unassigned: [{ stop_id: "c", reason: "x" }] },
    });
    expect(m).toMatchObject({ cost: 52.97, distanceKm: 34.1, timeMin: 60, served: 2, unserved: 1, items: 3, energy: null, basis: "optimised_routes" });
    expect(isFeasible(m)).toBe(false);
  });
});

describe("deltas", () => {
  const a = deriveMetrics("recommendation", recResult([option({ total_cost: "100" })]));
  const b = deriveMetrics("recommendation", recResult([option({ total_cost: "80" })]));
  const c = deriveMetrics("classical", { optimization: { status: "solved", total_cost: 80, total_distance_km: 1, routes: [], unassigned: [] } });

  it("computes absolute and percentage change with better/worse direction", () => {
    expect(deltaVs(a, b, "cost")).toMatchObject({ abs: -20, pct: -20, better: "better" });
    expect(deltaVs(b, a, "cost")).toMatchObject({ abs: 20, pct: 25, better: "worse" });
    expect(deltaVs(a, a, "cost")?.better).toBe("same");
  });
  it("refuses to compare different run types or missing values", () => {
    expect(deltaVs(a, c, "cost")).toBeNull();
    expect(deltaVs(a, deriveMetrics("recommendation", null), "cost")).toBeNull();
    expect(deltaVs(a, c, "energyL")).toBeNull();
  });
});

describe("stale results", () => {
  const base = { last_run_at: "2026-10-09T10:00:00Z" };
  it("flags results older than the last input edit", () => {
    expect(isResultStale({ ...base, config: { _routezen: { inputs_edited_at: "2026-10-09T11:00:00Z" } } })).toBe(true);
    expect(isResultStale({ ...base, config: { _routezen: { inputs_edited_at: "2026-10-09T09:00:00Z" } } })).toBe(false);
    expect(isResultStale({ last_run_at: null, config: {} })).toBe(false);
  });
});

describe("form <-> config", () => {
  const ctx = { locations: [
    { id: "d", name: "Depot", address: null, latitude: 13.08, longitude: 80.27, type: "depot" as const, zone: null, notes: null },
    ...["A", "B", "C", "D"].map((n, i) => ({ id: n, name: n, address: null, latitude: 13 + i / 100, longitude: 80.2, type: "stop" as const, zone: null, notes: null })),
  ], vehicles: [
    { id: "ev", name: "EV", category: "x", payload_kg: 50, volume_m3: 1, energy_type: "electric" as const, efficiency_value: 20, efficiency_unit: "km_per_kwh" as const, energy_price: 8, fixed_cost_per_delivery: 1, operating_cost_per_km: 1, avg_speed_kmph: 25, emissions_g_per_km: 0, range_km: 100, available: true, source: "t", verification: "assumed" as const },
  ] };

  it("builds a valid backend payload and round-trips it", () => {
    const f = TEMPLATES.find((t) => t.id === "ev-preference")!.build(ctx);
    expect(hasErrors(validateForm(f))).toBe(false);
    const input = formToInput(f);
    expect(input.kind).toBe("recommendation");
    expect(input.config.vehicle_ids).toEqual(["ev"]);
    expect((input.config.packages as unknown[]).length).toBe(3);
    expect((input.config.preferences as { weights: { cost: number } }).weights.cost).toBe(0.35);
    expect(readMeta(input.config).template).toBe("ev-preference");
    const back = scenarioToForm({ name: input.name, description: input.description, kind: input.kind, config: input.config });
    const again = formToInput(back, { config: input.config }).config;
    expect({ ...again, _routezen: { ...readMeta(again), archived: undefined } }).toEqual({ ...input.config, _routezen: { ...readMeta(input.config), archived: undefined } });
  });

  it("only bumps inputs_edited_at when inputs actually change", () => {
    const f = TEMPLATES[0].build(ctx);
    const first = formToInput(f, undefined, new Date("2026-01-01T00:00:00Z"));
    const same = formToInput(scenarioToForm({ ...first, kind: first.kind }), { config: first.config }, new Date("2026-02-01T00:00:00Z"));
    expect(readMeta(same.config).inputs_edited_at).toBe("2026-01-01T00:00:00.000Z");
    const edited = scenarioToForm({ ...first, kind: first.kind });
    edited.stops[0].weight_kg = "99";
    expect(readMeta(formToInput(edited, { config: first.config }, new Date("2026-02-01T00:00:00Z")).config).inputs_edited_at).toBe("2026-02-01T00:00:00.000Z");
  });

  it("builds classical payloads with stops/ids and removes recommendation keys", () => {
    const f = TEMPLATES.find((t) => t.id === "multi-stop-route")!.build(ctx);
    const input = formToInput(f);
    expect(input.kind).toBe("classical");
    expect(input.config.packages).toBeUndefined();
    expect((input.config.stops as { id: string }[])[0].id).toBe("A");
    expect(input.config.vehicle_ids).toBeUndefined();
  });

  it("validates inputs", () => {
    const f = TEMPLATES[0].build(ctx);
    f.name = " "; f.depotLat = "abc"; f.stops[1].label = f.stops[0].label; f.stops[2].weight_kg = "-1"; f.recWeights = { cost: "0", time: "0", emissions: "0", utilisation: "0" };
    const e = validateForm(f);
    expect(e.name).toBeTruthy(); expect(e.depot).toBeTruthy(); expect(e.weights).toBeTruthy();
    expect(Object.keys(e.rows)).toHaveLength(2);
    f.vehicleMode = "selected";
    expect(validateForm(f).vehicles).toBeTruthy();
  });

  it("marks templates unavailable instead of faking inputs, including the unsupported fuel-price what-if", () => {
    expect(TEMPLATES.find((t) => t.id === "higher-fuel-price")!.unavailable!(ctx)).toMatch(/no per-scenario price override/);
    expect(TEMPLATES[0].unavailable!({ locations: [], vehicles: [] })).toMatch(/depot/);
    expect(TEMPLATES.find((t) => t.id === "ev-preference")!.unavailable!({ ...ctx, vehicles: [] })).toBeTruthy();
    expect(TEMPLATES.find((t) => t.id === "extra-stops")!.unavailable!(ctx)).toBeNull();
  });
});

describe("demo-mode API flow (labelled demo engine)", () => {
  beforeEach(() => __resetDemoScenarios());

  it("creates, runs, updates, compares and deletes scenarios; unrun scenarios have no result", async () => {
    const { locations, vehicles } = await loadFleet();
    const ctx = { locations, vehicles };
    const mk = async (id: string) => createScenario(formToInput(TEMPLATES.find((t) => t.id === id)!.build(ctx)));
    const a = await mk("city-delivery");
    const b = await mk("lowest-emissions");
    expect(a.result).toBeNull();
    expect((await listScenarios())).toHaveLength(2);

    const ran = await runScenario(a.id);
    expect(ran.last_run_at).toBeTruthy();
    const m = deriveMetrics("recommendation", ran.result);
    expect(m.cost).toBeGreaterThan(0);
    expect(m.estimated).toBe(true);

    const cmp = await compareScenarios([a.id, b.id]);
    expect(cmp.scenarios.find((s) => s.id === b.id)?.result).toBeNull();

    await runScenario(b.id);
    const cmp2 = await compareScenarios([a.id, b.id]);
    expect(cmp2.scenarios.every((s) => s.result)).toBe(true);

    const upd = await updateScenario(a.id, { name: "renamed", description: null, kind: a.kind, config: a.config });
    expect(upd.name).toBe("renamed");
    await deleteScenario(b.id);
    expect(await listScenarios()).toHaveLength(1);
    await expect(runScenario(b.id)).rejects.toThrow();
  });

  it("runs a classical scenario and surfaces infeasibility rather than faking a route", async () => {
    const { locations, vehicles } = await loadFleet();
    const f = TEMPLATES.find((t) => t.id === "multi-stop-route")!.build({ locations, vehicles });
    f.stops.forEach((s) => (s.weight_kg = "99999"));
    const s = await createScenario(formToInput(f));
    const m = deriveMetrics("classical", (await runScenario(s.id)).result);
    expect(m.status).toBe("infeasible");
    expect(m.unserved).toBe(f.stops.length);
    expect(isFeasible(m)).toBe(false);
  });
});

describe("CompareView", () => {
  const sc = (id: string, name: string, result: Record<string, unknown> | null, kind: "recommendation" | "classical" = "recommendation"): CompareEntry => ({ id, name, kind, last_run_at: result ? "2026-10-09T10:00:00Z" : null, result, summary: null });
  const scenarios: Scenario[] = [];

  it("shows deltas vs the baseline and marks unrun scenarios without inventing numbers", () => {
    render(<CompareView entries={[sc("1", "Base", recResult([option({ total_cost: "100" })])), sc("2", "Cheaper", recResult([option({ total_cost: "80" })])), sc("3", "Unrun", null)]}
      scenarios={scenarios} baselineId="1" onBaseline={() => {}} onRun={() => {}} onClose={() => {}} />);
    const table = screen.getByRole("table");
    const costRow = within(table).getByRole("row", { name: /^Cost/ });
    expect(costRow).toHaveTextContent("₹100.00");
    expect(costRow).toHaveTextContent("₹80.00");
    expect(costRow).toHaveTextContent("−₹20.00 (−20%)");
    expect(within(costRow).getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText("Not run")).toBeInTheDocument();
  });

  it("hides deltas and warns when run types differ", () => {
    render(<CompareView entries={[sc("1", "Rec", recResult([option()])), sc("2", "Route", { optimization: { status: "solved", total_cost: 10, total_distance_km: 5, total_duration_min: 9, routes: [], unassigned: [] } }, "classical")]}
      scenarios={scenarios} baselineId="1" onBaseline={() => {}} onRun={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent(/different run types/);
    expect(screen.queryByText(/%\)/)).toBeNull();
  });
});
