import type { RunRecord } from "@/lib/api/optimization";
import { classicalView, quantumView, type Ctx } from "./model";

/** Neutralise spreadsheet formula injection (CWE-1236) for text cells, then RFC 4180 quote. */
export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
export const csvRow = (cells: (string | number | boolean | null | undefined)[]) => cells.map(csvCell).join(",");

export function runToCsv(run: RunRecord, ctx: Ctx, opts: { demo: boolean }): string {
  const rows: string[] = [];
  rows.push(csvRow(["RouteZen optimization export"]));
  rows.push(csvRow(["run_id", run.id]), csvRow(["kind", run.kind]), csvRow(["status", run.status]), csvRow(["created_at", run.created_at]), csvRow(["finished_at", run.finished_at]));
  if (opts.demo) rows.push(csvRow(["data_label", "Demo data"]));
  if (run.kind === "classical") {
    const res = run.result, v = classicalView(run, ctx);
    if (!res || !v) return rows.join("\r\n") + "\r\n";
    rows.push(csvRow(["solver", "OR-Tools VRP (classical)"]), csvRow(["solver_status", res.status]), csvRow(["distance_source", res.distance_source]), csvRow(["fallback_estimate", res.fallback_estimate]), csvRow(["runtime_ms", res.runtime_ms]));
    rows.push(csvRow(["total_distance_km", v.totals.distanceKm]), csvRow(["total_duration_min", v.totals.durationMin]), csvRow(["total_cost_inr", v.totals.cost]), csvRow(["cost_per_delivery_inr", v.totals.costPerDelivery]), csvRow(["total_emissions_g", v.totals.emissionsG]));
    rows.push("", csvRow(["vehicle_id", "vehicle", "sequence", "stop_id", "stop", "arrival_min", "departure_min", "cumulative_km", "load_kg", "deadline_min", "deadline_met", "route_distance_km", "route_duration_min", "route_cost_inr", "route_emissions_g", "payload_utilisation_pct", "energy_estimate", "energy_unit"]));
    for (const r of v.routes) for (const x of r.visits) {
      rows.push(csvRow([r.vehicleId, r.vehicleName, x.seq, x.stopId, x.name, x.arrivalMin, x.departureMin, x.cumKm, x.loadKg, x.deadlineMin, x.late === null ? "no deadline" : !x.late, r.distanceKm, r.durationMin, r.cost, r.emissionsG, r.payloadUtil == null ? null : Math.round(r.payloadUtil * 100), r.energy ? Number(r.energy.amount.toFixed(3)) : null, r.energy?.unit]));
    }
    rows.push("", csvRow(["unassigned_stop_id", "stop", "reason"]));
    for (const u of v.unassigned) rows.push(csvRow([u.id, u.name, u.reason]));
    for (const n of res.notes) rows.push(csvRow(["note", n]));
  } else {
    const res = run.result, v = quantumView(run, ctx);
    if (!res || !v) return rows.join("\r\n") + "\r\n";
    rows.push(csvRow(["solver", "QAOA on Qiskit Aer (classical SIMULATION; no quantum hardware; no advantage claimed)"]), csvRow(["solver_status", res.status]), csvRow(["objective", res.objective]), csvRow(["unit", v.unit]));
    rows.push(csvRow(["qubits", res.n_qubits]), csvRow(["reps", res.reps]), csvRow(["iterations", res.iterations]), csvRow(["shots", res.shots]), csvRow(["feasible", res.feasible]), csvRow(["feasible_probability", res.feasible_probability]), csvRow(["runtime_ms", res.runtime_ms]));
    rows.push(csvRow(["qaoa_cost", v.cost]), csvRow(["brute_force_cost", v.bruteCost]), csvRow(["gap_vs_brute_force_pct", v.gapPct]), csvRow(["matches_brute_force", v.matches]));
    rows.push("", csvRow(["sequence", "qaoa_stop_id", "qaoa_stop", "brute_force_stop_id", "brute_force_stop"]));
    const n = Math.max(v.order.length, v.bruteOrder.length);
    for (let i = 0; i < n; i++) rows.push(csvRow([i + 1, v.order[i]?.id, v.order[i]?.name, v.bruteOrder[i]?.id, v.bruteOrder[i]?.name]));
    for (const issue of res.feasibility_issues) rows.push(csvRow(["feasibility_issue", issue]));
  }
  return rows.join("\r\n") + "\r\n";
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
