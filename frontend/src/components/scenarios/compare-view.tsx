"use client";
import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import {
  comparable, deltaVs, deriveMetrics, isFeasible, isResultStale, metricValue, type CompareEntry, type Delta, type MetricKey, type Scenario, type ScenarioMetrics,
} from "@/lib/api/scenarios";
import { DASH, fmtCost, fmtEmissions, fmtEnergy, fmtKm, fmtTime, KIND_LABEL } from "./format";

interface Row { key: MetricKey; label: string; fmt: (v: number | null) => string; fmtDelta: (abs: number) => string; hide?: (ms: ScenarioMetrics[]) => boolean; note?: string }
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
const withSign = (abs: number, f: (v: number) => string) => `${sign(abs)}${f(Math.abs(abs))}`;

const ROWS: Row[] = [
  { key: "cost", label: "Cost", fmt: (v) => fmtCost(v), fmtDelta: (a) => withSign(a, (x) => fmtCost(x)) },
  { key: "distanceKm", label: "Distance", fmt: (v) => fmtKm(v), fmtDelta: (a) => withSign(a, (x) => fmtKm(x)) },
  { key: "timeMin", label: "Time", fmt: (v) => fmtTime(v), fmtDelta: (a) => withSign(a, (x) => fmtTime(x)) },
  { key: "energyL", label: "Fuel energy", fmt: (v) => fmtEnergy(v, "L"), fmtDelta: (a) => withSign(a, (x) => fmtEnergy(x, "L")), hide: (ms) => ms.every((m) => !m.energy || m.energy.L === 0) },
  { key: "energyKWh", label: "Electric energy", fmt: (v) => fmtEnergy(v, "kWh"), fmtDelta: (a) => withSign(a, (x) => fmtEnergy(x, "kWh")), hide: (ms) => ms.every((m) => !m.energy || m.energy.kWh === 0) },
  { key: "emissionsG", label: "Emissions", fmt: (v) => fmtEmissions(v), fmtDelta: (a) => withSign(a, (x) => fmtEmissions(x)) },
  { key: "unserved", label: "Unserved stops", fmt: (v) => (v === null ? DASH : String(v)), fmtDelta: (a) => withSign(a, (x) => String(x)) },
  { key: "deadlineMisses", label: "Deadline misses", fmt: (v) => (v === null ? DASH : String(v)), fmtDelta: (a) => withSign(a, (x) => String(x)), hide: (ms) => ms.every((m) => m.deadlineMisses === null) },
];

function DeltaChip({ d, row }: { d: Delta; row: Row }) {
  const Icon = d.better === "same" ? Minus : d.abs > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = d.better === "better" ? "text-success" : d.better === "worse" ? "text-danger" : "text-muted-foreground";
  return (
    <span className={cn("mt-0.5 flex items-center gap-0.5 text-[11px] font-medium", tone)}>
      <Icon className="size-3" aria-hidden />
      {d.better === "same" ? "No change" : `${row.fmtDelta(d.abs)}${d.pct !== null ? ` (${sign(d.pct)}${formatNumber(Math.abs(d.pct), 1)}%)` : ""}`}
      <span className="sr-only">{d.better === "same" ? "" : d.better === "better" ? " (better than baseline)" : " (worse than baseline)"}</span>
    </span>
  );
}

export function CompareView({ entries, scenarios, baselineId, onBaseline, onRun, onClose, note }: {
  entries: CompareEntry[]; scenarios: Scenario[]; baselineId: string; onBaseline: (id: string) => void; onRun: (s: Scenario) => void; onClose: () => void; note?: string | null;
}) {
  const cols = entries.map((e) => ({ e, m: deriveMetrics(e.kind, e.result), s: scenarios.find((s) => s.id === e.id) }));
  const base = cols.find((c) => c.e.id === baselineId) ?? cols[0];
  const kinds = new Set(cols.filter((c) => c.m.hasResult).map((c) => c.e.kind));
  const mixed = kinds.size > 1;
  const itemCounts = new Set(cols.filter((c) => c.m.hasResult).map((c) => c.m.items));
  const rows = ROWS.filter((r) => !r.hide?.(cols.map((c) => c.m)));
  const withResult = cols.filter((c) => c.m.hasResult);

  return (
    <Card aria-label="Scenario comparison">
      <CardHeader title="Comparison" subtitle="Values come from each scenario's stored backend run. Deltas are relative to the baseline column; lower is better for every metric." action={<Button size="sm" onClick={onClose}>Close</Button>} />
      <CardContent className="space-y-3">
        {mixed && <p role="status" className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">These scenarios are different run types ({[...kinds].map((k) => KIND_LABEL[k]).join(" vs ")}). Their totals are aggregated differently, so deltas are hidden. Compare scenarios of the same type for like-for-like deltas.</p>}
        {!mixed && itemCounts.size > 1 && <p role="status" className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">The scenarios cover different numbers of stops, so cost and distance differences partly reflect volume, not just strategy.</p>}
        {withResult.length < 2 && <p role="status" className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Run at least two of these scenarios to see deltas. Scenarios that have not been run show no figures; nothing is estimated for them.</p>}
        {note && withResult.length < cols.length && <p className="text-[11px] text-muted-foreground">{note}</p>}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">Comparison of selected scenarios</caption>
            <thead>
              <tr className="bg-muted/60 align-top">
                <th scope="col" className="sticky left-0 z-10 w-32 bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">Metric</th>
                {cols.map(({ e, s, m }) => (
                  <th key={e.id} scope="col" className="min-w-40 px-3 py-2">
                    <div className="font-semibold">{e.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] font-normal">
                      <Badge>{e.kind === "recommendation" ? "Recommend" : e.kind === "classical" ? "Route" : "Quantum"}</Badge>
                      {!m.hasResult && <Badge tone="warning">Not run</Badge>}
                      {s && isResultStale(s) && <Badge tone="warning">Stale</Badge>}
                      {m.estimated && <Badge tone="warning">Estimated</Badge>}
                    </div>
                    <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[11px] font-normal text-muted-foreground">
                      <input type="radio" name="baseline" className="accent-[var(--brand)]" checked={base?.e.id === e.id} onChange={() => onBaseline(e.id)} /> Baseline
                    </label>
                    {!m.hasResult && s && e.kind !== "quantum" && <Button size="sm" className="mt-1.5" onClick={() => onRun(s)}>Run now</Button>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-border align-top">
                  <th scope="row" className="sticky left-0 bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">{r.label}</th>
                  {cols.map(({ e, m }) => {
                    const v = metricValue(m, r.key);
                    const d = base && e.id !== base.e.id && !mixed ? deltaVs(base.m, m, r.key) : null;
                    return (
                      <td key={e.id} className="px-3 py-2">
                        <div className={cn("font-semibold", !m.hasResult && "text-muted-foreground")}>{m.hasResult ? (v === null ? <span title="Not reported by this run type">{DASH}</span> : r.fmt(v)) : DASH}</div>
                        {d && <DeltaChip d={d} row={r} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t border-border align-top">
                <th scope="row" className="sticky left-0 bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">Feasibility</th>
                {cols.map(({ e, m }) => {
                  const f = isFeasible(m);
                  return (
                    <td key={e.id} className="px-3 py-2">
                      {f === null ? <span className="text-muted-foreground">{DASH}</span> : <Badge tone={f ? "success" : "danger"}>{f ? "Feasible" : "Not fully feasible"}</Badge>}
                      {m.status && <div className="mt-0.5 text-[11px] text-muted-foreground">{m.status}</div>}
                      {m.served !== null && m.items !== null && <div className="text-[11px] text-muted-foreground">{m.served} of {m.items} served</div>}
                      {base && e.id !== base.e.id && comparable(base.m, m) && f !== null && isFeasible(base.m) !== null && f !== isFeasible(base.m) && (
                        <div className={cn("text-[11px] font-medium", f ? "text-success" : "text-danger")}>{f ? "Better than baseline" : "Worse than baseline"}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-t border-border align-top">
                <th scope="row" className="sticky left-0 bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">Distance basis</th>
                {cols.map(({ e, m }) => (
                  <td key={e.id} className="px-3 py-2 text-[11px] text-muted-foreground">
                    {!m.hasResult ? DASH : m.basis === "optimised_routes" ? "Optimised vehicle routes" : "Sum of single-package trips (not a combined route)"}
                    {m.hasResult && <div>{m.estimated ? "Includes straight-line estimates" : "Road routing"}</div>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
