"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardHeader } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Switch } from "@/components/ui/form-controls";
import { constraintsSchema, type Constraints } from "@/lib/schemas";
import type { Location } from "@/lib/api";
import { SlidersHorizontal } from "lucide-react";

export function ConstraintsPanel({ value, depots, onChange }: { value: Constraints; depots: Location[]; onChange: (c: Constraints) => void }) {
  const { register, watch, reset, formState: { errors } } = useForm<Constraints>({ resolver: zodResolver(constraintsSchema) as never, defaultValues: value, mode: "onChange" });
  React.useEffect(() => { reset(value); }, [value, reset]);
  // Persist valid edits as they happen so the state survives step changes.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/incompatible-library -- RHF subscription API; component is intentionally not memoised
    const sub = watch((v) => {
      const parsed = constraintsSchema.safeParse(v);
      if (parsed.success && JSON.stringify(parsed.data) !== JSON.stringify(value)) onChange(parsed.data);
    });
    return () => sub.unsubscribe();
  }, [watch, onChange, value]);

  return (
    <Card>
      <CardHeader icon={<SlidersHorizontal />} title="Constraints" subtitle="Time, capacity and priority rules applied to the plan." />
      <form className="grid grid-cols-2 gap-3 p-4" onSubmit={(e) => e.preventDefault()} noValidate>
        <FormField label="Depot" htmlFor="c-depot" className="col-span-2">
          <Select id="c-depot" {...register("depot_id")}>
            {depots.length === 0 && <option value={value.depot_id}>Chennai Central (default)</option>}
            {depots.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Start time" htmlFor="c-start" error={errors.start_time?.message}><Input id="c-start" type="time" {...register("start_time")} /></FormField>
        <FormField label="Max vehicles" htmlFor="c-max" error={errors.max_vehicles?.message}><Input id="c-max" type="number" min={1} max={20} {...register("max_vehicles")} /></FormField>
        <FormField label="Priority handling" htmlFor="c-prio" className="col-span-2" hint="How high-priority stops influence visit order.">
          <Select id="c-prio" {...register("priority_handling")}><option value="ignore">Ignore</option><option value="consider">Consider</option><option value="strict">Strict (high first)</option></Select>
        </FormField>
        <div className="col-span-2 space-y-3 pt-1">
          <Switch label="Respect vehicle capacity" {...register("respect_capacity")} />
          <div><Switch label="Respect delivery time windows" {...register("respect_time_windows")} /></div>
          <div><Switch label="Return to depot at end" {...register("return_to_depot")} /></div>
          <div><Switch label="Prefer electric vehicles" {...register("prefer_electric")} /></div>
        </div>
      </form>
    </Card>
  );
}
