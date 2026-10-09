"use client";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/form-controls";
import type { Location } from "@/lib/api";
import { LOCATION_TYPES, TYPE_LABEL, locationFormSchema, outsideChennai, toPayload, type LocationFormInput, type LocationFormValues } from "./location-utils";

const blank: LocationFormInput = { name: "", address: "", latitude: "", longitude: "", type: "stop", zone: "", notes: "" };
const toForm = (l: Location): LocationFormInput => ({
  name: l.name, address: l.address ?? "", latitude: String(l.latitude), longitude: String(l.longitude), type: l.type, zone: l.zone ?? "", notes: l.notes ?? "",
});

type Props = {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Location | null; zones: string[];
  /** Resolve to close the dialog; throw to show the message inline. */
  onSubmit: (v: Omit<Location, "id">) => Promise<void>;
};

/** Content mounts only while open, so the form starts fresh (from `editing`) every time. */
export function LocationFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent title={props.editing ? "Edit location" : "Add location"} description="Coordinates are WGS84 decimal degrees, e.g. 13.0827, 80.2707 for Chennai." className="max-w-xl">
        <LocationForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function LocationForm({ onOpenChange, editing, zones, onSubmit }: Props) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<LocationFormInput, unknown, LocationFormValues>({
    resolver: zodResolver(locationFormSchema), defaultValues: editing ? toForm(editing) : blank,
  });
  const [serverError, setServerError] = React.useState<string | null>(null);

  const [latRaw, lngRaw] = useWatch({ control, name: ["latitude", "longitude"] });
  const lat = Number(latRaw), lng = Number(lngRaw);
  const far = !!latRaw && !!lngRaw && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && outsideChennai(lat, lng);

  const err = (k: keyof LocationFormInput) => errors[k]?.message as string | undefined;
  const a11y = (k: keyof LocationFormInput) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `lf-${k}-error` : undefined });

  return (
    <>
        <form
          noValidate
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          onSubmit={handleSubmit(async (v) => {
            setServerError(null);
            try { await onSubmit(toPayload(v)); onOpenChange(false); } catch (e) { setServerError(e instanceof Error ? e.message : "Save failed"); }
          })}
        >
          <FormField label="Name" htmlFor="lf-name" error={err("name")} className="sm:col-span-2">
            <Input id="lf-name" autoComplete="off" {...register("name")} {...a11y("name")} />
          </FormField>
          <FormField label="Address" htmlFor="lf-address" error={err("address")} className="sm:col-span-2">
            <Input id="lf-address" autoComplete="off" {...register("address")} {...a11y("address")} />
          </FormField>
          <FormField label="Latitude" htmlFor="lf-latitude" error={err("latitude")} hint="-90 to 90">
            <Input id="lf-latitude" inputMode="decimal" placeholder="13.0827" {...register("latitude")} {...a11y("latitude")} />
          </FormField>
          <FormField label="Longitude" htmlFor="lf-longitude" error={err("longitude")} hint="-180 to 180">
            <Input id="lf-longitude" inputMode="decimal" placeholder="80.2707" {...register("longitude")} {...a11y("longitude")} />
          </FormField>
          {far && <p role="status" className="text-[11px] font-medium text-warning sm:col-span-2">These coordinates are outside the Chennai area. Check that latitude and longitude are not swapped.</p>}
          <FormField label="Type" htmlFor="lf-type" error={err("type")} hint="Depots and warehouses are shown with their own map markers.">
            <Select id="lf-type" {...register("type")}>{LOCATION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</Select>
          </FormField>
          <FormField label="Zone" htmlFor="lf-zone" error={err("zone")}>
            <Input id="lf-zone" list="lf-zones" autoComplete="off" {...register("zone")} {...a11y("zone")} />
            <datalist id="lf-zones">{zones.map((z) => <option key={z} value={z} />)}</datalist>
          </FormField>
          <FormField label="Notes" htmlFor="lf-notes" error={err("notes")} className="sm:col-span-2">
            <Textarea id="lf-notes" {...register("notes")} {...a11y("notes")} />
          </FormField>
          {serverError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger sm:col-span-2">{serverError}</p>}
          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>{isSubmitting ? "Saving…" : editing ? "Save changes" : "Add location"}</Button>
          </div>
        </form>
    </>
  );
}
