"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Select } from "@/components/ui/form-controls";
import { api, type PlanStop } from "@/lib/api";
import { stopFormSchema, type StopFormInput, type StopFormValues } from "@/lib/schemas";

const blank: StopFormInput = {
  name: "", address: "", latitude: "" as unknown as number, longitude: "" as unknown as number, zone_kind: "Residential", packages: 1, weight_kg: 1,
  priority: "medium", window_start: "09:00", window_end: "18:00", service_minutes: 5, kind: "delivery",
};

function toForm(s: PlanStop): StopFormInput {
  return { name: s.name, address: s.address, latitude: s.latitude, longitude: s.longitude, zone_kind: s.zone_kind, packages: s.packages, weight_kg: s.weight_kg, priority: s.priority, window_start: s.window_start, window_end: s.window_end, service_minutes: s.service_minutes, kind: s.kind };
}

export function StopFormDialog({ open, onOpenChange, editing, onSubmit }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: PlanStop | null; onSubmit: (v: Omit<PlanStop, "id">) => void;
}) {
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<StopFormInput, unknown, StopFormValues>({
    resolver: zodResolver(stopFormSchema),
    defaultValues: blank,
  });
  const locations = useQuery({ queryKey: ["locations"], queryFn: () => api.locations.list(), enabled: open });

  React.useEffect(() => { if (open) reset(editing ? toForm(editing) : blank); }, [open, editing, reset]);

  const err = (k: keyof StopFormInput) => errors[k]?.message as string | undefined;
  const a11y = (k: keyof StopFormInput) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `sf-${k}-error` : undefined });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editing ? "Edit stop" : "Add delivery stop"} description="Coordinates must be real WGS84 latitude/longitude. Pick a known Chennai location to fill them in." className="max-w-xl">
        <form
          noValidate
          onSubmit={handleSubmit((v) => {
            onSubmit({ ...v, address: v.address ?? "", window_start: v.window_start ?? "", window_end: v.window_end ?? "" });
            onOpenChange(false);
          })}
          className="grid grid-cols-2 gap-3"
        >
          <FormField label="Fill from known location" htmlFor="sf-preset" className="col-span-2">
            <Select
              id="sf-preset"
              defaultValue=""
              onChange={(e) => {
                const l = locations.data?.find((x) => x.id === e.target.value);
                if (!l) return;
                setValue("name", l.name, { shouldValidate: true });
                setValue("address", l.address ?? "");
                setValue("latitude", l.latitude, { shouldValidate: true });
                setValue("longitude", l.longitude, { shouldValidate: true });
              }}
            >
              <option value="">{locations.isLoading ? "Loading locations…" : locations.isError ? "Locations unavailable, enter manually" : "Choose a location (optional)"}</option>
              {locations.data?.filter((l) => l.type !== "depot").map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Stop name" htmlFor="sf-name" error={err("name")} className="col-span-2">
            <Input id="sf-name" {...register("name")} {...a11y("name")} />
          </FormField>
          <FormField label="Address" htmlFor="sf-address" error={err("address")} className="col-span-2">
            <Input id="sf-address" {...register("address")} {...a11y("address")} />
          </FormField>
          <FormField label="Latitude" htmlFor="sf-latitude" error={err("latitude")}>
            <Input id="sf-latitude" inputMode="decimal" {...register("latitude")} {...a11y("latitude")} />
          </FormField>
          <FormField label="Longitude" htmlFor="sf-longitude" error={err("longitude")}>
            <Input id="sf-longitude" inputMode="decimal" {...register("longitude")} {...a11y("longitude")} />
          </FormField>
          <FormField label="Area type" htmlFor="sf-zone_kind">
            <Select id="sf-zone_kind" {...register("zone_kind")}><option>Residential</option><option>Commercial</option><option>Office</option></Select>
          </FormField>
          <FormField label="Job type" htmlFor="sf-kind">
            <Select id="sf-kind" {...register("kind")}><option value="delivery">Delivery</option><option value="pickup">Pickup</option></Select>
          </FormField>
          <FormField label="Packages" htmlFor="sf-packages" error={err("packages")}>
            <Input id="sf-packages" type="number" min={1} {...register("packages")} {...a11y("packages")} />
          </FormField>
          <FormField label="Total weight (kg)" htmlFor="sf-weight_kg" error={err("weight_kg")}>
            <Input id="sf-weight_kg" type="number" step="0.1" {...register("weight_kg")} {...a11y("weight_kg")} />
          </FormField>
          <FormField label="Priority" htmlFor="sf-priority">
            <Select id="sf-priority" {...register("priority")}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select>
          </FormField>
          <FormField label="Service time (min)" htmlFor="sf-service_minutes" error={err("service_minutes")}>
            <Input id="sf-service_minutes" type="number" {...register("service_minutes")} {...a11y("service_minutes")} />
          </FormField>
          <FormField label="Window start" htmlFor="sf-window_start" error={err("window_start")}>
            <Input id="sf-window_start" type="time" {...register("window_start")} {...a11y("window_start")} />
          </FormField>
          <FormField label="Window end" htmlFor="sf-window_end" error={err("window_end")}>
            <Input id="sf-window_end" type="time" {...register("window_end")} {...a11y("window_end")} />
          </FormField>
          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>{editing ? "Save changes" : "Add stop"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
