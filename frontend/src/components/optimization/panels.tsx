"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Info, MapPinOff, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { MapView } from "@/components/maps/map-view";
import { cn, formatDuration, formatINR, formatNumber } from "@/lib/utils";
import { depotFor, optimizationApi, type ClassicalRun, type QuantumRun, type RunRecord } from "@/lib/api/optimization";
import { isApiError } from "@/lib/api";
import { pct, type ClassicalView, type Ctx, type QuantumView, type RouteRow, type Comparison, stopName } from "./model";

export function Metric({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "danger" | "success" }) {
  return (
    <div className="min-w-0 rounded-xl border border-border p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-bold leading-tight", tone === "danger" && "text-danger", tone === "success" && "text-success")}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

const Table = ({ head, children, label }: { head: string[]; children: React.ReactNode; label: string }) => (
  <div className="overflow-x-auto rounded-xl border border-border">
    <table className="w-full min-w-[520px] text-sm" aria-label={label}>
      <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr>{head.map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
      <tbody className="[&_td]:px-3 [&_td]:py-2 [&_tr]:border-t [&_tr]:border-border">{children}</tbody>
    </table>
  </div>
);

/* ------------------------------------------------------------ comparison */

export function ComparisonCards({ classical, quantum, cView, qView, cmp, pending }: { pending?: { classical?: string; quantum?: string }; classical?: ClassicalRun; quantum?: QuantumRun; cView: ClassicalView | null; qView: QuantumView | null; cmp: Comparison | null }) {
  const q = quantum?.result;
  const hybrid = classical?.kind === "hybrid";
  return (
    <section aria-label={`${hybrid ? "Hybrid" : "Classical"} versus quantum simulation`} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader title="Quantum (QAOA)" subtitle="Qiskit Aer SIMULATION - not quantum hardware" action={<Badge tone="violet">Simulation</Badge>} />
          <CardContent className="grid grid-cols-2 gap-2">
            {q && qView ? (
              <>
                <Metric label={`QAOA ${q.objective}`} value={qView.cost == null ? "n/a" : `${formatNumber(qView.cost, 2)} ${qView.unit}`} />
                <Metric label="Valid route" value={q.feasible ? "Yes" : "No"} tone={q.feasible ? "success" : "danger"} hint={`${(q.feasible_probability * 100).toFixed(3)}% of probability mass on valid tours`} />
                <Metric label="Compute time" value={`${formatNumber(q.runtime_ms / 1000, 1)} s`} hint={`${q.n_qubits} qubits, ${q.iterations} iterations`} />
                <Metric label="Stops" value={q.n_stops} hint={`reps ${q.reps}, ${q.shots} shots`} />
              </>
            ) : <p className="col-span-2 text-sm text-muted-foreground">{pending?.quantum ? `Selected run is ${pending.quantum.replace("_", " ")}; no result to show.` : "No quantum run selected."}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={hybrid ? "Hybrid (QAOA + OR-Tools)" : "Classical (OR-Tools)"} subtitle={hybrid ? "Aer-simulated cluster ordering, validated by OR-Tools" : "Vehicle-routing solver (metaheuristic)"} action={<Badge tone={hybrid ? "violet" : "info"}>{hybrid ? "Simulation" : "Classical"}</Badge>} />
          <CardContent className="grid grid-cols-2 gap-2">
            {cView && classical?.result ? (
              <>
                <Metric label="Total road distance" value={`${formatNumber(cView.totals.distanceKm, 1)} km`} hint={classical.result.fallback_estimate ? "straight-line fallback estimate" : classical.result.distance_source} />
                <Metric label="Total duration" value={formatDuration(cView.totals.durationMin)} />
                <Metric label="Compute time" value={`${formatNumber(classical.result.runtime_ms / 1000, 1)} s`} hint={`limit ${classical.result.time_limit_s}s`} />
                <Metric label="Assigned" value={`${cView.assigned}/${cView.totalStops}`} tone={cView.unassigned.length ? "danger" : "success"} />
              </>
            ) : <p className="col-span-2 text-sm text-muted-foreground">{pending?.classical ? `Selected run is ${pending.classical.replace("_", " ")}; no result to show.` : "No classical run selected."}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Brute force (exact)" subtitle="Exhaustive search on the quantum stop set" action={<Badge tone="success">Optimal</Badge>} />
          <CardContent className="grid grid-cols-2 gap-2">
            {q && qView && qView.bruteCost != null ? (
              <>
                <Metric label={`Optimal ${q.objective}`} value={`${formatNumber(qView.bruteCost, 2)} ${qView.unit}`} />
                <Metric label="QAOA gap" value={qView.gapPct == null ? "n/a" : `+${formatNumber(qView.gapPct, 2)}%`} tone={qView.matches ? "success" : qView.gapPct ? "danger" : undefined} hint={qView.matches ? "matches the optimum" : "longer than the optimum"} />
              </>
            ) : <p className="col-span-2 text-sm text-muted-foreground">{hybrid ? "Exact references for each small hybrid cluster appear in the hybrid summary." : "Brute-force reference is only produced by quantum runs."}</p>}
          </CardContent>
        </Card>
      </div>
      <p role="note" className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{q?.disclaimer ?? "Quantum figures come from a classical simulation of QAOA (Qiskit Aer). No quantum hardware was used and no quantum advantage is claimed."}</span>
      </p>
      {cmp && (
        <p className="rounded-xl border border-border px-3 py-2 text-sm" aria-live="polite">
          {cmp.comparable && cmp.quantumMinusClassicalKm !== undefined ? (
            <>
              <strong>Same stops, one vehicle:</strong> {hybrid ? "validated hybrid" : "OR-Tools"} {formatNumber(cmp.classicalKm ?? 0, 2)} km vs QAOA simulation {formatNumber(cmp.quantumKm ?? 0, 2)} km
              ({cmp.quantumMinusClassicalKm >= 0 ? "+" : ""}{formatNumber(cmp.quantumMinusClassicalKm, 2)} km{cmp.bruteKm != null ? `; exact optimum ${formatNumber(cmp.bruteKm, 2)} km` : ""}).
              The OR-Tools objective is weighted, so its distance is not guaranteed minimal. This compares solution quality only; it is not evidence of a quantum advantage.
            </>
          ) : <span className="text-muted-foreground">{cmp.reason}</span>}
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ classical detail */

export function ClassicalOrder({ view }: { view: ClassicalView }) {
  if (view.routes.length === 0) return <p className="text-sm text-muted-foreground">The solver produced no routes.</p>;
  return (
    <div className="space-y-5">
      {view.routes.map((r) => (
        <div key={r.vehicleId} className="space-y-2 break-inside-avoid">
          <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">{r.vehicleName}
            <Badge tone="neutral">{r.visits.length} stops</Badge>
            {r.deadlineCount > 0 && <Badge tone={r.lateCount ? "danger" : "success"}>{r.lateCount ? `${r.lateCount} late` : "deadlines met"}</Badge>}
          </h4>
          <Table label={`Visit order for ${r.vehicleName}`} head={["#", "Stop", "Arrive", "Depart", "Cum. km", "Load kg", "Deadline"]}>
            {r.visits.map((v) => (
              <tr key={v.stopId}>
                <td className="font-semibold">{v.seq}</td><td className="font-medium">{v.name}</td>
                <td>{formatDuration(v.arrivalMin)}</td><td>{formatDuration(v.departureMin)}</td>
                <td>{formatNumber(v.cumKm, 1)}</td><td>{formatNumber(v.loadKg, 1)}</td>
                <td>{v.deadlineMin == null ? <span className="text-muted-foreground">none</span> : <Badge tone={v.late ? "danger" : "success"}>{v.late ? "Late" : "On time"} (by {formatDuration(v.deadlineMin)})</Badge>}</td>
              </tr>
            ))}
          </Table>
        </div>
      ))}
    </div>
  );
}

export function RouteMetrics({ view, demo }: { view: ClassicalView; demo: boolean }) {
  const t = view.totals;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="Total road distance" value={`${formatNumber(t.distanceKm, 1)} km`} />
        <Metric label="Total duration (incl. service)" value={formatDuration(t.durationMin)} />
        <Metric label="Total cost" value={formatINR(t.cost, 2)} hint={demo ? "Demo data" : "variable + fixed, as supplied"} />
        <Metric label="Cost per delivery" value={t.costPerDelivery == null ? "n/a" : formatINR(t.costPerDelivery, 2)} hint={`over ${view.assigned} assigned stops`} />
        <Metric label="Energy (derived)" value={t.energy ? [t.energy.L ? `${formatNumber(t.energy.L, 2)} L` : null, t.energy.kWh ? `${formatNumber(t.energy.kWh, 2)} kWh` : null].filter(Boolean).join(" + ") || "0" : "n/a"} hint={t.energy ? "distance / vehicle-profile efficiency" : "needs a matching vehicle profile"} />
        <Metric label="Emissions" value={`${formatNumber(t.emissionsG / 1000, 2)} kg CO2`} hint="from per-km factor supplied" />
        <Metric label="Deadlines" value={view.deadlines.withDeadline ? `${view.deadlines.met}/${view.deadlines.withDeadline} met` : "none set"} tone={view.deadlines.late ? "danger" : undefined} />
        <Metric label="Unassigned" value={view.unassigned.length} tone={view.unassigned.length ? "danger" : "success"} />
      </div>
      <Table label="Per-vehicle metrics" head={["Vehicle", "Distance", "Duration", "Cost", "Cost / delivery", "Energy", "Payload use", "Volume use", "Deadlines"]}>
        {view.routes.map((r: RouteRow) => (
          <tr key={r.vehicleId}>
            <td className="font-medium">{r.vehicleName}</td><td>{formatNumber(r.distanceKm, 1)} km</td><td>{formatDuration(r.durationMin)}</td>
            <td>{formatINR(r.cost, 2)}</td><td>{r.costPerDelivery == null ? "n/a" : formatINR(r.costPerDelivery, 2)}</td>
            <td>{r.energy ? `${formatNumber(r.energy.amount, 2)} ${r.energy.unit}` : "n/a"}</td>
            <td><Util value={r.payloadUtil} /></td><td><Util value={r.volumeUtil} /></td>
            <td>{r.deadlineCount ? (r.lateCount ? <span className="font-semibold text-danger">{r.lateCount} late</span> : <span className="text-success">all met</span>) : "none set"}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function Util({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">n/a</span>;
  const over = value > 1 + 1e-9;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted print:border print:border-border" role="img" aria-label={`${pct(value)} utilised`}>
        <span className={cn("block h-full", over ? "bg-danger" : "bg-success")} style={{ width: `${Math.min(100, value * 100)}%` }} />
      </span>
      <span className={cn("text-xs font-semibold", over && "text-danger")}>{pct(value)}</span>
    </span>
  );
}

export function Unassigned({ view }: { view: ClassicalView }) {
  if (view.unassigned.length === 0) return <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" /> Every stop was assigned to a vehicle.</p>;
  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-danger"><XCircle className="size-4" /> {view.unassigned.length} unassigned / infeasible stop{view.unassigned.length > 1 ? "s" : ""}</h4>
      <Table label="Unassigned stops" head={["Stop", "Reason"]}>
        {view.unassigned.map((u) => <tr key={u.id}><td className="font-medium">{u.name}</td><td>{u.reason}</td></tr>)}
      </Table>
    </div>
  );
}

/* ------------------------------------------------------------ quantum detail */

export function QuantumOrder({ run, view }: { run: QuantumRun; view: QuantumView }) {
  const r = run.result!;
  const n = Math.max(view.order.length, view.bruteOrder.length);
  return (
    <div className="space-y-3">
      {!r.feasible && <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" /> No valid tour was sampled ({r.status.replaceAll("_", " ")}).{r.feasibility_issues.length ? ` ${r.feasibility_issues.join("; ")}` : ""}</p>}
      <Table label="QAOA simulation order versus brute force" head={["#", "QAOA simulation", "Brute-force optimum"]}>
        {Array.from({ length: n }, (_, i) => {
          const same = view.order[i] && view.order[i]?.id === view.bruteOrder[i]?.id;
          return <tr key={i}><td className="font-semibold">{i + 1}</td><td className="font-medium">{view.order[i]?.name ?? "-"}</td><td className={cn(!same && "text-muted-foreground")}>{view.bruteOrder[i]?.name ?? "-"}</td></tr>;
        })}
      </Table>
      <p className="text-xs text-muted-foreground">Tours start and end at {ctxDepot(run)}.</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="QAOA cost" value={view.cost == null ? "n/a" : `${formatNumber(view.cost, 2)} ${view.unit}`} />
        <Metric label="Brute-force cost" value={view.bruteCost == null ? "n/a" : `${formatNumber(view.bruteCost, 2)} ${view.unit}`} />
        <Metric label="Gap vs brute force" value={view.gapPct == null ? "n/a" : `${formatNumber(view.gapPct, 2)}%`} tone={view.matches ? "success" : "danger"} hint={view.matches ? "found the optimum" : "did not find the optimum"} />
        <Metric label="Valid-tour probability" value={`${(r.feasible_probability * 100).toFixed(3)}%`} hint="share of simulated shots/probability that are valid tours" />
      </div>
    </div>
  );
}
const ctxDepot = (run: RunRecord) => depotFor(run)?.name ?? "the depot";

/* ------------------------------------------------------------ run status */

const STATUS_COPY: Record<string, { tone: "info" | "danger" | "warning"; title: string; body: string }> = {
  queued: { tone: "info", title: "Queued", body: "Waiting for a solver worker." },
  running: { tone: "info", title: "Running", body: "The solver is working. This page updates automatically." },
  failed: { tone: "danger", title: "Run failed", body: "The solver reported an error." },
  cancelled: { tone: "warning", title: "Run cancelled", body: "This run was cancelled before it finished." },
  timed_out: { tone: "danger", title: "Run timed out", body: "The solver exceeded its time budget; any partial result is not shown." },
};
export function RunStatusBanner({ run, slow, onCancel, cancelling }: { run: RunRecord; slow: boolean; onCancel?: () => void; cancelling?: boolean }) {
  const c = STATUS_COPY[run.status];
  if (!c) return null;
  return (
    <div role={run.status === "failed" || run.status === "timed_out" ? "alert" : "status"} className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 text-sm", c.tone === "danger" ? "border-danger/30 bg-danger-soft" : c.tone === "warning" ? "border-warning/30 bg-warning-soft" : "border-info/30 bg-info-soft")}>
      {run.status === "queued" || run.status === "running" ? <Clock className="size-4 animate-pulse" /> : <AlertTriangle className="size-4" />}
      <div className="min-w-0 flex-1">
        <strong>{c.title}.</strong> {c.body}{run.error ? ` ${run.error}` : ""}
        {slow && <div className="text-xs">This is taking longer than usual. Quantum simulations can take over a minute; you can cancel and retry.</div>}
      </div>
      {onCancel && (run.status === "queued" || run.status === "running") && <button type="button" onClick={onCancel} disabled={cancelling} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold print:hidden">{cancelling ? "Cancelling..." : "Cancel run"}</button>}
    </div>
  );
}

/* ------------------------------------------------------------ map */

export function RouteMapPanel({ mounted, classical, quantum, ctx }: { mounted: boolean; classical?: ClassicalRun; quantum?: QuantumRun; ctx: Ctx }) {
  const options = React.useMemo(() => {
    const out: { key: string; label: string; ids: string[]; run: RunRecord }[] = [];
    classical?.result?.routes.forEach((r) => out.push({ key: `c:${r.vehicle_id}`, label: `Classical - ${classical.request.vehicles.find((v) => v.vehicle_id === r.vehicle_id)?.name || r.vehicle_id}`, ids: r.stops.map((s) => s.stop_id), run: classical }));
    if (quantum?.result?.feasible && quantum.result.order.length) out.push({ key: "q", label: "Quantum simulation (QAOA)", ids: quantum.result.order, run: quantum });
    return out;
  }, [classical, quantum]);
  const [sel, setSel] = React.useState("");
  const opt = options.find((o) => o.key === sel) ?? options[0];

  const depot = opt ? depotFor(opt.run) : null;
  const pts = React.useMemo(() => {
    if (!opt || !depot) return null;
    const byId = new Map(opt.run.request.stops.map((s) => [s.id, s]));
    const stops = opt.ids.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
    return { stops, coords: [{ lat: depot.latitude, lng: depot.longitude }, ...stops.map((s) => ({ lat: s.latitude, lng: s.longitude })), ...(opt.run.request.return_to_depot ? [{ lat: depot.latitude, lng: depot.longitude }] : [])] };
  }, [opt, depot]);

  const q = useQuery({
    queryKey: ["opt-road-route", opt?.run.id, opt?.key, pts?.coords.length],
    queryFn: () => optimizationApi.roadRoute(pts!.coords),
    enabled: !!pts && pts.stops.length > 0, retry: false, staleTime: 5 * 60_000,
  });

  if (!opt) return <Unavailable reason="There is no solved route to draw for the selected runs." />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <label htmlFor="map-route" className="text-xs font-semibold">Route</label>
        <Select id="map-route" value={opt.key} onChange={(e) => setSel(e.target.value)} className="max-w-xs">{options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</Select>
      </div>
      {!mounted ? <p className="hidden text-sm text-muted-foreground print:block">Open the Route map tab before printing to include the map.</p>
        : !pts ? <Unavailable reason="The depot location was not recorded with this run, so the route cannot be drawn." />
        : q.isPending && q.fetchStatus !== "idle" ? <Skeleton className="h-80 w-full" />
        : q.data ? (
          <>
            <div className="h-[320px] md:h-[420px] print:h-[360px]">
              <MapView depot={{ lat: depot!.latitude, lng: depot!.longitude, label: depot!.name }} stops={pts.stops.map((s, i) => ({ id: s.id, lat: s.latitude, lng: s.longitude, label: stopName(ctx, s.id), order: i + 1 }))} geometry={q.data.geometry} />
            </div>
            <p className="text-xs text-muted-foreground">Road geometry from {q.data.provider}: {formatNumber(q.data.distance_km, 1)} km, {formatDuration(q.data.duration_min)} driving (excludes service time).</p>
          </>
        ) : <Unavailable reason={q.error ? (isApiError(q.error) ? q.error.userMessage : "The routing provider failed.") : "No stops to route."} />}
    </div>
  );
}
function Unavailable({ reason }: { reason: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-input bg-muted/30 px-6 py-12 text-center">
      <MapPinOff className="size-7 text-muted-foreground" />
      <h4 className="font-semibold">Routing unavailable</h4>
      <p className="max-w-md text-sm text-muted-foreground">{reason} No route line is drawn: RouteZen never draws straight lines between stops as if they were roads.</p>
    </div>
  );
}

/* ------------------------------------------------------------ assumptions */

export function AssumptionsPanel({ run, ctx, demo }: { run: RunRecord; ctx: Ctx; demo: boolean }) {
  const req = run.request;
  const res = run.result;
  const vehicles = run.kind !== "quantum" ? req.vehicles : req.vehicle ? [req.vehicle] : [];
  const source = res && "distance_source" in res ? res.distance_source : null;
  const fallback = res && "fallback_estimate" in res ? res.fallback_estimate : false;
  const items: [string, React.ReactNode][] = [
    ["Data", demo ? "Demo data (illustrative, not solver output)" : "Backend run record"],
    ["Distance / duration source", <>{source ?? "n/a"}{fallback && <> - <strong className="text-warning">straight-line fallback estimate, not road distance</strong></>}</>],
    ["Return to depot", req.return_to_depot ? "Yes" : "No"],
    ...(run.kind !== "quantum" ? [
      ["Objective weights", req.weights ? Object.entries(req.weights).map(([k, v]) => `${k} ${v}`).join(", ") : "backend defaults (distance 0.4, time 0.3, cost 0.2, emissions 0.1)"] as [string, React.ReactNode],
      ["Solver time limit", res && "time_limit_s" in res ? `${res.time_limit_s} s` : "n/a"] as [string, React.ReactNode],
    ] : [
      ["Objective", String(req.objective ?? "distance")] as [string, React.ReactNode],
      ["QAOA settings", res && "n_qubits" in res ? `reps ${res.reps}, shots ${res.shots}, ${res.iterations} optimiser iterations (seed not recorded by the backend)` : "n/a"] as [string, React.ReactNode],
      ["Simulator", "Qiskit Aer statevector simulation on a classical computer; capped at 4 stops"] as [string, React.ReactNode],
    ]),
    ["Deadlines", "Per-stop deadline = minutes since route start, as supplied. A stop is late if arrival exceeds it."],
    ["Cost per delivery", "Route cost (per-km cost + fixed cost, as supplied in the request) divided by stops delivered on that route."],
    ["Energy", "Not returned by the solver. Derived as distance / vehicle-profile efficiency when the vehicle id matches a saved profile; otherwise n/a."],
    ["Capacity utilisation", "Route load / vehicle payload (and volume) from the request."],
  ];
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-[220px_1fr]">
        {items.map(([k, v]) => <React.Fragment key={k}><dt className="font-semibold">{k}</dt><dd className="min-w-0 break-words text-muted-foreground">{v}</dd></React.Fragment>)}
      </dl>
      {vehicles.length > 0 && (
        <Table label="Vehicle assumptions" head={["Vehicle", "Payload", "Volume", "Cost/km", "Fixed cost", "Emissions g/km", "Profile (energy)"]}>
          {vehicles.map((v) => {
            const p = ctx.vehicles[v.vehicle_id];
            return <tr key={v.vehicle_id}><td className="font-medium">{v.name || v.vehicle_id}</td><td>{v.payload_kg} kg</td><td>{v.volume_m3} m3</td><td>{formatINR(v.cost_per_km, 2)}</td><td>{formatINR(v.fixed_cost, 2)}</td><td>{v.emissions_g_per_km}</td>
              <td>{p ? <>{p.energy_type}, {p.efficiency_value} {p.efficiency_unit.replace("_per_", "/")} <Badge tone={p.verification === "measured" ? "success" : "warning"}>{p.verification ?? "assumed"}</Badge></> : <span className="text-muted-foreground">no matching profile</span>}</td></tr>;
          })}
        </Table>
      )}
      <details className="rounded-xl border border-border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-semibold">Raw request sent to the solver</summary>
        <pre className="mt-2 max-h-72 overflow-auto text-xs">{JSON.stringify(req, null, 2)}</pre>
      </details>
    </div>
  );
}

export function SolverMeta({ run }: { run: RunRecord }) {
  const res = run.result;
  const rows: [string, React.ReactNode][] = [
    ["Run id", <code key="i" className="break-all text-xs">{run.id}</code>], ["Status", run.status.replace("_", " ")],
    ["Created", new Date(run.created_at).toLocaleString()], ["Finished", run.finished_at ? new Date(run.finished_at).toLocaleString() : "n/a"],
  ];
  if (res && run.kind !== "quantum" && "routes" in res) rows.push(["Solver", `${run.kind === "hybrid" ? "QAOA simulation + OR-Tools validation" : "OR-Tools VRP"} (${res.solver}), result "${res.status}"`], ["Runtime", `${formatNumber(res.runtime_ms, 0)} ms of ${res.time_limit_s}s limit`], ["Objective value", res.objective == null ? "n/a" : formatNumber(res.objective, 0)]);
  if (res && run.kind === "quantum" && "n_qubits" in res) rows.push(["Solver", `QAOA on Qiskit Aer - simulation (${res.solver}), result "${res.status.replaceAll("_", " ")}"`], ["Runtime", `${formatNumber(res.runtime_ms, 0)} ms`], ["Circuit", `${res.n_qubits} qubits, reps ${res.reps}, ${res.iterations} optimiser iterations, ${res.shots} shots`]);
  return <dl className="grid gap-x-6 gap-y-1.5 text-sm md:grid-cols-[140px_1fr]">{rows.map(([k, v]) => <React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 font-medium">{v}</dd></React.Fragment>)}</dl>;
}
