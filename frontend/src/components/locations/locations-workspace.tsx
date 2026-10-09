"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, List, Map as MapIcon, MapPin, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Select } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { MapView, type MapStop } from "@/components/maps/map-view";
import { USE_DEMO_DATA, type Location } from "@/lib/api";
import { createLocation, deleteLocation, describeError, listLocations, updateLocation } from "@/lib/api/locations";
import { cn } from "@/lib/utils";
import { ImportDialog } from "./import-dialog";
import { LocationFormDialog } from "./location-form-dialog";
import { LOCATION_TYPES, TYPE_LABEL, analyseLocations, hasIssue, locationsToCsv, type LocationType } from "./location-utils";

const TYPE_TONE = { depot: "success", warehouse: "violet", stop: "info" } as const;
const KEY = ["locations"];

export function LocationsWorkspace() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: listLocations });
  const all = React.useMemo(() => query.data ?? [], [query.data]);

  const [view, setView] = React.useState<"list" | "map">("list");
  const [type, setType] = React.useState<"" | LocationType>("");
  const [zone, setZone] = React.useState("");
  const [issuesOnly, setIssuesOnly] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Location | null>(null);
  const [removing, setRemoving] = React.useState<Location | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const issues = React.useMemo(() => analyseLocations(all), [all]);
  const zones = React.useMemo(() => [...new Set(all.map((l) => l.zone?.trim()).filter((z): z is string => !!z))].sort((a, b) => a.localeCompare(b)), [all]);
  const filtered = React.useMemo(
    () => all.filter((l) => (!type || l.type === type) && (!zone || l.zone === zone) && (!issuesOnly || hasIssue(issues.get(l.id)))),
    [all, type, zone, issuesOnly, issues],
  );
  const issueCount = React.useMemo(() => all.filter((l) => hasIssue(issues.get(l.id))).length, [all, issues]);
  const counts = React.useMemo(() => ({ depot: all.filter((l) => l.type === "depot").length, warehouse: all.filter((l) => l.type === "warehouse").length, stop: all.filter((l) => l.type === "stop").length }), [all]);

  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  const save = useMutation({
    mutationFn: ({ id, data }: { id: string | null; data: Omit<Location, "id"> }) => (id ? updateLocation(id, data) : createLocation(data)),
    onSuccess: (_r, v) => { invalidate(); setNotice({ tone: "ok", text: v.id ? "Location updated." : "Location added." }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteLocation(id),
    onSuccess: () => { invalidate(); setNotice({ tone: "ok", text: "Location deleted." }); },
    onError: (e) => setNotice({ tone: "error", text: `Delete failed: ${describeError(e)}` }),
  });

  const { mapStops, mapDepot, hidden } = React.useMemo(() => {
    const valid = filtered.filter((l) => !issues.get(l.id)?.invalid);
    const depot = valid.find((l) => l.type === "depot");
    const stops: MapStop[] = valid.filter((l) => l !== depot).map((l, i) => ({
      id: l.id, lat: l.latitude, lng: l.longitude, label: `${l.name} (${TYPE_LABEL[l.type]})`, order: i + 1,
      tone: l.id === selectedId ? "high" : l.type === "stop" ? "default" : "success",
    }));
    return { mapStops: stops, mapDepot: depot ? { lat: depot.latitude, lng: depot.longitude, label: depot.name } : undefined, hidden: filtered.length - valid.length };
  }, [filtered, issues, selectedId]);

  function exportCsv() {
    const blob = new Blob([locationsToCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "locations.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice({ tone: "ok", text: `Exported ${filtered.length} location${filtered.length === 1 ? "" : "s"}.` });
  }

  const columns: Column<Location>[] = [
    { key: "name", header: "Name", value: (l) => l.name, cell: (l) => <span className="font-semibold">{l.name}</span> },
    { key: "address", header: "Address", value: (l) => l.address ?? "", cell: (l) => <span className="text-muted-foreground">{l.address || "-"}</span>, className: "min-w-44" },
    { key: "coords", header: "Lat / Lng", value: (l) => l.latitude, cell: (l) => <span className="tabular-nums whitespace-nowrap">{l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}</span> },
    { key: "type", header: "Type", value: (l) => l.type, cell: (l) => <Badge tone={TYPE_TONE[l.type]}>{TYPE_LABEL[l.type]}</Badge> },
    { key: "zone", header: "Zone", value: (l) => l.zone ?? "", cell: (l) => l.zone || "-" },
    { key: "notes", header: "Notes", value: (l) => l.notes ?? "", cell: (l) => <span className="line-clamp-2 max-w-48 text-muted-foreground">{l.notes || "-"}</span> },
    {
      key: "issues", header: "Checks",
      cell: (l) => {
        const i = issues.get(l.id);
        if (!i) return null;
        const dupNames = [...new Set(i.duplicates.map((d) => d.name))].join(", ");
        return (
          <div className="flex flex-wrap gap-1">
            {i.invalid && <Badge tone="danger"><span title={i.invalid}>Invalid coordinates</span></Badge>}
            {i.duplicates.length > 0 && <Badge tone="warning"><span title={`Duplicate of: ${dupNames}`}>Duplicate</span></Badge>}
            {i.outside && <Badge tone="neutral"><span title="Outside the Chennai area">Outside Chennai</span></Badge>}
            {!i.invalid && !i.outside && i.duplicates.length === 0 && <span className="text-muted-foreground">OK</span>}
          </div>
        );
      },
    },
    {
      key: "actions", header: "Actions",
      cell: (l) => (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" aria-label={`Show ${l.name} on map`} disabled={!!issues.get(l.id)?.invalid} onClick={() => { setSelectedId(l.id); setView("map"); }}><MapPin /></Button>
          <Button size="icon" variant="ghost" aria-label={`Edit ${l.name}`} onClick={() => { setEditing(l); setFormOpen(true); }}><Pencil /></Button>
          <Button size="icon" variant="ghost" aria-label={`Delete ${l.name}`} onClick={() => setRemoving(l)}><Trash2 className="text-danger" /></Button>
        </div>
      ),
    },
  ];

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const filtersActive = !!type || !!zone || issuesOnly;

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Manage depots, warehouses and delivery stops across Chennai."
        actions={
          <>
            {USE_DEMO_DATA && <DemoBadge />}
            <Button onClick={() => setImportOpen(true)} disabled={query.isError}><Upload /> Import CSV</Button>
            <Button onClick={exportCsv} disabled={filtered.length === 0}><Download /> Export CSV</Button>
            <Button variant="primary" onClick={openAdd}><Plus /> Add location</Button>
          </>
        }
      />

      {notice && (
        <div role={notice.tone === "error" ? "alert" : "status"} className={cn("mb-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm", notice.tone === "error" ? "border-danger/30 bg-danger-soft text-danger" : "border-success/30 bg-success-soft text-success")}>
          <span>{notice.text}</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}

      {query.isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading locations">
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : query.isError ? (
        <ErrorState title="Could not load locations" message={describeError(query.error)} onRetry={() => query.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={<MapPin />} title="No locations yet"
          description="Add your depot and delivery points one by one, or import many at once from a CSV file."
          action={<div className="flex flex-wrap justify-center gap-2"><Button variant="primary" onClick={openAdd}><Plus /> Add location</Button><Button onClick={() => setImportOpen(true)}><Upload /> Import CSV</Button></div>}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-border bg-card text-xs font-semibold" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={cn("inline-flex items-center gap-1.5 px-3 py-2", view === "list" ? "bg-brand text-brand-foreground" : "hover:bg-muted")}><List className="size-3.5" /> List</button>
              <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} className={cn("inline-flex items-center gap-1.5 px-3 py-2", view === "map" ? "bg-brand text-brand-foreground" : "hover:bg-muted")}><MapIcon className="size-3.5" /> Map</button>
            </div>
            <Select aria-label="Filter by type" className="w-auto" value={type} onChange={(e) => setType(e.target.value as "" | LocationType)}>
              <option value="">All types ({all.length})</option>
              {LOCATION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]} ({counts[t]})</option>)}
            </Select>
            <Select aria-label="Filter by zone" className="w-auto" value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">All zones</option>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </Select>
            <label className="inline-flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} /> Needs attention ({issueCount})
            </label>
            {filtersActive && <Button size="sm" variant="ghost" onClick={() => { setType(""); setZone(""); setIssuesOnly(false); }}>Clear filters</Button>}
          </div>

          {issueCount > 0 && (
            <p role="status" className="text-xs text-warning">{issueCount} location{issueCount === 1 ? "" : "s"} have invalid coordinates or look like duplicates. Locations with invalid coordinates are not drawn on the map.</p>
          )}

          {view === "list" ? (
            <DataTable
              rows={filtered} columns={columns} rowKey={(l) => l.id} pageSize={10} filterPlaceholder="Search name, address, zone…"
              emptyTitle={filtersActive ? "No locations match these filters" : "No results"}
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="h-[min(70vh,34rem)] min-h-80">
                <MapView stops={mapStops} depot={mapDepot} showLegend={false} hideRouteNotice height="100%" className="rounded-none border-0" />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-success" /> Depot / warehouse</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-info" /> Delivery stop</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-danger" /> Selected</span>
                <span>{filtered.length - hidden} shown{hidden > 0 ? `, ${hidden} hidden (invalid coordinates)` : ""}. Numbers are map order, not routes.</span>
              </div>
            </Card>
          )}
        </div>
      )}

      <LocationFormDialog
        open={formOpen} onOpenChange={setFormOpen} editing={editing} zones={zones}
        onSubmit={async (data) => {
          try { await save.mutateAsync({ id: editing?.id ?? null, data }); } catch (e) { throw new Error(describeError(e)); }
        }}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} existing={all} create={(d) => createLocation(d)} onDone={(text) => { invalidate(); setNotice({ tone: text.includes("failed") ? "error" : "ok", text }); }} />
      <ConfirmDialog
        open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }} destructive confirmLabel="Delete"
        title="Delete location?" description={`"${removing?.name ?? ""}" will be permanently removed. Packages or plans referencing it may be affected.`}
        onConfirm={() => { if (removing) remove.mutate(removing.id); }}
      />
    </div>
  );
}
