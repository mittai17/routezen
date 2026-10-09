import { describe, it, expect } from "vitest";
import {
  listTrips,
  getTrip,
  getTripPreferences,
  listCheckpoints,
  generateRouteOptions,
  listStays,
  listRestaurants,
  listAttractions,
  buildItinerary,
  getTripBudget,
} from "./travel";

describe("Smart Travel API Client (Demo Mode)", () => {
  it("lists trips including the Chennai to Leh flagship trip", async () => {
    const trips = await listTrips();
    expect(trips.length).toBeGreaterThan(0);
    const demoTrip = trips[0];
    expect(demoTrip.origin_name).toContain("Chennai");
    expect(demoTrip.destination_name).toContain("Leh");
    expect(demoTrip.adults).toBe(2);
  });

  it("fetches single trip details by ID", async () => {
    const trip = await getTrip("demo-trip-001");
    expect(trip).toBeDefined();
    expect(trip.id).toBe("demo-trip-001");
    expect(trip.travel_mode).toBe("car");
  });

  it("retrieves traveller preferences", async () => {
    const prefs = await getTripPreferences("demo-trip-001");
    expect(prefs).toBeDefined();
    expect(prefs.pace).toBe("balanced");
    expect(prefs.total_budget_inr).toBe(80000);
    expect(prefs.max_drive_hours_per_day).toBe(8);
  });

  it("fetches sequential checkpoints along the corridor", async () => {
    const checkpoints = await listCheckpoints("demo-trip-001");
    expect(checkpoints.length).toBeGreaterThanOrEqual(5);

    // Sequence check
    expect(checkpoints[0].type).toBe("origin");
    expect(checkpoints[0].name).toContain("Chennai");

    const lastCp = checkpoints[checkpoints.length - 1];
    expect(lastCp.type).toBe("destination");
    expect(lastCp.name).toContain("Leh");

    // Check mandatory vs overnight tags
    const overnightStops = checkpoints.filter((c) => c.stay_overnight);
    expect(overnightStops.length).toBeGreaterThan(0);
  });

  it("generates 3 route alternatives with comparative metrics", async () => {
    const routes = await generateRouteOptions("demo-trip-001");
    expect(routes.length).toBe(3);

    const recommended = routes.find((r) => r.label.includes("Recommended"));
    expect(recommended).toBeDefined();
    expect(recommended?.total_distance_km).toBeGreaterThan(2500);
    expect(recommended?.estimated_days).toBeGreaterThan(5);
    expect(recommended?.geometry.length).toBeGreaterThan(2);

    const fastest = routes.find((r) => r.label.includes("Fastest"));
    expect(fastest).toBeDefined();

    const scenic = routes.find((r) => r.label.includes("Scenic"));
    expect(scenic).toBeDefined();
  });

  it("discovers curated stays near checkpoints", async () => {
    const stays = await listStays("demo-trip-001");
    expect(stays.length).toBeGreaterThan(0);
    expect(stays[0].category).toBe("stay");
    expect(stays[0].price_min).toBeGreaterThan(0);
  });

  it("discovers local restaurants along corridor", async () => {
    const food = await listRestaurants("demo-trip-001");
    expect(food.length).toBeGreaterThan(0);
    expect(food[0].category).toBe("restaurant");
    expect(food[0].rating).toBeGreaterThan(4.0);
  });

  it("discovers attractions and sightseeing POIs", async () => {
    const attractions = await listAttractions("demo-trip-001");
    expect(attractions.length).toBeGreaterThan(0);
    expect(attractions[0].category).toBe("attraction");
    expect(attractions[0].estimated_visit_min).toBeDefined();
  });

  it("builds a day-wise schedule with timeline items", async () => {
    const itinerary = await buildItinerary("demo-trip-001");
    expect(itinerary.length).toBeGreaterThanOrEqual(3);
    const day1 = itinerary[0];
    expect(day1.day_number).toBe(1);
    expect(day1.items.length).toBeGreaterThan(0);
    expect(day1.drive_distance_km).toBeGreaterThan(0);
  });

  it("calculates comprehensive budget with transparent assumptions", async () => {
    const budget = await getTripBudget("demo-trip-001");
    expect(budget.target_budget_inr).toBe(80000);
    expect(budget.estimated_total_inr).toBeLessThanOrEqual(budget.target_budget_inr ?? 0);
    expect(budget.fuel_inr).toBeGreaterThan(0);
    expect(budget.accommodation_inr).toBeGreaterThan(0);
    expect(budget.meals_inr).toBeGreaterThan(0);
    expect(budget.contingency_inr).toBeGreaterThan(0);
    expect(budget.assumptions.length).toBeGreaterThan(0);
  });
});
