"use client";
import * as React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Switch, Textarea } from "@/components/ui/form-controls";
import { describeWriteError, fieldErrorsFrom, type VehicleInput } from "@/lib/api/vehicles";
import {
  COMMON_CATEGORIES, ENERGY_LABEL, ENERGY_TYPES, VERIFICATIONS, VERIFICATION_HELP, VERIFICATION_LABEL, categoryLabel, efficiencyUnitLabel,
  emptyFormValues, parseVehicleForm, priceUnitLabel, specIssues, toFormValues, unitForEnergy, type EnergyType, type FormErrors, type Verification, type VehicleFormValues,
} from "./vehicle-utils";

export type FormMode = "create" | "edit" | "duplicate";

interface Props { onOpenChange: (o: boolean) => void; mode: FormMode; initial?: VehicleInput; categories: string[]; onSubmit: (data: VehicleInput) => Promise<void> }

const title = (mode: FormMode) => (mode === "edit" ? "Edit vehicle profile" : mode === "duplicate" ? "Duplicate vehicle profile" : "Add vehicle profile");

/** The body is mounted only while the dialog is open, so its state is freshly initialised from `initial` each time. */
export function VehicleFormDialog({ open, ...p }: Props & { open: boolean }) {
  return (
    <Dialog open={open} onOpenChange={p.onOpenChange}>
      <DialogContent title={title(p.mode)} description="Specifications used for cost, capacity and emissions estimates. This is a costing profile, not a tracked vehicle." className="max-w-2xl">
        <FormBody {...p} />
      </DialogContent>
    </Dialog>
  );
}

function FormBody({ onOpenChange, mode, initial, categories, onSubmit }: Props) {
  const [values, setValues] = React.useState<VehicleFormValues>(() => {
    const base = initial ? toFormValues(initial) : emptyFormValues();
    return mode === "duplicate" ? { ...base, name: `${base.name} (copy)` } : base;
  });
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const set = <K extends keyof VehicleFormValues>(k: K, v: VehicleFormValues[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };
  const energy = values.energy_type;
  const effUnit = efficiencyUnitLabel(unitForEnergy(energy));
  const priceUnit = priceUnitLabel(energy);
  const cats = Array.from(new Set([...COMMON_CATEGORIES, ...categories])).sort();

  // Live, non-blocking explanations of missing/weak specs.
  const preview = React.useMemo(() => {
    const p = parseVehicleForm(values);
    return p.ok ? specIssues(p.data).filter((i) => i.severity !== "info") : [];
  }, [values]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = parseVehicleForm(values);
    if (!p.ok) { setErrors(p.errors); setServerError("Fix the highlighted fields."); return; }
    setBusy(true); setServerError(null);
    try {
      await onSubmit(p.data);
      onOpenChange(false);
    } catch (err) {
      const fe = fieldErrorsFrom(err);
      if (Object.keys(fe).length) setErrors((x) => ({ ...x, ...fe }));
      setServerError(describeWriteError(err));
      setBusy(false);
    }
  }

  const f = (k: keyof VehicleFormValues) => ({ id: `veh-${k}`, "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `veh-${k}-error` : undefined });

  return (
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Name" htmlFor="veh-name" error={errors.name} className="sm:col-span-2">
              <Input {...f("name")} value={values.name} onChange={(e) => set("name", e.target.value)} maxLength={200} autoFocus />
            </FormField>
            <FormField label="Category" htmlFor="veh-category" error={errors.category} hint="Pick one or type your own, e.g. van or three_wheeler.">
              <Input {...f("category")} list="veh-category-list" value={values.category} onChange={(e) => set("category", e.target.value.toLowerCase().replace(/\s+/g, "_"))} maxLength={50} />
              <datalist id="veh-category-list">{cats.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}</datalist>
            </FormField>
            <FormField label="Energy type" htmlFor="veh-energy_type" error={errors.energy_type}>
              <Select {...f("energy_type")} value={energy} onChange={(e) => set("energy_type", e.target.value as EnergyType)}>
                {ENERGY_TYPES.map((t) => <option key={t} value={t}>{ENERGY_LABEL[t]}</option>)}
              </Select>
            </FormField>
            <FormField label="Payload (kg)" htmlFor="veh-payload_kg" error={errors.payload_kg}>
              <Input {...f("payload_kg")} inputMode="decimal" value={values.payload_kg} onChange={(e) => set("payload_kg", e.target.value)} />
            </FormField>
            <FormField label="Cargo volume (m³)" htmlFor="veh-volume_m3" error={errors.volume_m3}>
              <Input {...f("volume_m3")} inputMode="decimal" value={values.volume_m3} onChange={(e) => set("volume_m3", e.target.value)} />
            </FormField>
            <FormField label={`Efficiency (${effUnit})`} htmlFor="veh-efficiency_value" error={errors.efficiency_value}
              hint={energy === "electric" ? "Kilometres per kWh of electricity." : energy === "cng" ? "Kilometres per litre-equivalent; keep the price in the same unit." : "Kilometres per litre of fuel."}>
              <Input {...f("efficiency_value")} inputMode="decimal" value={values.efficiency_value} onChange={(e) => set("efficiency_value", e.target.value)} />
            </FormField>
            <FormField label={`Energy price (${priceUnit})`} htmlFor="veh-energy_price" error={errors.energy_price}>
              <Input {...f("energy_price")} inputMode="decimal" value={values.energy_price} onChange={(e) => set("energy_price", e.target.value)} />
            </FormField>
            <FormField label="Operating cost (₹/km)" htmlFor="veh-operating_cost_per_km" error={errors.operating_cost_per_km} hint="Non-energy: maintenance, tyres, driver, wear.">
              <Input {...f("operating_cost_per_km")} inputMode="decimal" value={values.operating_cost_per_km} onChange={(e) => set("operating_cost_per_km", e.target.value)} />
            </FormField>
            <FormField label="Fixed cost (₹/delivery)" htmlFor="veh-fixed_cost_per_delivery" error={errors.fixed_cost_per_delivery}>
              <Input {...f("fixed_cost_per_delivery")} inputMode="decimal" value={values.fixed_cost_per_delivery} onChange={(e) => set("fixed_cost_per_delivery", e.target.value)} />
            </FormField>
            <FormField label="Emissions factor (g CO₂/km)" htmlFor="veh-emissions_g_per_km" error={errors.emissions_g_per_km} hint="Tailpipe; 0 is expected for electric.">
              <Input {...f("emissions_g_per_km")} inputMode="decimal" value={values.emissions_g_per_km} onChange={(e) => set("emissions_g_per_km", e.target.value)} />
            </FormField>
            <FormField label="Average speed (km/h)" htmlFor="veh-avg_speed_kmph" error={errors.avg_speed_kmph}>
              <Input {...f("avg_speed_kmph")} inputMode="decimal" value={values.avg_speed_kmph} onChange={(e) => set("avg_speed_kmph", e.target.value)} />
            </FormField>
            <FormField label="Range (km, optional)" htmlFor="veh-range_km" error={errors.range_km} hint="Leave blank if unknown.">
              <Input {...f("range_km")} inputMode="decimal" value={values.range_km} onChange={(e) => set("range_km", e.target.value)} />
            </FormField>
            <FormField label="Verification" htmlFor="veh-verification" error={errors.verification} hint={VERIFICATION_HELP[values.verification]}>
              <Select {...f("verification")} value={values.verification} onChange={(e) => set("verification", e.target.value as Verification)}>
                {VERIFICATIONS.map((v) => <option key={v} value={v}>{VERIFICATION_LABEL[v]}</option>)}
              </Select>
            </FormField>
            <div className="flex items-end pb-1">
              <Switch label="Available for planning" checked={values.available} onChange={(e) => set("available", e.target.checked)} />
            </div>
            <FormField label="Data source" htmlFor="veh-source" error={errors.source} className="sm:col-span-2" hint="Where these figures came from (document, URL, trial dates).">
              <Textarea {...f("source")} value={values.source} onChange={(e) => set("source", e.target.value)} maxLength={2000} />
            </FormField>
          </div>

          {preview.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-warning/30 bg-warning-soft p-3 text-xs" aria-label="Spec warnings">
              {preview.map((i, n) => (
                <li key={n} className="flex gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" /><span>{i.message}</span></li>
              ))}
            </ul>
          )}
          {serverError && <p role="alert" className="flex gap-2 text-sm font-medium text-danger"><Info className="mt-0.5 size-4 shrink-0" />{serverError}</p>}
          <div className="flex justify-end gap-2">
            <Button onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : mode === "edit" ? "Save changes" : mode === "duplicate" ? "Create copy" : "Add vehicle"}</Button>
          </div>
        </form>
  );
}
