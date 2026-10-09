"use client";
import { AlertCircle, Atom, Flag } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { USE_DEMO_DATA, type OptimizationRun, type PlanStop } from "@/lib/api";
import { formatDuration } from "@/lib/utils";

export function ResultsPanel({ run, stops, depotName }: { run: OptimizationRun | null; stops: PlanStop[]; depotName: string }) {
  if (!run) return <EmptyState title="No results yet" description="Run an optimization to see the visit order and metrics." className="py-10" />;
  const byId = new Map(stops.map((s) => [s.id, s]));
  return (
    <Card>
      <CardHeader title="Optimization Results" subtitle={run.algorithm.replaceAll("_", " ")} action={USE_DEMO_DATA ? <DemoBadge /> : undefined} />
      <div className="grid grid-cols-2 gap-2 p-4 pb-2">
        <Metric label={`Total distance${run.distance_is_estimate ? " (estimate)" : ""}`} value={run.distance_km != null ? `${Math.round(run.distance_km * 10) / 10} km` : "n/a"} />
        <Metric label="Est. time" value={run.duration_min != null ? formatDuration(run.duration_min) : "n/a"} />
      </div>
      {run.hybrid && (
        <section className="mx-4 mb-3 rounded-xl border border-violet-300/40 bg-violet-500/5 p-3 text-xs" aria-label="Hybrid solver outcome">
          <h3 className="flex items-center gap-1.5 font-semibold"><Atom className="size-3.5" /> Hybrid quantum-assisted outcome</h3>
          <p className="mt-1.5">{run.hybrid.selected === "quantum_seeded" ? "Quantum-seeded route selected after OR-Tools validation." : "Classical baseline retained because the quantum-seeded candidate did not improve the validated objective."}</p>
          <dl className="mt-2 grid grid-cols-2 gap-2">
            <div><dt className="text-muted-foreground">Improvement</dt><dd className="font-semibold">{run.hybrid.improvement_pct.toFixed(2)}%</dd></div>
            <div><dt className="text-muted-foreground">Clusters solved</dt><dd className="font-semibold">{run.hybrid.clusters_solved}/{run.hybrid.clusters_attempted}</dd></div>
          </dl>
          <p className="mt-2 text-muted-foreground">Qiskit Aer simulation, not quantum hardware. No quantum advantage is claimed.</p>
        </section>
      )}
      {(!run.routing_available || run.distance_is_estimate) && (
        <p role="status" className="mx-4 mb-2 flex items-start gap-1.5 rounded-lg bg-warning-soft px-2.5 py-2 text-[11px] font-medium">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          {run.distance_is_estimate ? "Distance uses a straight-line fallback estimate." : "Route geometry is unavailable here; see Optimization Results for per-vehicle routes."}
        </p>
      )}
      {run.simulated && !run.hybrid && <p className="mx-4 mb-2 text-[11px] text-muted-foreground">Quantum result produced by a Qiskit Aer simulator.</p>}
      <ol className="max-h-[360px] divide-y divide-border overflow-y-auto px-4 pb-3 text-sm" aria-label="Visit order">
        <li className="flex items-center gap-2 py-2"><Flag className="size-4 text-success" /><span className="font-semibold">{depotName}</span><Badge tone="success">Start</Badge></li>
        {run.order.map((id, i) => {
          const s = byId.get(id);
          return (
            <li key={id} className="flex items-center gap-2 py-2">
              <span className="grid size-6 place-items-center rounded-full bg-info text-[11px] font-bold text-white">{i + 1}</span>
              <span className="flex-1 truncate font-medium">{s?.name ?? id}</span>
              <span className="text-xs text-muted-foreground">{s?.weight_kg} kg</span>
            </li>
          );
        })}
      </ol>
      {run.notes.length > 0 && <ul className="list-disc space-y-0.5 px-8 pb-4 text-[11px] text-muted-foreground">{run.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="text-lg font-bold">{value}</div></div>;
}
