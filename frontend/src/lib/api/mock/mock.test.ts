import { describe, expect, it } from "vitest";
import { mockOptimize, mockRecommend } from "./index";
import { demoPlanStops } from "./data";
import { haversineKm } from "./geo";
import { stopFormSchema } from "@/lib/schemas";
import { ApiError } from "../errors";

const depot = { id: "d", name: "Depot", lat: 13.0827, lng: 80.2757 };

describe("demo data layer", () => {
  it("haversine gives plausible Chennai distances", () => {
    const d = haversineKm({ lat: 13.0827, lng: 80.2757 }, { lat: 13.0418, lng: 80.2341 });
    expect(d).toBeGreaterThan(4); expect(d).toBeLessThan(8);
  });
  it("returns route geometry and order for optimization runs", async () => {
    const run = await mockOptimize({ stops: demoPlanStops, depot, algorithm: "classical_2opt", objective: "distance", max_vehicles: 2 });
    expect(run.geometry).toBeDefined();
    expect(new Set(run.order).size).toBe(demoPlanStops.length);
  });
  it("supports quantum simulated in demo mode", async () => {
    const run = await mockOptimize({ stops: demoPlanStops, depot, algorithm: "quantum_simulated", objective: "distance", max_vehicles: 2 });
    expect(run.status).toBe("completed");
    expect(run.simulated).toBe(true);
  });
  it("rules out vehicles that cannot carry the load", async () => {
    const recs = await mockRecommend({ stops: [demoPlanStops[2]], depot: { lat: depot.lat, lng: depot.lng } });
    expect(recs[0].ineligible.some((i) => i.vehicle_id === "veh-bike")).toBe(true);
    expect(recs[0].recommended).not.toBeNull();
  });
});

describe("stop form schema", () => {
  const ok = { name: "Adyar", latitude: "13.0012", longitude: "80.2565", zone_kind: "Residential", packages: "2", weight_kg: "4", priority: "low", window_start: "09:00", window_end: "18:00", service_minutes: "5", kind: "delivery" };
  it("coerces numeric strings", () => { expect(stopFormSchema.parse(ok).latitude).toBeCloseTo(13.0012); });
  it("rejects out-of-range latitude and bad windows", () => {
    expect(stopFormSchema.safeParse({ ...ok, latitude: "91" }).success).toBe(false);
    expect(stopFormSchema.safeParse({ ...ok, window_start: "18:00", window_end: "09:00" }).success).toBe(false);
  });
});
