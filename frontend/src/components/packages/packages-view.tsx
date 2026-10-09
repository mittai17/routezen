"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Package as PackageIcon, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, DemoBadge, StatusPill } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form-controls";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { USE_DEMO_DATA, isApiError, type Package } from "@/lib/api";
import { fetchPackagesData, packagesApi, runBulk, type PackageInput } from "@/lib/api/packages";
import { PackageFormDialog, toPackageInput } from "./package-form-dialog";
import { ImportDialog } from "./import-dialog";
import { toCsv, type ImportRow } from "./csv";
import { PRIORITIES, STATUSES, computeVolumeM3, normRef } from "./package-schema";

const PAGE_SIZE = 25;
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const volumeOf = (p: Package) => p.volume_m3 ?? computeVolumeM3(p.length_cm, p.width_cm, p.height_cm);
const dims = (p: Package) => (p.length_cm && p.width_cm && p.height_cm ? `${p.length_cm} × ${p.width_cm} × ${p.height_cm} cm` : "—");
const PRIORITY_RANK = { low: 0, medium: 1, high: 2 } as const;

type SortKey = "reference" | "recipient" | "stop" | "weight" | "volume" | "priority" | "status" | "cost";

export function PackagesView() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["packages-page", USE_DEMO_DATA], queryFn: fetchPackagesData });
  const data = query.data;
  const packages = React.useMemo(() => data?.packages ?? [], [data]);

  const [q, setQ] = React.useState("");
  const [priority, setPriority] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [kind, setKind] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Package | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [deleteIds, setDeleteIds] = React.useState<string[] | null>(null);
  const [notice, setNotice] = React.useState<{ tone: "success" | "danger"; text: string; details?: string[] } | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["packages-page"] });

  const stopOf = React.useCallback((p: Package) => (p.location_id && data?.locations[p.location_id]) || p.address || "", [data]);
  const costOf = React.useCallback((p: Package) => data?.assignments[p.id]?.cost ?? null, [data]);

  const rows = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = packages.filter((p) =>
      (!priority || p.priority === priority) && (!status || p.status === status) && (!kind || p.kind === kind) &&
      (!needle || [p.reference, p.recipient, p.address, stopOf(p), p.handling.join(" ")].some((x) => (x ?? "").toLowerCase().includes(needle))));
    if (sort) {
      const val = (p: Package): string | number => {
        switch (sort.key) {
          case "reference": return p.reference; case "recipient": return p.recipient ?? ""; case "stop": return stopOf(p);
          case "weight": return p.weight_kg; case "volume": return volumeOf(p) ?? -1; case "priority": return PRIORITY_RANK[p.priority];
          case "status": return p.status; case "cost": return costOf(p) ?? -1;
        }
      };
      out = [...out].sort((a, b) => {
        const x = val(a), y = val(b);
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir;
      });
    }
    return out;
  }, [packages, q, priority, status, kind, sort, stopOf, costOf]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const allOnPage = slice.length > 0 && slice.every((p) => selected.has(p.id));
  const selectedPkgs = packages.filter((p) => selected.has(p.id));
  const filtersActive = !!(q || priority || status || kind);

  const toggleSort = (key: SortKey) => setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }));
  const resetFilters = () => { setQ(""); setPriority(""); setStatus(""); setKind(""); setPage(0); };

  const save = useMutation({
    mutationFn: ({ input, base }: { input: PackageInput; base: Package | null }) => (base ? packagesApi.update(base.id, input) : packagesApi.create(input)),
    onSuccess: (_r, v) => { setNotice({ tone: "success", text: v.base ? `Updated ${v.input.reference}.` : `Added ${v.input.reference}.` }); void refresh(); },
  });

  async function bulkUpdate(patch: Partial<PackageInput>, what: string) {
    const targets = selectedPkgs;
    const res = await runBulk(targets, (p) => p.reference, (p) => p.id, (p) => {
      const { id: _id, ...rest } = p; void _id;
      return packagesApi.update(p.id, { ...rest, ...patch });
    });
    setNotice({ tone: res.failed.length ? "danger" : "success", text: `${what}: ${res.ok} updated${res.failed.length ? `, ${res.failed.length} failed` : ""}.`, details: res.failed.map((f) => `${f.label}: ${f.message}`) });
    setSelected(new Set());
    await refresh();
  }

  async function doDelete(ids: string[]) {
    const targets = packages.filter((p) => ids.includes(p.id));
    const res = await runBulk(targets, (p) => p.reference, (p) => p.id, (p) => packagesApi.remove(p.id));
    setNotice({ tone: res.failed.length ? "danger" : "success", text: `Deleted ${res.ok} package${res.ok === 1 ? "" : "s"}${res.failed.length ? `, ${res.failed.length} failed` : ""}.`, details: res.failed.map((f) => `${f.label}: ${f.message}`) });
    setSelected((s) => { const n = new Set(s); ids.forEach((i) => n.delete(i)); return n; });
    await refresh();
  }

  async function doImport(items: ImportRow[]) {
    const res = await runBulk(items, (r) => r.values!.reference, (r) => String(r.line), (r) => packagesApi.create(toPackageInput(r.values!)));
    setNotice({ tone: res.failed.length ? "danger" : "success", text: `Imported ${res.ok} package${res.ok === 1 ? "" : "s"}${res.failed.length ? `, ${res.failed.length} failed` : ""}.`, details: res.failed.map((f) => `${f.label}: ${f.message}`) });
    await refresh();
  }

  function exportCsv() {
    const src = selectedPkgs.length ? selectedPkgs : rows;
    const csv = toCsv(src.map((p) => ({ ...p, volume_m3: volumeOf(p) })));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "packages.csv"; a.click();
    URL.revokeObjectURL(url);
    setNotice({ tone: "success", text: `Exported ${src.length} package${src.length === 1 ? "" : "s"} to packages.csv.` });
  }

  const th = (children: React.ReactNode, k?: SortKey, className?: string) => (
    <th scope="col" className={`whitespace-nowrap px-3 py-2.5 font-semibold ${className ?? ""}`} aria-sort={k && sort?.key === k ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      {k ? (
        <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(k)}>
          {children}{sort?.key === k && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </button>
      ) : children}
    </th>
  );

  const openAdd = () => { setEditing(null); setFormOpen(true); };

  return (
    <>
      <PageHeader
        title="Packages"
        description="Weights, dimensions, priorities and handling for every parcel. Volume is calculated from dimensions."
        actions={<>
          {USE_DEMO_DATA && <DemoBadge />}
          <Button onClick={() => setImportOpen(true)}><Upload />Import CSV</Button>
          <Button onClick={exportCsv} disabled={!rows.length}><Download />Export CSV</Button>
          <Button variant="primary" onClick={openAdd}><Plus />Add package</Button>
        </>}
      />

      {notice && (
        <div role={notice.tone === "danger" ? "alert" : "status"} className={`mb-4 rounded-[var(--radius-control)] px-4 py-3 text-sm ${notice.tone === "danger" ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>
          <div className="flex items-start justify-between gap-3">
            <span className="font-semibold">{notice.text}</span>
            <button type="button" className="text-xs underline" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
          {notice.details && notice.details.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs">{notice.details.slice(0, 5).map((d) => <li key={d}>{d}</li>)}{notice.details.length > 5 && <li>and {notice.details.length - 5} more</li>}</ul>}
        </div>
      )}

      {query.isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading packages">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : query.isError ? (
        <ErrorState title="Could not load packages" message={isApiError(query.error) ? query.error.userMessage : "Unexpected error"} onRetry={() => void query.refetch()} />
      ) : packages.length === 0 ? (
        <EmptyState
          icon={<PackageIcon />}
          title="No packages yet"
          description="Add a package manually or import a CSV to start planning deliveries."
          action={<div className="flex flex-wrap justify-center gap-2"><Button variant="primary" onClick={openAdd}><Plus />Add package</Button><Button onClick={() => setImportOpen(true)}><Upload />Import CSV</Button></div>}
        />
      ) : (
        <div className="space-y-3">
          {data?.lookupsFailed && <p role="status" className="rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning">Vehicle and cost details could not be loaded; those columns may be incomplete.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search packages" className="pl-9" placeholder="Search reference, recipient, stop…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
            </div>
            <Select aria-label="Filter by priority" className="w-auto" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(0); }}>
              <option value="">All priorities</option>{PRIORITIES.map((p) => <option key={p} value={p}>{label(p)}</option>)}
            </Select>
            <Select aria-label="Filter by status" className="w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
              <option value="">All statuses</option>{STATUSES.map((p) => <option key={p} value={p}>{label(p)}</option>)}
            </Select>
            <Select aria-label="Filter by type" className="w-auto" value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }}>
              <option value="">Delivery and pickup</option><option value="delivery">Delivery</option><option value="pickup">Pickup</option>
            </Select>
            {filtersActive && <Button size="sm" variant="ghost" onClick={resetFilters}>Clear filters</Button>}
          </div>

          {selected.size > 0 && (
            <Card className="flex flex-wrap items-center gap-2 p-3" role="region" aria-label="Bulk actions">
              <Badge tone="brand">{selected.size} selected</Badge>
              <Select aria-label="Set status for selected" className="h-8 w-auto text-xs" value="" onChange={(e) => { if (e.target.value) void bulkUpdate({ status: e.target.value }, `Status set to ${label(e.target.value)}`); }}>
                <option value="">Set status…</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </Select>
              <Select aria-label="Set priority for selected" className="h-8 w-auto text-xs" value="" onChange={(e) => { if (e.target.value) void bulkUpdate({ priority: e.target.value as Package["priority"] }, `Priority set to ${label(e.target.value)}`); }}>
                <option value="">Set priority…</option>{PRIORITIES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </Select>
              <Button size="sm" onClick={exportCsv}><Download />Export selected</Button>
              <Button size="sm" variant="danger" onClick={() => setDeleteIds([...selected])}><Trash2 />Delete</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </Card>
          )}

          <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-border bg-card">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="w-10 px-3 py-2.5">
                    <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={(e) => setSelected((s) => { const n = new Set(s); slice.forEach((p) => (e.target.checked ? n.add(p.id) : n.delete(p.id))); return n; })} />
                  </th>
                  {th("Reference", "reference")}{th("Recipient", "recipient")}{th("Stop", "stop")}
                  {th("Weight", "weight", "text-right")}{th("Dimensions")}{th("Volume (m³)", "volume", "text-right")}
                  {th("Priority", "priority")}{th("Handling")}{th("Vehicle")}{th("Est. cost", "cost", "text-right")}{th("Status", "status")}
                  <th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {slice.map((p) => {
                  const asg = data?.assignments[p.id];
                  const vol = volumeOf(p);
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/40" aria-selected={selected.has(p.id)}>
                      <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Select ${p.reference}`} checked={selected.has(p.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} /></td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{p.reference}{p.kind === "pickup" && <Badge tone="violet" className="ml-2">Pickup</Badge>}</td>
                      <td className="px-3 py-2.5">{p.recipient || "—"}</td>
                      <td className="max-w-48 truncate px-3 py-2.5" title={stopOf(p)}>{stopOf(p) || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{p.weight_kg} kg</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{dims(p)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{vol === null ? "—" : vol}</td>
                      <td className="px-3 py-2.5"><StatusPill status={p.priority} /></td>
                      <td className="px-3 py-2.5">{p.handling.length ? <span className="flex flex-wrap gap-1">{p.handling.map((h) => <Badge key={h} tone="info">{h}</Badge>)}</span> : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{asg ? (asg.vehicle_name ?? asg.vehicle_id) : <span className="text-muted-foreground">Unassigned</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{asg?.cost != null ? inr.format(asg.cost) : "—"}</td>
                      <td className="px-3 py-2.5"><StatusPill status={p.status.replace(/_/g, " ")} /></td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <Button size="icon" variant="ghost" aria-label={`Edit ${p.reference}`} onClick={() => { setEditing(p); setFormOpen(true); }}><Pencil /></Button>
                        <Button size="icon" variant="ghost" aria-label={`Delete ${p.reference}`} onClick={() => setDeleteIds([p.id])}><Trash2 /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {slice.length === 0 && (
              <EmptyState className="rounded-none border-0" title="No packages match your filters" action={<Button onClick={resetFilters}>Clear filters</Button>} />
            )}
          </div>
          <p className="text-xs text-muted-foreground">Est. cost and vehicle come from the most recent saved plan that includes the package.</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {rows.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–{Math.min(rows.length, (safePage + 1) * PAGE_SIZE)} of {rows.length}{rows.length !== packages.length && ` (${packages.length} total)`}</span>
            <div className="flex items-center gap-1">
              <Button size="icon" aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft /></Button>
              <span className="px-2">Page {safePage + 1} / {pages}</span>
              <Button size="icon" aria-label="Next page" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}><ChevronRight /></Button>
            </div>
          </div>
        </div>
      )}

      <PackageFormDialog
        open={formOpen} onOpenChange={setFormOpen} editing={editing} existing={packages}
        onSubmit={async (input, base) => { await save.mutateAsync({ input, base }); }}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} existingRefs={packages.map((p) => normRef(p.reference))} onImport={doImport} />
      <ConfirmDialog
        open={deleteIds !== null} onOpenChange={(o) => { if (!o) setDeleteIds(null); }} destructive confirmLabel="Delete"
        title={deleteIds && deleteIds.length > 1 ? `Delete ${deleteIds.length} packages?` : "Delete package?"}
        description="This permanently removes the selected packages. Assignments in saved plans may be affected."
        onConfirm={() => { if (deleteIds) void doDelete(deleteIds); }}
      />
    </>
  );
}
