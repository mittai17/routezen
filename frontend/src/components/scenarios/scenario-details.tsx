"use client";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { deriveMetrics, isFeasible, isResultStale, readMeta, type Scenario } from "@/lib/api/scenarios";
import type { VehicleProfile } from "@/lib/api/types";
import { DASH, fmtCost, fmtEmissions, fmtKm, fmtTime, fmtWhen, KIND_LABEL } from "./format";
import { scenarioToForm } from "./scenario-form";

type Tab = "inputs" | "results" | "assumptions";
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(rec) : []);
const money = (v: unknown) => (v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export function ScenarioDetails({ scenario, vehicles, onOpenChange }: { scenario: Scenario | null; vehicles: VehicleProfile[]; onOpenChange: (o: boolean) => void }) {
  if (!scenario) return null;
  return <DetailsDialog key={scenario.id} scenario={scenario} vehicles={vehicles} onOpenChange={onOpenChange} />;
}

function DetailsDialog({ scenario, vehicles, onOpenChange }: { scenario: Scenario; vehicles: VehicleProfile[]; onOpenChange: (o: boolean) => void }) {
  const [tab, setTab] = React.useState<Tab>("inputs");
  const vName = (id: unknown, fallback?: unknown) => vehicles.find((v) => v.id === id)?.name ?? (typeof fallback === "string" ? fallback : String(id).slice(0, 8));
  const tabs: [Tab, string][] = [["inputs", "Stored inputs"], ["results", "Results"], ["assumptions", "Assumptions"]];

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={scenario.name} description={`${KIND_LABEL[scenario.kind]} · created ${fmtWhen(scenario.created_at)}`} className="max-w-3xl">
        <div role="tablist" aria-label="Scenario details" className="mb-4 flex gap-1 border-b border-border">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} id={`sd-tab-${k}`} aria-controls={`sd-panel-${k}`} onClick={() => setTab(k)}
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-semibold", tab === k ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</button>
          ))}
        </div>
        <div role="tabpanel" id={`sd-panel-${tab}`} aria-labelledby={`sd-tab-${tab}`}>
          {tab === "inputs" && <Inputs scenario={scenario} vName={vName} vehicles={vehicles} />}
          {tab === "results" && <Results scenario={scenario} vName={vName} />}
          {tab === "assumptions" && <Assumptions scenario={scenario} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Inputs({ scenario, vName, vehicles }: { scenario: Scenario; vName: (id: unknown) => string; vehicles: VehicleProfile[] }) {
  if (scenario.kind === "quantum") return <Raw config={scenario.config} />;
  const f = scenarioToForm(scenario);
  const w = f.kind === "classical" ? f.optWeights : f.recWeights;
  return (
    <div className="space-y-4 text-sm">
      {scenario.description && <p className="text-muted-foreground">{scenario.description}</p>}
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <Row k="Depot" v={`${f.depotLabel || "Custom"} (${f.depotLat}, ${f.depotLng})`} />
        <Row k="Fleet" v={f.vehicleMode === "all" ? "Whole fleet" : f.vehicleIds.map((id) => vName(id)).join(", ") || DASH} />
        <Row k="Weights" v={Object.entries(w).map(([k, v]) => `${k} ${v}`).join(" · ")} />
        {f.kind === "recommendation"
          ? <Row k="Options" v={`${f.roundTrip ? "Round trip billed" : "One way billed"} · deadlines ${f.requireDeadline ? "required" : "not required"}`} />
          : <Row k="Options" v={`${f.returnToDepot ? "Returns to depot" : "Open route"} · ${f.timeLimit}s solver limit`} />}
        <Row k="Straight-line fallback" v={f.allowFallback ? "Allowed (labelled as an estimate)" : "Not allowed (run fails if routing is down)"} />
        <Row k="Template" v={readMeta(scenario.config).template ?? "Custom"} />
      </dl>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[420px] text-left text-xs">
          <caption className="sr-only">Stops</caption>
          <thead className="bg-muted text-muted-foreground"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Label</th><th className="px-3 py-2">Latitude</th><th className="px-3 py-2">Longitude</th><th className="px-3 py-2 text-right">kg</th><th className="px-3 py-2 text-right">Service</th></tr></thead>
          <tbody>{f.stops.map((r, i) => <tr key={r.key} className="border-t border-border"><td className="px-3 py-1.5">{i + 1}</td><td className="px-3 py-1.5 font-medium">{r.label}</td><td className="px-3 py-1.5">{r.latitude}</td><td className="px-3 py-1.5">{r.longitude}</td><td className="px-3 py-1.5 text-right">{r.weight_kg}</td><td className="px-3 py-1.5 text-right">{r.service_minutes} min</td></tr>)}</tbody>
        </table>
      </div>
      {f.vehicleMode === "all" && vehicles.length > 0 && <p className="text-xs text-muted-foreground">Fleet at run time: {vehicles.map((v) => v.name).join(", ")}.</p>}
      <Raw config={scenario.config} />
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => <div><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>;
const Raw = ({ config }: { config: Record<string, unknown> }) => (
  <details className="rounded-xl border border-border px-3 py-2 text-xs"><summary className="cursor-pointer font-semibold">Raw stored config (JSON)</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(config, null, 2)}</pre></details>
);

function Results({ scenario, vName }: { scenario: Scenario; vName: (id: unknown, fb?: unknown) => string }) {
  const m = deriveMetrics(scenario.kind, scenario.result);
  if (!scenario.result || !m.hasResult) return <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">This scenario has not been run yet. Run it to see results returned by the backend.</p>;
  const stale = isResultStale(scenario);
  const feasible = isFeasible(m);
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Last run {fmtWhen(scenario.last_run_at)}</span>
        {stale && <Badge tone="warning">Inputs changed since this run, re-run to refresh</Badge>}
        {m.estimated && <Badge tone="warning">Includes straight-line estimates</Badge>}
        {feasible !== null && <Badge tone={feasible ? "success" : "danger"}>{feasible ? "Feasible" : "Not fully feasible"}</Badge>}
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat k="Cost" v={fmtCost(m.cost)} /><Stat k={m.basis === "optimised_routes" ? "Route distance" : "Distance (sum of trips)"} v={fmtKm(m.distanceKm)} />
        <Stat k={m.basis === "optimised_routes" ? "Route duration" : "Travel time (sum)"} v={fmtTime(m.timeMin)} /><Stat k="Emissions" v={fmtEmissions(m.emissionsG)} />
      </dl>
      {scenario.kind === "recommendation" ? <RecResults result={scenario.result} /> : <ClassicalResults result={scenario.result} vName={vName} />}
    </div>
  );
}
const Stat = ({ k, v }: { k: string; v: string }) => <div className="rounded-xl bg-muted px-3 py-2"><dt className="text-[11px] text-muted-foreground">{k}</dt><dd className="text-base font-bold">{v}</dd></div>;

function RecResults({ result }: { result: Record<string, unknown> }) {
  const recs = list(result.recommendations);
  return (
    <ul className="space-y-2">
      {recs.map((r, i) => {
        const best = r.recommended ? rec(r.recommended) : null;
        return (
          <li key={`${String(r.package_id)}-${i}`}>
            <details className="rounded-xl border border-border px-3 py-2">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold">{String(r.package_id ?? `Package ${i + 1}`)}</span>
                {best ? <><span>{String(best.name)}</span><span className="text-muted-foreground">{fmtCost(money(best.total_cost))} · {fmtKm(money(r.billed_distance_km ?? r.distance_km))} · {fmtTime(money(best.travel_minutes))}</span>
                  {best.deadline_feasible === false && <Badge tone="danger">Misses deadline</Badge>}</> : <Badge tone="danger">No eligible vehicle</Badge>}
                {r.fallback_estimate === true && <Badge tone="warning">Estimated distance</Badge>}
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">{String(r.explanation ?? "")}</p>
              {list(r.alternatives).length > 0 && (
                <div className="mt-2 text-xs"><div className="font-semibold">Alternatives</div>
                  <ul className="mt-1 space-y-0.5">{list(r.alternatives).map((a) => <li key={String(a.vehicle_id)}>{String(a.name)}: {fmtCost(money(a.total_cost))}, {fmtTime(money(a.travel_minutes))}, {fmtEmissions(money(a.emissions_g))}</li>)}</ul></div>
              )}
              {list(r.ineligible).length > 0 && (
                <div className="mt-2 text-xs"><div className="font-semibold">Ineligible</div>
                  <ul className="mt-1 space-y-0.5">{list(r.ineligible).map((a) => <li key={String(a.vehicle_id)}>{String(a.name)}: {(Array.isArray(a.reasons) ? a.reasons : []).join("; ")}</li>)}</ul></div>
              )}
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function ClassicalResults({ result, vName }: { result: Record<string, unknown>; vName: (id: unknown, fb?: unknown) => string }) {
  const opt = rec(result.optimization);
  const routes = list(opt.routes);
  const unassigned = list(opt.unassigned);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Solver status: <strong>{String(opt.status ?? DASH)}</strong> · distance source: {String(opt.distance_source ?? DASH)}{opt.runtime_ms != null ? ` · ${String(opt.runtime_ms)} ms` : ""}</p>
      {routes.map((r, i) => (
        <div key={i} className="rounded-xl border border-border px-3 py-2">
          <div className="font-semibold">{vName(r.vehicle_id)} <span className="font-normal text-muted-foreground">· {fmtKm(money(r.distance_km))} · {fmtTime(money(r.duration_min))} · {fmtCost(money(r.cost))} · {money(r.load_kg) ?? 0} kg</span></div>
          <ol className="mt-1 flex flex-wrap gap-1 text-xs">{list(r.stops).map((s, k) => <li key={k} className="rounded-full bg-muted px-2 py-0.5">{k + 1}. {String(s.stop_id)}</li>)}</ol>
        </div>
      ))}
      {unassigned.length > 0 && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-xs"><div className="font-semibold text-danger">Unassigned stops</div>
          <ul className="mt-1 space-y-0.5">{unassigned.map((u) => <li key={String(u.stop_id)}>{String(u.stop_id)}: {String(u.reason)}</li>)}</ul></div>
      )}
    </div>
  );
}

function Assumptions({ scenario }: { scenario: Scenario }) {
  const own = readMeta(scenario.config).assumptions ?? [];
  const fromResult = new Set<string>();
  for (const r of list(scenario.result?.recommendations)) for (const a of Array.isArray(r.assumptions) ? r.assumptions : []) fromResult.add(String(a));
  const notes = Array.isArray(rec(scenario.result?.optimization).notes) ? (rec(scenario.result?.optimization).notes as unknown[]).map(String) : [];
  const none = own.length + fromResult.size + notes.length === 0;
  return (
    <div className="space-y-4">
      <Group title="Recorded with this scenario" items={own} />
      <Group title="Reported by the backend run" items={[...fromResult]} />
      <Group title="Solver notes" items={notes} />
      {none && <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">{scenario.result ? "The run did not report assumptions." : "Run the scenario to see the assumptions the backend reports."}</p>}
    </div>
  );
}

function Group({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return <div><h4 className="text-xs font-semibold">{title}</h4><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{items.map((a) => <li key={a}>{a}</li>)}</ul></div>;
}
