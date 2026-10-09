import type { ClassicalRun, QuantumRun, RunRecord, VehicleProfileLite } from "@/lib/api/optimization";

/** Pure view-model derivations. Nothing here invents data: unknown values are `null`. */

export interface Ctx {
  names: Record<string, string>;
  vehicles: Record<string, VehicleProfileLite>;
}
export const stopName = (ctx: Ctx, id: string) => ctx.names[id] ?? id;

export interface VisitRow {
  seq: number; stopId: string; name: string; arrivalMin: number; departureMin: number; cumKm: number; loadKg: number; loadM3: number;
  deadlineMin: number | null; late: boolean | null; lat: number; lng: number;
}
export interface EnergyEstimate { amount: number; unit: "L" | "kWh"; cost: number | null; verification: string }
export interface RouteRow {
  vehicleId: string; vehicleName: string; visits: VisitRow[]; distanceKm: number; durationMin: number; cost: number; costPerDelivery: number | null;
  emissionsG: number; loadKg: number; payloadKg: number | null; payloadUtil: number | null; volumeUtil: number | null; energy: EnergyEstimate | null;
  lateCount: number; deadlineCount: number;
}
export interface ClassicalView {
  routes: RouteRow[];
  assigned: number; unassigned: { id: string; name: string; reason: string }[]; totalStops: number;
  totals: { distanceKm: number; durationMin: number; cost: number; costPerDelivery: number | null; emissionsG: number; energy: { L: number; kWh: number } | null };
  deadlines: { withDeadline: number; late: number; met: number };
}

export function deriveEnergy(distanceKm: number, v: VehicleProfileLite | undefined): EnergyEstimate | null {
  if (!v || !(v.efficiency_value > 0)) return null;
  const amount = distanceKm / v.efficiency_value;
  const unit = v.efficiency_unit === "km_per_kwh" ? "kWh" : v.efficiency_unit === "km_per_l" ? "L" : null;
  if (!unit) return null;
  const price = v.energy_price != null ? Number(v.energy_price) : NaN;
  return { amount, unit, cost: Number.isFinite(price) ? amount * price : null, verification: v.verification ?? "assumed" };
}

export function classicalView(run: ClassicalRun, ctx: Ctx): ClassicalView | null {
  const res = run.result;
  if (!res) return null;
  const stopsById = new Map(run.request.stops.map((s) => [s.id, s]));
  const reqVehicles = new Map(run.request.vehicles.map((v) => [v.vehicle_id, v]));
  let withDeadline = 0, late = 0;
  const routes: RouteRow[] = res.routes.map((r) => {
    const rv = reqVehicles.get(r.vehicle_id);
    let lateCount = 0, deadlineCount = 0;
    const visits: VisitRow[] = r.stops.map((v, i) => {
      const s = stopsById.get(v.stop_id);
      const deadline = s?.window_end_min ?? null;
      const isLate = deadline == null ? null : v.arrival_min > deadline + 1e-6;
      if (deadline != null) { deadlineCount++; if (isLate) lateCount++; }
      return {
        seq: i + 1, stopId: v.stop_id, name: stopName(ctx, v.stop_id), arrivalMin: v.arrival_min, departureMin: v.departure_min,
        cumKm: v.cumulative_distance_km, loadKg: v.load_kg, loadM3: v.load_m3, deadlineMin: deadline, late: isLate, lat: s?.latitude ?? NaN, lng: s?.longitude ?? NaN,
      };
    });
    withDeadline += deadlineCount; late += lateCount;
    return {
      vehicleId: r.vehicle_id, vehicleName: rv?.name || ctx.vehicles[r.vehicle_id]?.name || r.vehicle_id, visits,
      distanceKm: r.distance_km, durationMin: r.duration_min, cost: r.cost, costPerDelivery: visits.length ? r.cost / visits.length : null, emissionsG: r.emissions_g,
      loadKg: r.load_kg, payloadKg: rv?.payload_kg ?? null,
      payloadUtil: rv && rv.payload_kg > 0 ? r.load_kg / rv.payload_kg : null, volumeUtil: rv && rv.volume_m3 > 0 ? r.load_m3 / rv.volume_m3 : null,
      energy: deriveEnergy(r.distance_km, ctx.vehicles[r.vehicle_id]), lateCount, deadlineCount,
    };
  });
  const assigned = routes.reduce((n, r) => n + r.visits.length, 0);
  const energies = routes.map((r) => r.energy);
  const energyKnown = routes.length > 0 && energies.every((e) => e !== null);
  return {
    routes, assigned, totalStops: run.request.stops.length,
    unassigned: res.unassigned.map((u) => ({ id: u.stop_id, name: stopName(ctx, u.stop_id), reason: u.reason })),
    totals: {
      distanceKm: res.total_distance_km, durationMin: res.total_duration_min, cost: res.total_cost, costPerDelivery: assigned ? res.total_cost / assigned : null,
      emissionsG: res.total_emissions_g,
      energy: energyKnown ? { L: sumUnit(routes, "L"), kWh: sumUnit(routes, "kWh") } : null,
    },
    deadlines: { withDeadline, late, met: withDeadline - late },
  };
}
const sumUnit = (routes: RouteRow[], unit: "L" | "kWh") => routes.reduce((n, r) => n + (r.energy?.unit === unit ? r.energy.amount : 0), 0);

export interface QuantumView {
  unit: "km" | "min"; order: { seq: number; id: string; name: string }[]; bruteOrder: { seq: number; id: string; name: string }[];
  cost: number | null; bruteCost: number | null; gapPct: number | null; matches: boolean | null;
}
export function quantumView(run: QuantumRun, ctx: Ctx): QuantumView | null {
  const r = run.result;
  if (!r) return null;
  const toRows = (ids: string[]) => ids.map((id, i) => ({ seq: i + 1, id, name: stopName(ctx, id) }));
  // gap is recomputed only if the backend omitted it, never overridden
  const gap = r.gap_vs_brute_force_pct ?? (r.cost != null && r.brute_force_cost ? ((r.cost - r.brute_force_cost) / r.brute_force_cost) * 100 : null);
  return { unit: r.objective === "duration" ? "min" : "km", order: toRows(r.order), bruteOrder: toRows(r.brute_force_order), cost: r.cost ?? null, bruteCost: r.brute_force_cost ?? null, gapPct: gap, matches: r.matches_brute_force ?? null };
}

export interface Comparison {
  comparable: boolean; reason?: string; classicalKm?: number; quantumKm?: number; bruteKm?: number | null; quantumMinusClassicalKm?: number;
}
/** Mirrors backend GET /optimization/compare rules so it also works from already-loaded runs. */
export function compareRuns(c: ClassicalRun | undefined, q: QuantumRun | undefined): Comparison | null {
  if (!c?.result || !q?.result) return null;
  const cIds = new Set(c.result.routes.flatMap((r) => r.stops.map((s) => s.stop_id)));
  const qIds = new Set(q.result.order);
  const same = cIds.size === qIds.size && [...cIds].every((id) => qIds.has(id));
  if (!same || c.result.routes.length !== 1 || q.result.objective !== "distance" || q.result.cost == null) {
    return { comparable: false, reason: "These runs are not directly comparable (different stop sets, multiple vehicles, or a non-distance quantum objective)." };
  }
  return { comparable: true, classicalKm: c.result.total_distance_km, quantumKm: q.result.cost, bruteKm: q.result.brute_force_cost ?? null, quantumMinusClassicalKm: q.result.cost - c.result.total_distance_km };
}

export const runLabel = (r: RunRecord) => `${r.kind === "classical" ? "Classical" : "Quantum sim"} · ${r.id.slice(0, 8)}`;
export const pct = (v: number | null) => (v == null ? "n/a" : `${Math.round(v * 100)}%`);

/** Elapsed ms since a run was created (for the client-side "taking long" warning). */
export function ageMs(run: RunRecord, now = Date.now()): number {
  const t = Date.parse(run.created_at);
  return Number.isFinite(t) ? Math.max(0, now - t) : 0;
}
