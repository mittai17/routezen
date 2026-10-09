"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Atom, Cpu, Download, Printer, RefreshCw } from "lucide-react";
import { Badge, DemoBadge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { isApiError } from "@/lib/api";
import { isActiveStatus, optimizationApi, type ClassicalRun, type QuantumRun, type RunRecord } from "@/lib/api/optimization";
import { cn } from "@/lib/utils";
import { downloadCsv, runToCsv } from "./csv";
import { ageMs, classicalView, compareRuns, quantumView, runLabel, type Ctx } from "./model";
import { AssumptionsPanel, ClassicalOrder, ComparisonCards, QuantumOrder, RouteMapPanel, RouteMetrics, RunStatusBanner, SolverMeta, Unassigned } from "./panels";

const TABS = [["summary", "Summary"], ["order", "Visit order"], ["map", "Route map"], ["metrics", "Detailed metrics"], ["assumptions", "Assumptions"]] as const;
type Tab = (typeof TABS)[number][0];
const SLOW_MS = { classical: 90_000, quantum: 180_000 };

/** Run record that polls GET /optimization/runs/{id} while queued/running. */
function useLiveRun(id: string | undefined, listed: RunRecord | undefined) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["opt-run", id],
    queryFn: () => optimizationApi.getRun(id!),
    enabled: !!id && !!listed && isActiveStatus(listed.status),
    refetchInterval: (query) => (query.state.data && !isActiveStatus(query.state.data.status) ? false : 1500),
    refetchIntervalInBackground: true, staleTime: 0, retry: 1,
  });
  const live = q.data;
  const done = !!live && !isActiveStatus(live.status);
  React.useEffect(() => { if (done) void qc.invalidateQueries({ queryKey: ["opt-runs"] }); }, [done, qc]);
  // a terminal list row always beats a stale cached poll result
  const run = listed && !isActiveStatus(listed.status) ? listed : live ?? listed;
  return { run, pollError: q.error };
}

export function OptimizationResults() {
  const qc = useQueryClient();
  const demo = optimizationApi.demo;
  const runs = useQuery({
    queryKey: ["opt-runs"], queryFn: () => optimizationApi.listRuns(),
    refetchInterval: (q) => (q.state.data?.some((r) => isActiveStatus(r.status)) ? 3000 : false), refetchIntervalInBackground: true,
  });
  const names = useQuery({ queryKey: ["opt-names"], queryFn: () => optimizationApi.stopNames(), staleTime: 5 * 60_000 });
  const vehicles = useQuery({ queryKey: ["opt-vehicles"], queryFn: () => optimizationApi.vehicleProfiles(), staleTime: 5 * 60_000 });
  const ctx: Ctx = React.useMemo(() => ({ names: names.data ?? {}, vehicles: vehicles.data ?? {} }), [names.data, vehicles.data]);

  const [cPick, setCPick] = React.useState<string>("");
  const [qPick, setQPick] = React.useState<string>("");
  const [tab, setTab] = React.useState<Tab>("summary");
  const [stamp, setStamp] = React.useState("");
  React.useEffect(() => {
    const on = () => setStamp(new Date().toLocaleString());
    window.addEventListener("beforeprint", on);
    return () => window.removeEventListener("beforeprint", on);
  }, []);
  const [notice, setNotice] = React.useState<string | null>(null);

  const list = React.useMemo(() => runs.data ?? [], [runs.data]);
  const classicals = list.filter((r): r is ClassicalRun => r.kind === "classical");
  const quantums = list.filter((r): r is QuantumRun => r.kind === "quantum");
  const pickDefault = <T extends RunRecord>(rs: T[]) => rs.find((r) => r.status === "succeeded") ?? rs[0];
  const cListed = classicals.find((r) => r.id === cPick) ?? pickDefault(classicals);
  const qListed = quantums.find((r) => r.id === qPick) ?? pickDefault(quantums);
  const cLive = useLiveRun(cListed?.id, cListed);
  const qLive = useLiveRun(qListed?.id, qListed);
  const classical = cLive.run as ClassicalRun | undefined;
  const quantum = qLive.run as QuantumRun | undefined;

  const start = useMutation({
    mutationFn: (kind: "classical" | "quantum") => optimizationApi.start(kind),
    onSuccess: async (rec) => {
      setNotice(null);
      if (rec.kind === "classical") setCPick(rec.id); else setQPick(rec.id);
      await qc.invalidateQueries({ queryKey: ["opt-runs"] });
    },
    onError: (e) => setNotice(isApiError(e) ? e.userMessage : "Could not start the run."),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => optimizationApi.cancel(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["opt-runs"] }); void qc.invalidateQueries({ queryKey: ["opt-run"] }); },
    onError: (e) => setNotice(isApiError(e) ? e.userMessage : "Could not cancel the run."),
  });

  const cView = classical ? classicalView(classical, ctx) : null;
  const qView = quantum ? quantumView(quantum, ctx) : null;
  const cmp = compareRuns(classical?.status === "succeeded" ? classical : undefined, quantum?.status === "succeeded" ? quantum : undefined);

  const warnings = React.useMemo(() => {
    const w: string[] = [];
    const cr = classical?.result, qr = quantum?.result;
    if (cr) {
      if (cr.fallback_estimate) w.push("Classical distances are straight-line fallback estimates, not road distances; real road distance will be longer.");
      if (cr.status === "partial") w.push("Classical result is partial: some stops could not be assigned.");
      if (cr.status === "infeasible" || cr.status === "error") w.push(`Classical solver returned "${cr.status}".`);
      if (cView?.deadlines.late) w.push(`${cView.deadlines.late} stop${cView.deadlines.late > 1 ? "s arrive" : " arrives"} after its deadline.`);
      w.push(...cr.notes);
    }
    if (qr) {
      if (qr.fallback_estimate) w.push("Quantum distances are straight-line fallback estimates, not road distances.");
      if (!qr.feasible) w.push(`Quantum simulation did not return a valid tour (${qr.status.replaceAll("_", " ")}).`);
      else if (qr.matches_brute_force === false) w.push("QAOA simulation did not find the exact optimum; see the gap vs brute force.");
      w.push(...qr.feasibility_issues);
    }
    return w;
  }, [classical, quantum, cView]);

  const exportCsv = (run: RunRecord) => downloadCsv(`routezen-${run.kind}-${run.id.slice(0, 8)}.csv`, runToCsv(run, ctx, { demo }));

  const busy = (r?: RunRecord) => !!r && isActiveStatus(r.status);
  const slow = (r?: RunRecord) => !!r && busy(r) && ageMs(r) > SLOW_MS[r.kind];

  return (
    <div className="optimization-print space-y-4">
      <style>{`@media print{aside,header,nav,.lg\\:pl-\\[220px\\]>header{display:none!important}.lg\\:pl-\\[220px\\]{padding-left:0!important}main{padding:0!important}body{background:#fff!important}.optimization-print section,.optimization-print .rz-keep{break-inside:avoid}}`}</style>
      <PageHeader
        title="Optimization Results"
        description="Compare classical (OR-Tools) and quantum-simulated (Qiskit Aer QAOA) route optimisation, with an exact brute-force reference."
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {demo && <DemoBadge />}
            <Button variant="secondary" size="sm" onClick={() => void runs.refetch()} disabled={runs.isFetching}><RefreshCw className={cn("size-4", runs.isFetching && "animate-spin")} /> Refresh</Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()} disabled={!classical && !quantum}><Printer className="size-4" /> Print</Button>
          </div>
        }
      />
      <div className="hidden print:block text-sm">RouteZen optimisation report {demo ? "(Demo data)" : ""} - generated {stamp}</div>

      {notice && <p role="alert" className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 text-sm print:hidden"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />{notice}</p>}

      {runs.isPending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading optimization runs"><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : runs.isError ? (
        <ErrorState title="Could not load optimization runs" message={isApiError(runs.error) ? runs.error.userMessage : "Unexpected error."} onRetry={() => void runs.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title="No optimization runs yet" description="Run an optimisation from Plan Delivery, or start a sample run on four Chennai stops to see results here."
          action={<SampleButtons demo={demo} onStart={(k) => start.mutate(k)} pending={start.isPending} />} />
      ) : (
        <>
          <Card className="print:hidden">
            <CardHeader title="Runs" subtitle="Pick a classical and a quantum-simulation run to compare" action={<SampleButtons demo={demo} onStart={(k) => start.mutate(k)} pending={start.isPending} />} />
            <CardContent className="grid gap-3 md:grid-cols-2">
              <RunSelect id="pick-classical" label="Classical run (OR-Tools)" icon={<Cpu className="size-4" />} runs={classicals} value={cListed?.id ?? ""} onChange={setCPick} />
              <RunSelect id="pick-quantum" label="Quantum run (Aer simulation, max 4 stops)" icon={<Atom className="size-4" />} runs={quantums} value={qListed?.id ?? ""} onChange={setQPick} />
              {[classical, quantum].map((r) => r && (busy(r) || r.status !== "succeeded") && <div key={r.id} className="md:col-span-1"><RunStatusBanner run={r} slow={slow(r)} onCancel={() => cancel.mutate(r.id)} cancelling={cancel.isPending && cancel.variables === r.id} /></div>)}
              {(cLive.pollError || qLive.pollError) && <p role="alert" className="text-sm text-danger md:col-span-2">Lost contact while polling a run. Retrying automatically.</p>}
            </CardContent>
          </Card>

          <div role="tablist" aria-label="Result sections" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 print:hidden">
            {TABS.map(([k, label]) => (
              <button key={k} role="tab" type="button" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} onClick={() => setTab(k)}
                className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors", tab === k ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:bg-muted")}>{label}</button>
            ))}
          </div>

          <Panel id="summary" active={tab} title="Summary">
            <ComparisonCards classical={classical?.status === "succeeded" ? classical : undefined} quantum={quantum?.status === "succeeded" ? quantum : undefined} cView={cView} qView={qView} cmp={cmp} pending={{ classical: classical && classical.status !== "succeeded" ? classical.status : undefined, quantum: quantum && quantum.status !== "succeeded" ? quantum.status : undefined }} />
            {cView && classical?.status === "succeeded" && (
              <section aria-label="Classical totals" className="mt-4 space-y-3">
                <h3 className="text-sm font-semibold">Classical totals</h3>
                <RouteMetrics view={cView} demo={demo} />
              </section>
            )}
            <section aria-label="Warnings" className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">Warnings</h3>
              {warnings.length ? <ul className="space-y-1.5">{warnings.map((w) => <li key={w} className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />{w}</li>)}</ul> : <p className="text-sm text-muted-foreground">No warnings for the selected runs.</p>}
            </section>
            {cView && classical?.status === "succeeded" && <section aria-label="Unassigned stops" className="mt-4"><Unassigned view={cView} /></section>}
          </Panel>

          <Panel id="order" active={tab} title="Route sequence and assignments">
            {cView && classical?.status === "succeeded" ? <div className="space-y-2"><h3 className="flex items-center gap-2 text-sm font-semibold">Classical assignments <Badge tone="info">OR-Tools</Badge></h3><ClassicalOrder view={cView} /></div> : <p className="text-sm text-muted-foreground">No finished classical run selected.</p>}
            {quantum?.status === "succeeded" && qView && quantum.result && <div className="mt-6 space-y-2"><h3 className="flex items-center gap-2 text-sm font-semibold">Quantum simulation order <Badge tone="violet">Aer simulation</Badge></h3><QuantumOrder run={quantum} view={qView} /></div>}
          </Panel>

          <Panel id="map" active={tab} title="Route map">
            {classical?.status === "succeeded" || quantum?.status === "succeeded"
              ? <RouteMapPanel mounted={tab === "map"} classical={classical?.status === "succeeded" ? classical : undefined} quantum={quantum?.status === "succeeded" ? quantum : undefined} ctx={ctx} />
              : <p className="text-sm text-muted-foreground">No finished run to map.</p>}
          </Panel>

          <Panel id="metrics" active={tab} title="Detailed metrics and solver metadata">
            {cView && classical?.status === "succeeded" && <div className="space-y-3"><h3 className="text-sm font-semibold">Classical per-vehicle metrics</h3><RouteMetrics view={cView} demo={demo} /></div>}
            {[classical, quantum].map((r) => r && <div key={r.id} className="mt-5 space-y-2 rz-keep"><h3 className="text-sm font-semibold">{r.kind === "classical" ? "Classical" : "Quantum simulation"} solver metadata <StatusPill status={r.status === "succeeded" ? "completed" : r.status} label={r.status.replace("_", " ")} /></h3><SolverMeta run={r} /></div>)}
          </Panel>

          <Panel id="assumptions" active={tab} title="Assumptions inspector">
            {[classical, quantum].map((r) => r && <div key={r.id} className="mb-6 space-y-2 rz-keep"><h3 className="text-sm font-semibold">{runLabel(r)}</h3><AssumptionsPanel run={r} ctx={ctx} demo={demo} /></div>)}
          </Panel>

          <div className="flex flex-wrap gap-2 print:hidden">
            {[classical, quantum].map((r) => r && r.result && <Button key={r.id} variant="secondary" size="sm" onClick={() => exportCsv(r)}><Download className="size-4" /> Export {r.kind} CSV</Button>)}
          </div>
        </>
      )}
    </div>
  );
}

function Panel({ id, active, title, children }: { id: Tab; active: Tab; title: string; children: React.ReactNode }) {
  return (
    <Card role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className={cn(active === id ? "block" : "hidden print:block", "print:mb-4 print:border-0 print:shadow-none")}>
      <CardHeader title={title} />
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function RunSelect({ id, label, icon, runs, value, onChange }: { id: string; label: string; icon: React.ReactNode; runs: RunRecord[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold">{icon}{label}</label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={runs.length === 0}>
        {runs.length === 0 && <option value="">No runs</option>}
        {runs.map((r) => <option key={r.id} value={r.id}>{r.id.slice(0, 8)} - {r.status.replace("_", " ")} - {new Date(r.created_at).toLocaleString()}</option>)}
      </Select>
    </div>
  );
}

function SampleButtons({ demo, onStart, pending }: { demo: boolean; onStart: (k: "classical" | "quantum") => void; pending: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" disabled={demo || pending} title={demo ? "Disabled in demo mode" : undefined} onClick={() => onStart("classical")}>Run classical sample</Button>
      <Button size="sm" variant="secondary" disabled={demo || pending} title={demo ? "Disabled in demo mode" : undefined} onClick={() => onStart("quantum")}>Run quantum sample (4 stops)</Button>
    </div>
  );
}
