"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Fuel, Info, RefreshCw, SlidersHorizontal, Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge, DemoBadge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Switch } from "@/components/ui/form-controls";
import { ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { USE_DEMO_DATA } from "@/lib/api";
import {
  getLocationOptions, getSettings, getSystemStatus, normaliseWeights, saveSettings, settingsFormSchema, weightSum, weightsValid, type WorkspaceSettings,
} from "@/lib/api/settings";

type Draft = {
  workspace_name: string; default_depot_id: string; currency: WorkspaceSettings["currency"];
  petrol_price: string; diesel_price: string; cng_price: string; electricity_price: string;
  prefer_electric: boolean; round_trip: boolean; classical_time_limit_s: string;
  scoring_weights: Record<"cost" | "time" | "emissions" | "utilisation", string>;
  optimization_weights: Record<"distance" | "time" | "cost" | "emissions", string>;
};
const toDraft = (s: WorkspaceSettings): Draft => ({
  workspace_name: s.workspace_name, default_depot_id: s.default_depot_id, currency: s.currency,
  petrol_price: String(s.petrol_price), diesel_price: String(s.diesel_price), cng_price: String(s.cng_price), electricity_price: String(s.electricity_price),
  prefer_electric: s.prefer_electric, round_trip: s.round_trip, classical_time_limit_s: String(s.classical_time_limit_s),
  scoring_weights: Object.fromEntries(Object.entries(s.scoring_weights).map(([k, v]) => [k, String(v)])) as Draft["scoring_weights"],
  optimization_weights: Object.fromEntries(Object.entries(s.optimization_weights).map(([k, v]) => [k, String(v)])) as Draft["optimization_weights"],
});
const n = (v: string) => (v.trim() === "" ? NaN : Number(v));
const numRec = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, n(v)])) as Record<string, number>;

export function SettingsForm() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const locations = useQuery({ queryKey: ["location-options"], queryFn: getLocationOptions });
  const [draft, setDraft] = React.useState<Draft | null>(null);
  // Initialise the editable draft once from the loaded settings (adjust-state-during-render pattern).
  if (settings.data && !draft) setDraft(toDraft(settings.data));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const save = useMutation({
    mutationFn: saveSettings,
    onSuccess: (s) => { qc.setQueryData(["settings"], s); setDraft(toDraft(s)); setSavedAt(Date.now()); },
  });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setDraft((d) => (d ? { ...d, [k]: v } : d)); setSavedAt(null); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const candidate = {
      workspace_name: draft.workspace_name, default_depot_id: draft.default_depot_id, currency: draft.currency,
      petrol_price: n(draft.petrol_price), diesel_price: n(draft.diesel_price), cng_price: n(draft.cng_price), electricity_price: n(draft.electricity_price),
      prefer_electric: draft.prefer_electric, round_trip: draft.round_trip, classical_time_limit_s: n(draft.classical_time_limit_s),
      scoring_weights: numRec(draft.scoring_weights), optimization_weights: numRec(draft.optimization_weights),
    };
    const parsed = settingsFormSchema.safeParse(candidate);
    const errs: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) errs[i.path.join(".")] = i.message;
    if (!errs["scoring_weights"] && !weightsValid(candidate.scoring_weights)) errs.scoring_weights = `Weights must add up to 1 (currently ${weightSum(candidate.scoring_weights).toFixed(2)}).`;
    if (!errs["optimization_weights"] && !weightsValid(candidate.optimization_weights)) errs.optimization_weights = `Weights must add up to 1 (currently ${weightSum(candidate.optimization_weights).toFixed(2)}).`;
    setErrors(errs);
    if (Object.keys(errs).length || !parsed.success) return;
    save.mutate({ ...parsed.data, unit_system: "metric" });
  };

  const depots = (locations.data ?? []).filter((l) => l.type !== "stop");

  return (
    <>
      <PageHeader title="Settings" description="Workspace defaults, energy prices and optimisation preferences." actions={USE_DEMO_DATA ? <DemoBadge /> : undefined} />
      {settings.isLoading && <div role="status" aria-label="Loading settings" className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}
      {settings.isError && <ErrorState title="Could not load settings" message={settings.error instanceof Error ? settings.error.message : undefined} onRetry={() => settings.refetch()} />}
      {draft && (
        <form onSubmit={submit} noValidate className="space-y-4">
          {USE_DEMO_DATA && <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs">Demo mode: settings are kept in this browser only (local storage) and are not sent to a server.</p>}

          <Card>
            <CardHeader title="Workspace" icon={<Building2 />} subtitle="Single dev workspace. There are no user accounts." />
            <CardContent className="grid grid-cols-1 gap-4 pt-3 md:grid-cols-2">
              <FormField label="Workspace display name" htmlFor="workspace_name" error={errors.workspace_name}>
                <Input id="workspace_name" value={draft.workspace_name} maxLength={80} onChange={(e) => set("workspace_name", e.target.value)} aria-invalid={!!errors.workspace_name} />
              </FormField>
              <FormField label="Default depot" htmlFor="default_depot_id" hint={locations.isError ? "Locations could not be loaded." : depots.length === 0 && !locations.isLoading ? "No depot or warehouse locations yet. Add one under Locations." : undefined}>
                <Select id="default_depot_id" value={draft.default_depot_id} onChange={(e) => set("default_depot_id", e.target.value)}>
                  <option value="">None selected</option>
                  {draft.default_depot_id && !depots.some((d) => d.id === draft.default_depot_id) && <option value={draft.default_depot_id}>Unknown location ({draft.default_depot_id.slice(0, 8)})</option>}
                  {depots.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Currency" htmlFor="currency" hint="Display label only. Amounts are stored as entered; no exchange-rate conversion is applied.">
                <Select id="currency" value={draft.currency} onChange={(e) => set("currency", e.target.value as Draft["currency"])}>
                  <option value="INR">INR (₹)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option>
                </Select>
              </FormField>
              <FormField label="Units" htmlFor="units" hint="Fixed: distance in km, weight in kg, volume in m³, fuel in L, electricity in kWh, time in minutes.">
                <Input id="units" value="Metric" readOnly disabled />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Energy prices" icon={<Fuel />} subtitle={`Used as defaults when creating vehicle profiles. Price per litre (or per kWh) in ${draft.currency}.`} />
            <CardContent className="grid grid-cols-1 gap-4 pt-3 sm:grid-cols-2 xl:grid-cols-4">
              {(["petrol_price", "diesel_price", "cng_price", "electricity_price"] as const).map((k) => (
                <FormField key={k} label={{ petrol_price: "Petrol (per L)", diesel_price: "Diesel (per L)", cng_price: "CNG (per kg)", electricity_price: "Electricity (per kWh)" }[k]} htmlFor={k} error={errors[k]}>
                  <Input id={k} type="number" inputMode="decimal" min={0} step="0.01" value={draft[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errors[k]} />
                </FormField>
              ))}
              <p className="text-[11px] text-muted-foreground sm:col-span-2 xl:col-span-4">Prices are your own planning inputs. RouteZen does not fetch live fuel or tariff prices.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Recommendation preferences" icon={<SlidersHorizontal />} subtitle="How vehicle options are scored." />
            <CardContent className="space-y-4 pt-3">
              <Switch checked={draft.prefer_electric} onChange={(e) => set("prefer_electric", e.target.checked)} label="Prefer electric vehicles when options are close" />
              <WeightGroup legend="Scoring weights (must add up to 1)" keys={["cost", "time", "emissions", "utilisation"]} values={draft.scoring_weights} error={errors.scoring_weights} idPrefix="sw"
                onChange={(w) => set("scoring_weights", w as Draft["scoring_weights"])} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Optimisation defaults" icon={<SlidersHorizontal />} subtitle="Default objective weights for the classical solver." />
            <CardContent className="space-y-4 pt-3">
              <WeightGroup legend="Objective weights (must add up to 1)" keys={["distance", "time", "cost", "emissions"]} values={draft.optimization_weights} error={errors.optimization_weights} idPrefix="ow"
                onChange={(w) => set("optimization_weights", w as Draft["optimization_weights"])} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Classical solver time limit (seconds)" htmlFor="classical_time_limit_s" error={errors.classical_time_limit_s}>
                  <Input id="classical_time_limit_s" type="number" min={1} max={120} step={1} value={draft.classical_time_limit_s} onChange={(e) => set("classical_time_limit_s", e.target.value)} aria-invalid={!!errors.classical_time_limit_s} />
                </FormField>
                <div className="flex items-end pb-2"><Switch checked={draft.round_trip} onChange={(e) => set("round_trip", e.target.checked)} label="Return to depot after last stop" /></div>
              </div>
            </CardContent>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:mx-0 lg:rounded-xl lg:border">
            <Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save settings"}</Button>
            <Button variant="ghost" onClick={() => { if (settings.data) { setDraft(toDraft(settings.data)); setErrors({}); setSavedAt(null); } }}>Discard changes</Button>
            {savedAt && <span role="status" className="text-sm font-medium text-success">Settings saved.</span>}
            {save.isError && <span role="alert" className="text-sm font-medium text-danger">{save.error instanceof Error ? save.error.message : "Could not save settings."}</span>}
            {Object.keys(errors).length > 0 && <span role="alert" className="text-sm font-medium text-danger">Fix the highlighted fields to save.</span>}
          </div>
        </form>
      )}

      <div className="mt-4 space-y-4">
        <SystemStatusCard />
        <Card>
          <CardHeader title="Disclaimers" icon={<Info />} />
          <CardContent className="pt-2">
            <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
              <li>Vehicle specifications, prices and emission factors are planning assumptions unless a profile is marked measured or external.</li>
              <li>Road routes and distances come from the configured OSRM routing service. When it is unreachable, no route line is drawn and any straight-line distance is labelled as a fallback estimate.</li>
              <li>The quantum option is a classical simulation of QAOA (Qiskit Aer). It does not use quantum hardware and no quantum advantage is claimed.</li>
              <li>Map tiles are loaded from OpenStreetMap (street) and Esri (satellite); their usage policies apply.</li>
              <li>Emission figures are estimates, not certified carbon accounting.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function WeightGroup({ legend, keys, values, error, idPrefix, onChange }: {
  legend: string; keys: string[]; values: Record<string, string>; error?: string; idPrefix: string; onChange: (w: Record<string, string>) => void;
}) {
  const total = weightSum(numRec(values));
  const ok = Number.isFinite(total) && Math.abs(total - 1) < 0.005;
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold">{legend}</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {keys.map((k) => (
          <FormField key={k} label={k[0].toUpperCase() + k.slice(1)} htmlFor={`${idPrefix}-${k}`}>
            <Input id={`${idPrefix}-${k}`} type="number" min={0} max={1} step="0.05" value={values[k]} onChange={(e) => onChange({ ...values, [k]: e.target.value })} aria-invalid={!!error} />
          </FormField>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <span className={ok ? "text-success" : "font-medium text-danger"}>Total: {Number.isFinite(total) ? total.toFixed(2) : "—"}</span>
        {!ok && Number.isFinite(total) && total > 0 && (
          <Button size="sm" variant="secondary" onClick={() => onChange(Object.fromEntries(Object.entries(normaliseWeights(numRec(values))).map(([k, v]) => [k, String(v)])))}>Normalise to 1</Button>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-[11px] font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

const stateTone = (s?: string): Tone => (!s ? "neutral" : /^(ok|configured|reachable)/.test(s) ? "success" : /degraded|simulation/.test(s) ? "warning" : /unavailable|error|unreachable/.test(s) ? "danger" : "neutral");

function SystemStatusCard() {
  const q = useQuery({ queryKey: ["system-status"], queryFn: getSystemStatus, staleTime: 15_000 });
  const s = q.data;
  return (
    <Card>
      <CardHeader title="Routing, map and data sources" icon={<Activity />} subtitle="Live checks against /routing/status and /ready."
        action={<Button size="sm" variant="secondary" onClick={() => q.refetch()} disabled={q.isFetching}><RefreshCw className={q.isFetching ? "animate-spin" : ""} /> Re-check</Button>} />
      <CardContent className="pt-3">
        {q.isLoading && <Skeleton className="h-24" />}
        {q.isError && <p role="alert" className="text-sm text-danger">Status check failed: {q.error instanceof Error ? q.error.message : "unknown error"}</p>}
        {s?.demo && <p className="text-sm text-muted-foreground">Demo mode: no backend is contacted, so there are no live checks. Set <code>NEXT_PUBLIC_USE_DEMO_DATA=false</code> to use the real API.</p>}
        {s && !s.demo && (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Row label="API / readiness" value={s.ready?.status ?? s.readyError ?? "unknown"} tone={s.ready ? stateTone(s.ready.status) : "danger"} />
            <Row label="Database" value={s.ready?.db} tone={stateTone(s.ready?.db)} />
            <Row label="Routing (from /ready)" value={s.ready?.routing} tone={stateTone(s.ready?.routing)} />
            <Row label="Classical optimiser" value={s.ready?.optimizer} tone={stateTone(s.ready?.optimizer)} />
            <Row label="Quantum simulator" value={s.ready?.quantum} tone={stateTone(s.ready?.quantum)} />
            <Row label={`Routing provider${s.routing?.provider ? ` (${s.routing.provider})` : ""}`} value={s.routing ? (s.routing.reachable ? `reachable${s.routing.latency_ms != null ? `, ${Math.round(s.routing.latency_ms)} ms` : ""}` : `unreachable${s.routing.error ? `: ${s.routing.error}` : ""}`) : s.routingError ?? "unknown"} tone={s.routing ? (s.routing.reachable ? "success" : "danger") : "danger"} />
          </dl>
        )}
        {s && <p className="mt-3 text-[11px] text-muted-foreground">Checked {new Date(s.checkedAt).toLocaleTimeString()}. Map tiles: OpenStreetMap and Esri imagery, loaded directly by your browser.</p>}
      </CardContent>
    </Card>
  );
}
function Row({ label, value, tone }: { label: string; value?: string; tone: Tone }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5"><Badge tone={tone}>{value ?? "not reported"}</Badge></dd></div>;
}
