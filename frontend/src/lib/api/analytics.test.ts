import { describe, expect, it } from "vitest";
import { buildDemoInput, computeAnalytics, resolveRange } from "./analytics";

const NOW = Date.parse("2026-06-01T12:00:00Z");
const ALL = { from: null, to: null };

describe("computeAnalytics", () => {
  const input = buildDemoInput(NOW);

  it("derives cost per delivery and per km from plan totals", () => {
    const r = computeAnalytics(input, ALL);
    const p = r.plans[0];
    expect(p.costPerDelivery).toBeCloseTo((p.cost as number) / p.deliveries, 6);
    expect(p.costPerKm).toBeCloseTo((p.cost as number) / (p.distanceKm as number), 6);
    expect(r.totals.plans).toBe(8);
  });

  it("filters by date range and excludes cancelled plans", () => {
    const week = computeAnalytics(input, resolveRange("7d", { from: "", to: "" }, new Date(NOW)));
    expect(week.totals.plans).toBeLessThan(8);
    const cancelled = { ...input, plans: input.plans.map((p) => ({ ...p, status: "cancelled" })) };
    const none = computeAnalytics(cancelled, ALL);
    expect(none.hasPlans).toBe(false);
    expect(none.totals.cost).toBeNull();
    expect(none.totals.costPerKm).toBeNull();
  });

  it("returns null (not zero) when data is missing", () => {
    const r = computeAnalytics({ ...input, plans: input.plans.map((p) => ({ ...p, total_cost: null, total_distance_km: null, assignments: p.assignments.map((a) => ({ ...a, distance_km: null })) })) }, ALL);
    expect(r.totals.cost).toBeNull();
    expect(r.totals.distanceKm).toBeNull();
    expect(r.plans.every((p) => p.costPerKm === null)).toBe(true);
  });

  it("uses delivered events for actual deadline compliance and ETAs for planned", () => {
    const r = computeAnalytics(input, ALL);
    expect(r.deadline.actualOnTime + r.deadline.actualLate).toBeGreaterThan(0);
    expect(r.deadline.actualRate).toBeGreaterThanOrEqual(0);
    expect(r.deadline.actualRate).toBeLessThanOrEqual(1);
  });

  it("summarises solver runs and quantum rows", () => {
    const r = computeAnalytics(input, ALL);
    expect(r.solvers.find((s) => s.kind === "quantum")?.runs).toBe(3);
    expect(r.quantumRows).toHaveLength(3);
  });
});

describe("resolveRange", () => {
  it("handles custom and invalid dates", () => {
    const r = resolveRange("custom", { from: "2026-01-01", to: "2026-01-31" });
    expect(r.from?.getFullYear()).toBe(2026);
    expect(resolveRange("custom", { from: "", to: "" })).toEqual({ from: null, to: null });
    expect(resolveRange("all", { from: "", to: "" })).toEqual({ from: null, to: null });
  });
});
