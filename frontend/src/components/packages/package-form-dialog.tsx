"use client";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/form-controls";
import type { Package } from "@/lib/api";
import type { PackageInput } from "@/lib/api/packages";
import { computeVolumeM3, isDuplicateReference, packageFormSchema, parseHandling, type PackageFormInput, type PackageFormValues } from "./package-schema";

const blank: PackageFormInput = {
  reference: "", recipient: "", address: "", weight_kg: "" as unknown as number, length_cm: "" as unknown as number, width_cm: "" as unknown as number,
  height_cm: "" as unknown as number, latitude: "" as unknown as number, longitude: "" as unknown as number, priority: "medium", kind: "delivery",
  status: "pending", service_minutes: 5, handling: "", notes: "",
};

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function toFormInput(p: Package): PackageFormInput {
  return {
    reference: p.reference, recipient: s(p.recipient), address: s(p.address), weight_kg: p.weight_kg, length_cm: s(p.length_cm) as unknown as number,
    width_cm: s(p.width_cm) as unknown as number, height_cm: s(p.height_cm) as unknown as number, latitude: s(p.latitude) as unknown as number,
    longitude: s(p.longitude) as unknown as number, priority: p.priority, kind: p.kind, status: (p.status as PackageFormInput["status"]) ?? "pending",
    service_minutes: p.service_minutes, handling: p.handling.join(", "), notes: s(p.notes),
  };
}

/** Merge validated form values over an existing package (keeps fields the form does not edit, e.g. time windows). */
export function toPackageInput(v: PackageFormValues, base?: Package): PackageInput {
  const hasDims = v.length_cm !== undefined && v.width_cm !== undefined && v.height_cm !== undefined;
  return {
    reference: v.reference, recipient: v.recipient || null, location_id: base?.location_id ?? null, address: v.address || null,
    latitude: v.latitude ?? null, longitude: v.longitude ?? null, weight_kg: v.weight_kg,
    length_cm: hasDims ? v.length_cm! : null, width_cm: hasDims ? v.width_cm! : null, height_cm: hasDims ? v.height_cm! : null,
    volume_m3: hasDims ? computeVolumeM3(v.length_cm, v.width_cm, v.height_cm) : null,
    priority: v.priority, handling: parseHandling(v.handling),
    window_start: base?.window_start ?? null, window_end: base?.window_end ?? null, deadline: base?.deadline ?? null,
    service_minutes: v.service_minutes, kind: v.kind, status: v.status, notes: v.notes || null,
  };
}

type Props = {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Package | null; existing: Package[];
  onSubmit: (v: PackageInput, editing: Package | null) => Promise<void>;
};

/** Dialog content only mounts while open, so form state starts fresh each time (no reset effect needed). */
export function PackageFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent title={props.editing ? "Edit package" : "Add package"} description="Volume is calculated automatically from the dimensions." className="max-w-xl">
        <PackageFormBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function PackageFormBody({ onOpenChange, editing, existing, onSubmit }: Props) {
  const { register, handleSubmit, control, setError, formState: { errors, isSubmitting } } = useForm<PackageFormInput, unknown, PackageFormValues>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: editing ? toFormInput(editing) : blank,
  });
  const [serverError, setServerError] = React.useState<string | null>(null);

  const [l, w, h] = useWatch({ control, name: ["length_cm", "width_cm", "height_cm"] });
  const volume = computeVolumeM3(Number(l) || null, Number(w) || null, Number(h) || null);

  const err = (k: keyof PackageFormInput) => errors[k]?.message as string | undefined;
  const a11y = (k: keyof PackageFormInput) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `pf-${k}-error` : undefined });

  return (
        <form
          noValidate
          className="grid grid-cols-2 gap-3"
          onSubmit={handleSubmit(async (v) => {
            if (isDuplicateReference(v.reference, existing, editing?.id)) {
              setError("reference", { message: "A package with this reference already exists" });
              return;
            }
            setServerError(null);
            try {
              await onSubmit(toPackageInput(v, editing ?? undefined), editing);
              onOpenChange(false);
            } catch (e) {
              setServerError(e instanceof Error ? ((e as { userMessage?: string }).userMessage ?? e.message) : "Could not save the package");
            }
          })}
        >
          <FormField label="Reference" htmlFor="pf-reference" error={err("reference")} className="col-span-2 sm:col-span-1">
            <Input id="pf-reference" placeholder="RZ-2001" {...register("reference")} {...a11y("reference")} />
          </FormField>
          <FormField label="Recipient" htmlFor="pf-recipient" error={err("recipient")} className="col-span-2 sm:col-span-1">
            <Input id="pf-recipient" {...register("recipient")} {...a11y("recipient")} />
          </FormField>
          <FormField label="Address / stop" htmlFor="pf-address" error={err("address")} className="col-span-2">
            <Input id="pf-address" {...register("address")} {...a11y("address")} />
          </FormField>
          <FormField label="Weight (kg)" htmlFor="pf-weight_kg" error={err("weight_kg")}>
            <Input id="pf-weight_kg" type="number" step="any" inputMode="decimal" {...register("weight_kg")} {...a11y("weight_kg")} />
          </FormField>
          <FormField label="Service time (min)" htmlFor="pf-service_minutes" error={err("service_minutes")}>
            <Input id="pf-service_minutes" type="number" step="any" {...register("service_minutes")} {...a11y("service_minutes")} />
          </FormField>
          <div className="col-span-2 grid grid-cols-3 gap-3">
            <FormField label="Length (cm)" htmlFor="pf-length_cm" error={err("length_cm")}>
              <Input id="pf-length_cm" type="number" step="any" {...register("length_cm")} {...a11y("length_cm")} />
            </FormField>
            <FormField label="Width (cm)" htmlFor="pf-width_cm" error={err("width_cm")}>
              <Input id="pf-width_cm" type="number" step="any" {...register("width_cm")} {...a11y("width_cm")} />
            </FormField>
            <FormField label="Height (cm)" htmlFor="pf-height_cm" error={err("height_cm")}>
              <Input id="pf-height_cm" type="number" step="any" {...register("height_cm")} {...a11y("height_cm")} />
            </FormField>
          </div>
          <p className="col-span-2 -mt-1 text-xs text-muted-foreground" data-testid="volume-preview" aria-live="polite">
            Volume: <strong className="text-foreground">{volume === null ? "n/a (enter all three dimensions)" : `${volume} m³`}</strong>
          </p>
          <FormField label="Priority" htmlFor="pf-priority" error={err("priority")}>
            <Select id="pf-priority" {...register("priority")}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select>
          </FormField>
          <FormField label="Type" htmlFor="pf-kind" error={err("kind")}>
            <Select id="pf-kind" {...register("kind")}><option value="delivery">Delivery</option><option value="pickup">Pickup</option></Select>
          </FormField>
          <FormField label="Status" htmlFor="pf-status" error={err("status")}>
            <Select id="pf-status" {...register("status")}>
              <option value="pending">Pending</option><option value="assigned">Assigned</option><option value="in_transit">In transit</option>
              <option value="delivered">Delivered</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option>
            </Select>
          </FormField>
          <FormField label="Handling" htmlFor="pf-handling" hint="Comma separated, e.g. fragile, cold" error={err("handling")}>
            <Input id="pf-handling" {...register("handling")} {...a11y("handling")} />
          </FormField>
          <FormField label="Latitude (optional)" htmlFor="pf-latitude" error={err("latitude")}>
            <Input id="pf-latitude" type="number" step="any" inputMode="decimal" {...register("latitude")} {...a11y("latitude")} />
          </FormField>
          <FormField label="Longitude (optional)" htmlFor="pf-longitude" error={err("longitude")}>
            <Input id="pf-longitude" type="number" step="any" inputMode="decimal" {...register("longitude")} {...a11y("longitude")} />
          </FormField>
          <FormField label="Notes" htmlFor="pf-notes" error={err("notes")} className="col-span-2">
            <Textarea id="pf-notes" {...register("notes")} {...a11y("notes")} />
          </FormField>
          {serverError && <p role="alert" className="col-span-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{serverError}</p>}
          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>{isSubmitting ? "Saving…" : editing ? "Save changes" : "Add package"}</Button>
          </div>
        </form>
  );
}
