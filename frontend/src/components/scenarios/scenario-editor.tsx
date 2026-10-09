"use client";
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Switch, Textarea } from "@/components/ui/form-controls";
import type { TemplateContext } from "./scenario-form";
import { hasErrors, newRowKey, stopFromLocation, validateForm, type ScenarioForm, type StopRow } from "./scenario-form";

const REC_WEIGHTS = [["cost", "Cost"], ["time", "Travel time"], ["emissions", "Emissions"], ["utilisation", "Payload utilisation"]] as const;
const OPT_WEIGHTS = [["distance", "Distance"], ["time", "Time"], ["cost", "Cost"], ["emissions", "Emissions"]] as const;

interface EditorProps {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; initial: ScenarioForm; ctx: TemplateContext | null;
  saving: boolean; error?: string | null; onSave: (f: ScenarioForm) => void; canChangeKind?: boolean;
}

/** The form body mounts only while the dialog is open, so it starts from `initial` each time without effect-based resets. */
export function ScenarioEditor(props: EditorProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent title={props.title} description="Inputs are stored with the scenario, so every run uses exactly what you see here." className="max-w-3xl">
        <EditorForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function EditorForm({ onOpenChange, initial, ctx, saving, error, onSave, canChangeKind = true }: EditorProps) {
  const [f, setF] = React.useState<ScenarioForm>(initial);
  const [tried, setTried] = React.useState(false);

  const errors = React.useMemo(() => validateForm(f), [f]);
  const show = tried;
  const set = <K extends keyof ScenarioForm>(k: K, v: ScenarioForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const setRow = (key: string, patch: Partial<StopRow>) => setF((p) => ({ ...p, stops: p.stops.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const locations = ctx?.locations ?? [];
  const vehicles = ctx?.vehicles ?? [];
  const depots = [...locations].sort((a, b) => Number(b.type === "depot") - Number(a.type === "depot"));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!hasErrors(validateForm(f))) onSave(f);
  };

  return (
    <>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Name" htmlFor="sc-name" error={show ? errors.name : undefined}>
              <Input id="sc-name" value={f.name} maxLength={200} onChange={(e) => set("name", e.target.value)} aria-invalid={show && !!errors.name} autoFocus />
            </FormField>
            <FormField label="Type" htmlFor="sc-kind" hint={f.kind === "recommendation" ? "Picks the best vehicle for each package." : "Optimises routes across all stops with OR-Tools."}>
              <Select id="sc-kind" value={f.kind} disabled={!canChangeKind} onChange={(e) => set("kind", e.target.value as ScenarioForm["kind"])}>
                <option value="recommendation">Vehicle recommendation</option>
                <option value="classical">Route optimisation (OR-Tools)</option>
              </Select>
            </FormField>
            <FormField label="Description (optional)" htmlFor="sc-desc" className="sm:col-span-2">
              <Textarea id="sc-desc" value={f.description} rows={2} onChange={(e) => set("description", e.target.value)} />
            </FormField>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Depot</legend>
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
              <FormField label="Pick from locations" htmlFor="sc-depot-pick">
                <Select id="sc-depot-pick" value="" onChange={(e) => {
                  const l = locations.find((x) => x.id === e.target.value);
                  if (l) setF((p) => ({ ...p, depotLabel: l.name, depotLat: String(l.latitude), depotLng: String(l.longitude) }));
                }}>
                  <option value="">{f.depotLabel ? `Current: ${f.depotLabel}` : "Choose a location…"}</option>
                  {depots.map((l) => <option key={l.id} value={l.id}>{l.name}{l.type === "depot" ? " (depot)" : ""}</option>)}
                </Select>
              </FormField>
              <FormField label="Latitude" htmlFor="sc-depot-lat"><Input id="sc-depot-lat" inputMode="decimal" value={f.depotLat} onChange={(e) => set("depotLat", e.target.value)} aria-invalid={show && !!errors.depot} /></FormField>
              <FormField label="Longitude" htmlFor="sc-depot-lng"><Input id="sc-depot-lng" inputMode="decimal" value={f.depotLng} onChange={(e) => set("depotLng", e.target.value)} aria-invalid={show && !!errors.depot} /></FormField>
            </div>
            {show && errors.depot && <p role="alert" className="text-[11px] font-medium text-danger">{errors.depot}</p>}
          </fieldset>

          <fieldset className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="text-sm font-semibold">{f.kind === "classical" ? "Stops" : "Packages (one trip each)"} <span className="font-normal text-muted-foreground">({f.stops.length})</span></legend>
              <div className="flex flex-wrap items-center gap-2">
                <Select aria-label="Add stop from locations" className="h-8 w-48 text-xs" value="" onChange={(e) => {
                  const l = locations.find((x) => x.id === e.target.value);
                  if (l) setF((p) => ({ ...p, stops: [...p.stops, { ...stopFromLocation(l), label: uniqueLabel(l.name, p.stops) }] }));
                }}>
                  <option value="">Add from locations…</option>
                  {locations.filter((l) => l.type !== "depot").map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </Select>
                <Button size="sm" onClick={() => setF((p) => ({ ...p, stops: [...p.stops, { key: newRowKey(), label: uniqueLabel(`Stop ${p.stops.length + 1}`, p.stops), latitude: "", longitude: "", weight_kg: "10", service_minutes: "5" }] }))}><Plus />Custom stop</Button>
              </div>
            </div>
            {show && errors.stops && <p role="alert" className="text-[11px] font-medium text-danger">{errors.stops}</p>}
            <ul className="space-y-2">
              {f.stops.map((r, i) => (
                <li key={r.key} className="rounded-xl border border-border p-2">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_1fr_0.7fr_0.7fr_auto] sm:items-end">
                    <FormField label="Label" htmlFor={`${r.key}-l`} className="col-span-2 sm:col-span-1"><Input id={`${r.key}-l`} value={r.label} onChange={(e) => setRow(r.key, { label: e.target.value })} aria-invalid={show && !!errors.rows[r.key]} /></FormField>
                    <FormField label="Lat" htmlFor={`${r.key}-a`}><Input id={`${r.key}-a`} inputMode="decimal" value={r.latitude} onChange={(e) => setRow(r.key, { latitude: e.target.value })} /></FormField>
                    <FormField label="Lng" htmlFor={`${r.key}-o`}><Input id={`${r.key}-o`} inputMode="decimal" value={r.longitude} onChange={(e) => setRow(r.key, { longitude: e.target.value })} /></FormField>
                    <FormField label="kg" htmlFor={`${r.key}-w`}><Input id={`${r.key}-w`} inputMode="decimal" value={r.weight_kg} onChange={(e) => setRow(r.key, { weight_kg: e.target.value })} /></FormField>
                    <FormField label="Service min" htmlFor={`${r.key}-s`}><Input id={`${r.key}-s`} inputMode="decimal" value={r.service_minutes} onChange={(e) => setRow(r.key, { service_minutes: e.target.value })} /></FormField>
                    <Button variant="ghost" size="icon" aria-label={`Remove stop ${i + 1}: ${r.label}`} onClick={() => setF((p) => ({ ...p, stops: p.stops.filter((x) => x.key !== r.key) }))} className="col-span-2 justify-self-end sm:col-span-1"><Trash2 className="text-danger" /></Button>
                  </div>
                  {show && errors.rows[r.key] && <p role="alert" className="mt-1 text-[11px] font-medium text-danger">{errors.rows[r.key]}</p>}
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Vehicles</legend>
            <Switch checked={f.vehicleMode === "all"} onChange={(e) => set("vehicleMode", e.target.checked ? "all" : "selected")} label="Use the whole fleet (all available vehicles)" />
            {f.vehicleMode === "selected" && (
              <ul className="grid gap-1 sm:grid-cols-2">
                {vehicles.length === 0 && <li className="text-xs text-muted-foreground">No vehicle profiles loaded.</li>}
                {vehicles.map((v) => (
                  <li key={v.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                      <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.vehicleIds.includes(v.id)} onChange={(e) => set("vehicleIds", e.target.checked ? [...f.vehicleIds, v.id] : f.vehicleIds.filter((x) => x !== v.id))} />
                      <span className="min-w-0 truncate">{v.name}</span><span className="ml-auto text-[11px] text-muted-foreground">{v.energy_type}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {show && errors.vehicles && <p role="alert" className="text-[11px] font-medium text-danger">{errors.vehicles}</p>}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">{f.kind === "classical" ? "Objective weights" : "Scoring weights"}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(f.kind === "classical" ? OPT_WEIGHTS : REC_WEIGHTS).map(([k, label]) => {
                const w = f.kind === "classical" ? (f.optWeights as Record<string, string>) : (f.recWeights as Record<string, string>);
                return (
                  <FormField key={k} label={label} htmlFor={`sc-w-${k}`}>
                    <Input id={`sc-w-${k}`} inputMode="decimal" value={w[k]} aria-invalid={show && !!errors.weights}
                      onChange={(e) => set(f.kind === "classical" ? "optWeights" : "recWeights", { ...w, [k]: e.target.value } as never)} />
                  </FormField>
                );
              })}
            </div>
            {show && errors.weights ? <p role="alert" className="text-[11px] font-medium text-danger">{errors.weights}</p> : <p className="text-[11px] text-muted-foreground">Relative weights; the backend normalises them, so they need not sum to 1.</p>}
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
              {f.kind === "recommendation" ? (
                <>
                  <Switch checked={f.roundTrip} onChange={(e) => set("roundTrip", e.target.checked)} label="Bill round trip" />
                  <Switch checked={f.requireDeadline} onChange={(e) => set("requireDeadline", e.target.checked)} label="Require deadline feasibility" />
                </>
              ) : (
                <>
                  <Switch checked={f.returnToDepot} onChange={(e) => set("returnToDepot", e.target.checked)} label="Return to depot" />
                  <FormField label="Solver time limit (s)" htmlFor="sc-tl" error={show ? errors.timeLimit : undefined} className="w-40">
                    <Input id="sc-tl" inputMode="numeric" value={f.timeLimit} onChange={(e) => set("timeLimit", e.target.value)} aria-invalid={show && !!errors.timeLimit} />
                  </FormField>
                </>
              )}
              <Switch checked={f.allowFallback} onChange={(e) => set("allowFallback", e.target.checked)} label="Allow straight-line fallback if routing is down" />
            </div>
            {f.allowFallback && <p className="text-[11px] text-warning">Fallback distances are straight-line estimates and are labelled as such in results. Leave this off to get an error instead.</p>}
          </fieldset>

          {f.assumptions.length > 0 && (
            <div className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">Assumptions recorded with this scenario</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">{f.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
          )}

          {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save scenario"}</Button>
          </div>
        </form>
    </>
  );
}

function uniqueLabel(base: string, rows: StopRow[]): string {
  const used = new Set(rows.map((r) => r.label.trim()));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}
