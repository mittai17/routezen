"use client";
import { Archive, ArchiveRestore, Copy, Eye, Loader2, Pencil, Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deriveMetrics, isFeasible, isResultStale, readMeta, type Scenario } from "@/lib/api/scenarios";
import { cn } from "@/lib/utils";
import { fmtCost, fmtKm, fmtTime, fmtWhen, KIND_LABEL } from "./format";

export interface ScenarioActions {
  onRun: (s: Scenario) => void; onView: (s: Scenario) => void; onEdit: (s: Scenario) => void; onDuplicate: (s: Scenario) => void;
  onArchive: (s: Scenario) => void; onDelete: (s: Scenario) => void; onToggleSelect: (s: Scenario) => void;
}

export function ScenarioCard({ s, selected, running, busy, actions }: { s: Scenario; selected: boolean; running: boolean; busy: boolean; actions: ScenarioActions }) {
  const meta = readMeta(s.config);
  const m = deriveMetrics(s.kind, s.result);
  const stale = isResultStale(s);
  const feasible = isFeasible(m);
  const quantum = s.kind === "quantum";
  const stops = Array.isArray(s.config.packages) ? s.config.packages.length : Array.isArray(s.config.stops) ? s.config.stops.length : null;

  return (
    <Card className={cn("flex flex-col p-4", selected && "ring-2 ring-brand", meta.archived && "opacity-75")}>
      <div className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[var(--brand)]" checked={selected} onChange={() => actions.onToggleSelect(s)} aria-label={`Select ${s.name} for comparison`} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold leading-tight" title={s.name}>{s.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tone="info">{KIND_LABEL[s.kind]}</Badge>
            {meta.template && <Badge>{meta.template}</Badge>}
            {meta.archived && <Badge tone="neutral">Archived</Badge>}
            {!m.hasResult ? <Badge tone="warning">Not run</Badge> : stale ? <Badge tone="warning">Stale result</Badge> : feasible === false ? <Badge tone="danger">Not fully feasible</Badge> : feasible ? <Badge tone="success">Feasible</Badge> : null}
            {m.estimated && <Badge tone="warning">Estimated distance</Badge>}
          </div>
        </div>
      </div>
      {s.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
      <div className="mt-3 text-[11px] text-muted-foreground">{stops !== null ? `${stops} stops · ` : ""}{Array.isArray(s.config.vehicle_ids) && s.config.vehicle_ids.length ? `${s.config.vehicle_ids.length} vehicle(s)` : "whole fleet"} · {m.hasResult ? `ran ${fmtWhen(s.last_run_at)}` : `created ${fmtWhen(s.created_at)}`}</div>
      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted px-3 py-2">
        <Metric k="Cost" v={fmtCost(m.cost)} /><Metric k="Distance" v={fmtKm(m.distanceKm)} /><Metric k="Time" v={fmtTime(m.timeMin)} />
      </dl>
      {stale && <p className="mt-2 text-[11px] text-warning">Inputs were edited after this run. Figures above are from the previous inputs until you re-run.</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" variant="primary" disabled={running || busy || quantum} onClick={() => actions.onRun(s)} title={quantum ? "Quantum scenarios must be run through the quantum optimisation endpoint" : undefined}>
          {running ? <Loader2 className="animate-spin" /> : <Play />}{running ? "Running…" : m.hasResult ? "Re-run" : "Run"}
        </Button>
        <Button size="sm" onClick={() => actions.onView(s)}><Eye />Details</Button>
        <Button size="sm" disabled={busy || quantum} onClick={() => actions.onEdit(s)} title={quantum ? "Editing quantum scenarios is not supported here" : undefined}><Pencil />Edit</Button>
        <Button size="sm" disabled={busy} onClick={() => actions.onDuplicate(s)}><Copy />Duplicate</Button>
        <Button size="sm" disabled={busy} onClick={() => actions.onArchive(s)}>{meta.archived ? <ArchiveRestore /> : <Archive />}{meta.archived ? "Restore" : "Archive"}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => actions.onDelete(s)} aria-label={`Delete ${s.name}`}><Trash2 className="text-danger" /></Button>
      </div>
    </Card>
  );
}
const Metric = ({ k, v }: { k: string; v: string }) => <div className="min-w-0"><dt className="text-[10px] text-muted-foreground">{k}</dt><dd className="truncate text-sm font-bold" title={v}>{v}</dd></div>;
