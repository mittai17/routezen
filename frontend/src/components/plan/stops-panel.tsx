"use client";
import * as React from "react";
import { ChevronDown, ChevronUp, Copy, Package, Pencil, Plus, Scale, Trash2, Flag } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/states";
import { USE_DEMO_DATA, type PlanStop } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PlanAction } from "./plan-state";
import { StopFormDialog } from "./stop-form-dialog";

const PRIORITY_COLOR = { high: "bg-danger", medium: "bg-info", low: "bg-success" } as const;
const PRIORITY_TONE = { high: "danger", medium: "warning", low: "success" } as const;
const FILTERS = ["All", "Residential", "Office", "Commercial"] as const;

export function StopsPanel({ stops, dispatch, readOnly }: { stops: PlanStop[]; dispatch: React.Dispatch<PlanAction>; readOnly?: boolean }) {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>("All");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PlanStop | null>(null);
  const [removing, setRemoving] = React.useState<PlanStop | null>(null);
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);

  const count = (f: (typeof FILTERS)[number]) => (f === "All" ? stops.length : stops.filter((s) => s.zone_kind === f).length);
  const visible = stops.map((s, i) => ({ s, i })).filter(({ s }) => filter === "All" || s.zone_kind === filter);

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Delivery Items & Requirements"
        subtitle="Add package details for each stop to get vehicle recommendations."
        action={USE_DEMO_DATA ? <DemoBadge /> : undefined}
      />
      <div className="flex flex-wrap gap-1.5 px-4 pt-3" role="tablist" aria-label="Filter stops by area type">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} type="button" onClick={() => setFilter(f)}
            className={cn("rounded-lg border px-2.5 py-1 text-xs font-semibold", filter === f ? "border-brand bg-brand-soft" : "border-border text-muted-foreground hover:bg-muted")}>
            {f === "All" ? "All Stops" : f} ({count(f)})
          </button>
        ))}
      </div>

      <ul className="max-h-[560px] flex-1 divide-y divide-border overflow-y-auto px-2 py-2" aria-label="Delivery stops">
        {visible.map(({ s, i }) => (
          <li
            key={s.id}
            draggable={!readOnly && filter === "All"}
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => { if (dragFrom !== null) e.preventDefault(); }}
            onDrop={() => { if (dragFrom !== null) dispatch({ type: "moveStop", from: dragFrom, to: i }); setDragFrom(null); }}
            onDragEnd={() => setDragFrom(null)}
            className={cn("flex items-start gap-2 rounded-xl px-2 py-2.5 hover:bg-muted/50", dragFrom === i && "opacity-50")}
          >
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-bold text-muted-foreground">{i + 1}</span>
            <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white", PRIORITY_COLOR[s.priority])} aria-hidden>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{s.name}</span>
                <Badge tone={s.zone_kind === "Residential" ? "success" : s.zone_kind === "Commercial" ? "info" : "violet"}>{s.zone_kind}</Badge>
              </div>
              <div className="truncate text-xs text-muted-foreground">{s.address || `${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}`}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Package className="size-3" />{s.packages} package{s.packages === 1 ? "" : "s"}</span>
                <span className="inline-flex items-center gap-1"><Scale className="size-3" />{s.weight_kg} kg</span>
                <span className="inline-flex items-center gap-1"><Flag className="size-3" /><Badge tone={PRIORITY_TONE[s.priority]}>{s.priority}</Badge></span>
              </div>
              {!readOnly && (
                <div className="mt-1.5 flex items-center gap-0.5">
                  <IconBtn label={`Move ${s.name} up`} disabled={i === 0} onClick={() => dispatch({ type: "moveStop", from: i, to: i - 1 })}><ChevronUp /></IconBtn>
                  <IconBtn label={`Move ${s.name} down`} disabled={i === stops.length - 1} onClick={() => dispatch({ type: "moveStop", from: i, to: i + 1 })}><ChevronDown /></IconBtn>
                  <IconBtn label={`Edit ${s.name}`} onClick={() => { setEditing(s); setFormOpen(true); }}><Pencil /></IconBtn>
                  <IconBtn label={`Duplicate ${s.name}`} onClick={() => dispatch({ type: "duplicateStop", id: s.id })}><Copy /></IconBtn>
                  <IconBtn label={`Remove ${s.name}`} tone="danger" onClick={() => setRemoving(s)}><Trash2 /></IconBtn>
                </div>
              )}
            </div>
          </li>
        ))}
        {stops.length === 0 && (
          <li className="list-none p-2"><EmptyState title="No delivery stops yet" description="Add your first stop to get vehicle recommendations and optimise a route." className="py-8" /></li>
        )}
      </ul>

      {!readOnly && (
        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <Button variant="success" size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Add Stop</Button>
          {stops.length > 0 && <Button size="sm" onClick={() => dispatch({ type: "setStops", stops: [] })}>Clear all</Button>}
        </div>
      )}

      <StopFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSubmit={(v) => (editing ? dispatch({ type: "updateStop", stop: { ...v, id: editing.id } }) : dispatch({ type: "addStop", stop: v }))}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this stop?"
        description={`${removing?.name ?? "This stop"} will be removed from the plan. Any optimisation result will need to be re-run.`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => removing && dispatch({ type: "removeStop", id: removing.id })}
      />
    </Card>
  );
}

function IconBtn({ label, children, onClick, disabled, tone }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: "danger" }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className={cn("grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30 [&_svg]:size-3.5", tone === "danger" && "hover:bg-danger-soft hover:text-danger")}>
      {children}
    </button>
  );
}
