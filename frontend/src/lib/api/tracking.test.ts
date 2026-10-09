import { describe, expect, it } from "vitest";
import { deriveTracking } from "./tracking";
import type { DeliveryEvent, Plan } from "./analytics";
import type { Package } from "./types";

const T0 = Date.parse("2026-06-01T10:00:00Z");
const MIN = 60_000;
const iso = (m: number) => new Date(T0 + m * MIN).toISOString();
const pkg = (id: string): Package => ({ id, reference: id, recipient: id, location_id: null, address: null, latitude: 13, longitude: 80, weight_kg: 1, priority: "low", handling: [], service_minutes: 5, kind: "delivery", status: "pending" } as Package);
const plan: Plan = {
  id: "p", name: "p", status: "dispatched", created_at: iso(0),
  assignments: [0, 1, 2].map((i) => ({ vehicle_id: "v", package_id: `k${i}`, sequence: i, eta: iso(30 * (i + 1)), distance_km: null, cost: null })),
};
const ev = (type: string, pk: string | null, m: number): DeliveryEvent => ({ id: `${type}${pk}${m}`, plan_id: "p", package_id: pk, vehicle_id: "v", type, occurred_at: iso(m) });
const pkgs = ["k0", "k1", "k2"].map(pkg);

describe("deriveTracking", () => {
  it("is dispatched with all stops pending when no events exist", () => {
    const v = deriveTracking(plan, pkgs, [], T0);
    expect(v.routeState).toBe("dispatched");
    expect(v.progress).toBe(0);
    expect(v.stops.every((s) => s.indicator === "pending")).toBe(true);
  });
  it("computes delay vs ETA and progress", () => {
    const v = deriveTracking(plan, pkgs, [ev("route_started", null, 0), ev("delivered", "k0", 28), ev("delivered", "k1", 75)], T0 + 80 * MIN);
    expect(v.routeState).toBe("in_progress");
    expect(v.done).toBe(2);
    expect(v.stops[0].indicator).toBe("on_time");
    expect(v.stops[1].delayMin).toBe(15);
    expect(v.stops[1].indicator).toBe("late");
    expect(v.late).toBe(1);
    expect(v.progress).toBeCloseTo(2 / 3);
  });
  it("flags overdue pending stops and completes when all are terminal", () => {
    const overdue = deriveTracking(plan, pkgs, [ev("delivered", "k0", 30)], T0 + 70 * MIN);
    expect(overdue.stops[1].indicator).toBe("overdue");
    const done = deriveTracking(plan, pkgs, [ev("delivered", "k0", 30), ev("failed", "k1", 60), ev("delivered", "k2", 90)], T0 + 100 * MIN);
    expect(done.routeState).toBe("completed");
    expect(done.progress).toBe(1);
  });
});
