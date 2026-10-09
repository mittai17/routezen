/**
 * Live-tracking data layer. There is NO GPS feed: "tracking" is derived from planned ETAs plus manually reported
 * status events (POST /events). Nothing here fabricates a vehicle position.
 */
import { request, USE_DEMO_DATA } from "./client";
import { fetchAllItems, eventSchema, planSchema, type DeliveryEvent, type Plan } from "./analytics";
import { locationSchema, packageSchema, vehicleSchema } from "@/lib/schemas";
import type { Location, Package, VehicleProfile } from "./types";
import { DEPOT, demoLocations, demoPackages, demoVehicles } from "./mock/data";

export const EVENT_TYPES = ["route_started", "arrived", "delivered", "failed", "delayed", "route_completed"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const STOP_EVENT_TYPES: EventType[] = ["arrived", "delivered", "failed", "delayed"];
export const EVENT_LABEL: Record<string, string> = {
  route_started: "Route started", arrived: "Arrived at stop", delivered: "Delivered", failed: "Delivery failed", delayed: "Delayed", route_completed: "Route completed",
};

export interface TrackingData { source: "demo" | "api"; plans: Plan[]; packages: Package[]; vehicles: VehicleProfile[]; locations: Location[]; events: DeliveryEvent[] }

export interface NewEvent { plan_id: string; package_id?: string | null; vehicle_id?: string | null; type: EventType; message?: string | null; occurred_at: string }

/* ------------------------------------------------------------------ demo store */
let demoEvents: DeliveryEvent[] | null = null;
let demoPlans: Plan[] | null = null;
const MIN = 60_000;

function seedDemo() {
  if (demoPlans && demoEvents) return;
  const now = Date.now();
  const offsets = [-80, -50, -15, 20, 50];
  const veh = demoVehicles.find((v) => v.id === "veh-van") as VehicleProfile;
  const iso = (t: number) => new Date(t).toISOString();
  demoPlans = [{
    id: "demo-live-plan", name: "Demo route (Chennai)", status: "dispatched", depot_location_id: DEPOT.id, start_time: iso(now - 95 * MIN),
    total_distance_km: 41.2, total_duration_min: 190, total_cost: 612, total_emissions_g: null, notes: "Demo data", created_at: iso(now - 120 * MIN),
    assignments: offsets.map((o, k) => ({ vehicle_id: veh.id, package_id: demoPackages[k].id, sequence: k, eta: iso(now + o * MIN), distance_km: 8, cost: null })),
  }];
  demoEvents = [
    { id: "demo-e0", plan_id: "demo-live-plan", package_id: null, vehicle_id: veh.id, type: "route_started", message: "Demo data", occurred_at: iso(now - 92 * MIN), latitude: null, longitude: null },
    { id: "demo-e1", plan_id: "demo-live-plan", package_id: demoPackages[0].id, vehicle_id: veh.id, type: "delivered", message: "Demo data", occurred_at: iso(now - 84 * MIN), latitude: null, longitude: null },
    { id: "demo-e2", plan_id: "demo-live-plan", package_id: demoPackages[1].id, vehicle_id: veh.id, type: "delivered", message: "Demo data: customer not at gate, 12 min late", occurred_at: iso(now - 38 * MIN), latitude: null, longitude: null },
  ];
}

/* ------------------------------------------------------------------ api */
export async function loadTrackingData(): Promise<TrackingData> {
  if (USE_DEMO_DATA) {
    await new Promise((r) => setTimeout(r, 200));
    seedDemo();
    return { source: "demo", plans: structuredClone(demoPlans as Plan[]), packages: demoPackages, vehicles: demoVehicles, locations: demoLocations, events: structuredClone(demoEvents as DeliveryEvent[]) };
  }
  const [plans, packages, vehicles, locations, events] = await Promise.all([
    fetchAllItems("/plans", planSchema),
    fetchAllItems("/packages", packageSchema),
    fetchAllItems("/vehicles", vehicleSchema),
    fetchAllItems("/locations", locationSchema),
    fetchAllItems("/events", eventSchema),
  ]);
  return { source: "api", plans, packages, vehicles, locations, events };
}

export async function postEvent(ev: NewEvent): Promise<DeliveryEvent> {
  if (USE_DEMO_DATA) {
    seedDemo();
    await new Promise((r) => setTimeout(r, 150));
    const rec: DeliveryEvent = { id: `demo-e-${Math.random().toString(36).slice(2, 8)}`, plan_id: ev.plan_id, package_id: ev.package_id ?? null, vehicle_id: ev.vehicle_id ?? null, type: ev.type, message: ev.message ?? null, occurred_at: ev.occurred_at, latitude: null, longitude: null };
    (demoEvents as DeliveryEvent[]).push(rec);
    return rec;
  }
  return request("/events", { method: "POST", body: ev, schema: eventSchema });
}

/* ------------------------------------------------------------------ derivation */
export type StopStatus = "pending" | "arrived" | "delivered" | "failed" | "delayed";
export type DelayIndicator = "on_time" | "late" | "overdue" | "pending" | "no_eta";

export interface StopState {
  packageId: string; reference: string; recipient: string; address: string; sequence: number; vehicleId: string;
  lat: number | null; lng: number | null;
  plannedEta: number | null; status: StopStatus; actualAt: number | null; delayMin: number | null; indicator: DelayIndicator; lastMessage: string | null;
}
export type RouteState = "planned" | "dispatched" | "in_progress" | "completed";
export interface TrackingView {
  routeState: RouteState; stops: StopState[]; done: number; total: number; progress: number; late: number; overdue: number;
}
/** Minutes past ETA beyond which a stop counts as late. */
export const LATE_THRESHOLD_MIN = 5;

export function deriveTracking(plan: Plan, packages: Package[], events: DeliveryEvent[], now: number): TrackingView {
  const pById = new Map(packages.map((p) => [p.id, p]));
  const evs = events.filter((e) => e.plan_id === plan.id).sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));
  const stops: StopState[] = [...plan.assignments].sort((a, b) => a.sequence - b.sequence).map((a) => {
    const p = pById.get(a.package_id);
    const mine = evs.filter((e) => e.package_id === a.package_id && (STOP_EVENT_TYPES as string[]).includes(e.type));
    const last = mine[mine.length - 1];
    const status: StopStatus = last ? (last.type as StopStatus) : "pending";
    const eta = a.eta ? Date.parse(a.eta) : NaN;
    const plannedEta = isNaN(eta) ? null : eta;
    const terminal = mine.filter((e) => e.type === "delivered" || e.type === "failed").pop() ?? mine.find((e) => e.type === "arrived");
    const actualAt = terminal ? Date.parse(terminal.occurred_at) : null;
    const delayMin = plannedEta !== null && actualAt !== null ? Math.round((actualAt - plannedEta) / MIN) : null;
    let indicator: DelayIndicator = "pending";
    if (plannedEta === null) indicator = "no_eta";
    else if (delayMin !== null) indicator = delayMin > LATE_THRESHOLD_MIN ? "late" : "on_time";
    else if (status === "delayed" || now - plannedEta > LATE_THRESHOLD_MIN * MIN) indicator = "overdue";
    return {
      packageId: a.package_id, reference: p?.reference ?? a.package_id.slice(0, 8), recipient: p?.recipient ?? p?.address ?? "Unknown recipient", address: p?.address ?? "",
      sequence: a.sequence, vehicleId: a.vehicle_id, lat: p?.latitude ?? null, lng: p?.longitude ?? null,
      plannedEta, status, actualAt, delayMin, indicator, lastMessage: last?.message ?? null,
    };
  });
  const done = stops.filter((s) => s.status === "delivered" || s.status === "failed").length;
  const total = stops.length;
  const started = evs.some((e) => e.type === "route_started") || stops.some((s) => s.status !== "pending");
  let routeState: RouteState = "planned";
  if (plan.status === "completed" || evs.some((e) => e.type === "route_completed") || (total > 0 && done === total)) routeState = "completed";
  else if (started) routeState = "in_progress";
  else if (plan.status === "dispatched") routeState = "dispatched";
  return {
    routeState, stops, done, total, progress: total ? done / total : 0,
    late: stops.filter((s) => s.indicator === "late").length, overdue: stops.filter((s) => s.indicator === "overdue").length,
  };
}
