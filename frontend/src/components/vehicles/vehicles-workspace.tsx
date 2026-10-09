"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArchiveRestore, Archive, ArrowDown, ArrowUp, CheckCircle2, Copy, GitCompareArrows, Leaf, Pencil, Plus, Search, ShieldCheck, Trash2, Truck, Weight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge, DemoBadge, StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Input, Select } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { describeWriteError, vehiclesApi, type VehicleInput } from "@/lib/api/vehicles";
import { isApiError, type VehicleProfile } from "@/lib/api";
import { formatINR, formatNumber } from "@/lib/utils";
import { VehicleFormDialog, type FormMode } from "./vehicle-form-dialog";
import { VerificationBadge } from "./verification-badge";
import {
  ENERGY_LABEL, ENERGY_TYPES, VERIFICATIONS, VERIFICATION_LABEL, categoryLabel, costPerKm, efficiencyUnitLabel, energyCostPerKm, issueCounts, priceUnitLabel, specIssues,
  type EnergyType, type SpecIssue, type Verification,
} from "./vehicle-utils";

type SortKey = "name" | "payload_kg" | "volume_m3" | "efficiency" | "cost_per_km" | "emissions";
type Row = VehicleProfile & { cpk: number; issues: SpecIssue[] };
const SORTS: { key: SortKey; label: string; get: (r: Row) => string | number }[] = [
  { key: "name", label: "Name", get: (r) => r.name },
  { key: "payload_kg", label: "Payload", get: (r) => r.payload_kg },
  { key: "volume_m3", label: "Volume", get: (r) => r.volume_m3 },
  { key: "efficiency", label: "Efficiency", get: (r) => r.efficiency_value },
  { key: "cost_per_km", label: "Cost / km", get: (r) => r.cpk },
  { key: "emissions", label: "Emissions", get: (r) => r.emissions_g_per_km },
];
const MAX_COMPARE = 4;
const inr = (n: number) => formatINR(n, 2);

function IssueBadge({ issues }: { issues: SpecIssue[] }) {
  const { errors, warnings } = issueCounts(issues);
  if (errors) return <Badge tone="danger"><AlertTriangle className="size-3" />{errors} error{errors > 1 ? "s" : ""}</Badge>;
  if (warnings) return <Badge tone="warning"><AlertTriangle className="size-3" />{warnings} to review</Badge>;
  return <Badge tone="success"><CheckCircle2 className="size-3" />Complete</Badge>;
}

export function VehiclesWorkspace() {
  const qc = useQueryClient();
  const { data, error, isPending, refetch } = useQuery({ queryKey: ["vehicles"], queryFn: () => vehiclesApi.list() });

  const [q, setQ] = React.useState("");
  const [energy, setEnergy] = React.useState<"" | EnergyType>("");
  const [category, setCategory] = React.useState("");
  const [verification, setVerification] = React.useState<"" | Verification>("");
  const [status, setStatus] = React.useState<"active" | "archived" | "all">("active");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [selected, setSelected] = React.useState<string[]>([]);
  const [form, setForm] = React.useState<{ mode: FormMode; vehicle?: VehicleProfile } | null>(null);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<VehicleProfile | null>(null);
  const [toArchive, setToArchive] = React.useState<VehicleProfile | null>(null);
  const [notice, setNotice] = React.useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const all: Row[] = React.useMemo(() => (data ?? []).map((v) => ({ ...v, cpk: costPerKm(v), issues: specIssues(v) })), [data]);
  const categories = React.useMemo(() => Array.from(new Set(all.map((v) => v.category))).sort(), [all]);

  const rows = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    const get = SORTS.find((x) => x.key === sort.key)!.get;
    return all
      .filter((v) => (status === "all" ? true : status === "active" ? v.available : !v.available))
      .filter((v) => !energy || v.energy_type === energy)
      .filter((v) => !category || v.category === category)
      .filter((v) => !verification || v.verification === verification)
      .filter((v) => !s || `${v.name} ${v.category} ${v.source}`.toLowerCase().includes(s))
      .sort((a, b) => {
        const x = get(a), y = get(b);
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir;
      });
  }, [all, q, energy, category, verification, status, sort]);

  const filtersOn = !!(q || energy || category || verification || status !== "active");
  const bestCpk = rows.length > 1 ? Math.min(...rows.map((r) => r.cpk)) : null;
  const bestEmis = rows.length > 1 ? Math.min(...rows.map((r) => r.emissions_g_per_km)) : null;

  const stats = React.useMemo(() => {
    const active = all.filter((v) => v.available);
    const unverified = all.filter((v) => v.verification === "assumed").length;
    return {
      total: all.length, active: active.length, archived: all.length - active.length,
      capacity: active.reduce((s, v) => s + v.payload_kg, 0),
      avgCpk: active.length ? active.reduce((s, v) => s + v.cpk, 0) / active.length : null,
      unverified, attention: all.filter((v) => issueCounts(v.issues).errors + issueCounts(v.issues).warnings > 0).length,
    };
  }, [all]);

  const onDone = (text: string) => { setNotice({ tone: "ok", text }); qc.invalidateQueries({ queryKey: ["vehicles"] }); };
  const onFail = (e: unknown) => setNotice({ tone: "err", text: describeWriteError(e) });

  const save = useMutation({
    mutationFn: async ({ mode, id, data }: { mode: FormMode; id?: string; data: VehicleInput }) => (mode === "edit" && id ? vehiclesApi.update(id, data) : vehiclesApi.create(data)),
    onSuccess: (_r, v) => onDone(v.mode === "edit" ? "Vehicle profile updated." : v.mode === "duplicate" ? "Vehicle profile duplicated." : "Vehicle profile added."),
  });
  const avail = useMutation({
    mutationFn: ({ v, available }: { v: VehicleProfile; available: boolean }) => vehiclesApi.setAvailable(v, available),
    onSuccess: (_r, { available, v }) => onDone(available ? `${v.name} restored.` : `${v.name} archived. It is excluded from recommendations.`),
    onError: onFail,
  });
  const del = useMutation({ mutationFn: (id: string) => vehiclesApi.remove(id), onSuccess: () => onDone("Vehicle profile deleted."), onError: onFail });

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const toggleSel = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_COMPARE ? s : [...s, id]));
  const detail = detailId ? all.find((v) => v.id === detailId) ?? null : null;
  const compare = selected.map((id) => all.find((v) => v.id === id)).filter((v): v is Row => !!v);

  const actions = (v: Row) => (
    <div className="flex items-center justify-end gap-0.5">
      <Button size="icon" variant="ghost" aria-label={`Edit ${v.name}`} onClick={() => setForm({ mode: "edit", vehicle: v })}><Pencil /></Button>
      <Button size="icon" variant="ghost" aria-label={`Duplicate ${v.name}`} onClick={() => setForm({ mode: "duplicate", vehicle: v })}><Copy /></Button>
      {v.available
        ? <Button size="icon" variant="ghost" aria-label={`Archive ${v.name}`} onClick={() => setToArchive(v)}><Archive /></Button>
        : <Button size="icon" variant="ghost" aria-label={`Restore ${v.name}`} onClick={() => avail.mutate({ v, available: true })}><ArchiveRestore /></Button>}
      <Button size="icon" variant="ghost" aria-label={`Delete ${v.name}`} className="text-danger hover:bg-danger-soft" onClick={() => setToDelete(v)}><Trash2 /></Button>
    </div>
  );

  const sortHead = (k: SortKey, children: React.ReactNode, className?: string) => (
    <th key={k} scope="col" className={`px-2.5 py-2.5 font-semibold ${className ?? ""}`} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground" onClick={() => toggleSort(k)}>
        {children}{sort.key === k && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  return (
    <>
      <PageHeader
        title="Vehicle Profiles"
        description="Specifications used to estimate cost, capacity fit and emissions. Profiles are costing assumptions, not live fleet tracking."
        actions={<>{vehiclesApi.demo && <DemoBadge />}<Button variant="primary" onClick={() => setForm({ mode: "create" })}><Plus />Add vehicle</Button></>}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {isPending ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[76px]" />) : (
          <>
            <StatCard label="Vehicle profiles" value={stats.total} icon={<Truck />} tone="info" hint={`${stats.archived} archived`} />
            <StatCard label="Available for planning" value={stats.active} icon={<CheckCircle2 />} tone="success" hint={`${formatNumber(stats.capacity, 0)} kg total payload`} />
            <StatCard label="Avg cost per km" value={stats.avgCpk == null ? "n/a" : inr(stats.avgCpk)} icon={<Weight />} tone="brand" hint="Energy + operating, available profiles" />
            <StatCard label="Assumed specs" value={`${stats.unverified} of ${stats.total}`} icon={stats.unverified ? <Leaf /> : <ShieldCheck />} tone={stats.unverified ? "violet" : "success"} hint={`${stats.attention} profile${stats.attention === 1 ? "" : "s"} with spec warnings`} />
          </>
        )}
      </div>

      {notice && (
        <div role={notice.tone === "err" ? "alert" : "status"} className={`mb-3 flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${notice.tone === "err" ? "border-danger/30 bg-danger-soft text-danger" : "border-success/30 bg-success-soft text-success"}`}>
          <span>{notice.text}</span>
          <button type="button" className="text-xs underline" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}

      <Card className="mb-3 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search vehicles" className="pl-9" placeholder="Search name, category or source…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select aria-label="Filter by energy type" value={energy} onChange={(e) => setEnergy(e.target.value as "" | EnergyType)}>
            <option value="">All energy types</option>{ENERGY_TYPES.map((t) => <option key={t} value={t}>{ENERGY_LABEL[t]}</option>)}
          </Select>
          <Select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>{categories.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </Select>
          <Select aria-label="Filter by verification" value={verification} onChange={(e) => setVerification(e.target.value as "" | Verification)}>
            <option value="">All verification</option>{VERIFICATIONS.map((v) => <option key={v} value={v}>{VERIFICATION_LABEL[v]}</option>)}
          </Select>
          <Select aria-label="Filter by availability" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="active">Available</option><option value="archived">Archived</option><option value="all">All profiles</option>
          </Select>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 xl:hidden">
            <label htmlFor="veh-sort">Sort by</label>
            <Select id="veh-sort" className="h-8 w-36 text-xs" value={sort.key} onChange={(e) => setSort((s) => ({ ...s, key: e.target.value as SortKey }))}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
            <Button size="sm" aria-label={sort.dir === 1 ? "Ascending" : "Descending"} onClick={() => setSort((s) => ({ ...s, dir: s.dir === 1 ? -1 : 1 }))}>{sort.dir === 1 ? <ArrowUp /> : <ArrowDown />}</Button>
          </div>
          <span aria-live="polite">{rows.length} of {all.length} profiles</span>
          <div className="flex items-center gap-2">
            {filtersOn && <Button size="sm" variant="ghost" onClick={() => { setQ(""); setEnergy(""); setCategory(""); setVerification(""); setStatus("active"); }}>Clear filters</Button>}
            <Button size="sm" disabled={selected.length < 2} onClick={() => setCompareOpen(true)}><GitCompareArrows />Compare{selected.length ? ` (${selected.length})` : ""}</Button>
          </div>
        </div>
      </Card>

      {isPending ? (
        <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : error ? (
        <ErrorState title="Could not load vehicle profiles" message={isApiError(error) ? error.userMessage : "Unexpected error"} onRetry={() => refetch()} />
      ) : all.length === 0 ? (
        <EmptyState icon={<Truck />} title="No vehicle profiles yet" description="Add a vehicle with payload, cargo volume, efficiency and energy price so the planner can estimate delivery cost and emissions."
          action={<Button variant="primary" onClick={() => setForm({ mode: "create" })}><Plus />Add vehicle</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No profiles match these filters" description="Try clearing a filter or searching for something else." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-border bg-card xl:block">
            <table className="w-full min-w-[1000px] text-sm">
              <caption className="sr-only">Vehicle profile comparison. Efficiency, price and cost columns show their units.</caption>
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="w-9 px-2.5 py-2.5"><span className="sr-only">Select to compare</span></th>
                  {sortHead("name", "Vehicle")}
                  <th scope="col" className="px-2.5 py-2.5 font-semibold">Energy</th>
                  {sortHead("payload_kg", "Payload (kg)", "text-right")}
                  {sortHead("volume_m3", "Volume (m³)", "text-right")}
                  {sortHead("efficiency", "Efficiency", "text-right")}
                  <th scope="col" className="px-2.5 py-2.5 text-right font-semibold">Energy price</th>
                  <th scope="col" className="px-2.5 py-2.5 text-right font-semibold">Operating (₹/km)</th>
                  {sortHead("cost_per_km", "Cost (₹/km)", "text-right")}
                  {sortHead("emissions", "CO₂ (g/km)", "text-right")}
                  <th scope="col" className="px-2.5 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-2.5 py-2.5 font-semibold">Data</th>
                  <th scope="col" className="px-2.5 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className={`border-t border-border hover:bg-muted/40 ${v.available ? "" : "opacity-70"}`}>
                    <td className="px-2.5 py-2.5"><input type="checkbox" className="size-4 accent-[var(--color-brand)]" aria-label={`Compare ${v.name}`} checked={selected.includes(v.id)} disabled={!selected.includes(v.id) && selected.length >= MAX_COMPARE} onChange={() => toggleSel(v.id)} /></td>
                    <td className="min-w-[10rem] px-2.5 py-2.5"><button type="button" className="text-left font-semibold hover:underline" onClick={() => setDetailId(v.id)}>{v.name}</button><div className="text-xs text-muted-foreground">{categoryLabel(v.category)}</div></td>
                    <td className="px-2.5 py-2.5">{ENERGY_LABEL[v.energy_type]}</td>
                    <td className="px-2.5 py-2.5 text-right tabular-nums">{formatNumber(v.payload_kg, 0)}</td>
                    <td className="px-2.5 py-2.5 text-right tabular-nums">{formatNumber(v.volume_m3, 2)}</td>
                    <td className="px-2.5 py-2.5 text-right tabular-nums">{formatNumber(v.efficiency_value)} <span className="text-xs text-muted-foreground">{efficiencyUnitLabel(v.efficiency_unit)}</span></td>
                    <td className="px-2.5 py-2.5 text-right tabular-nums">{inr(Number(v.energy_price))} <span className="text-xs text-muted-foreground">/{v.energy_type === "electric" ? "kWh" : "L"}</span></td>
                    <td className="px-2.5 py-2.5 text-right tabular-nums">{inr(Number(v.operating_cost_per_km))}</td>
                    <td className={`px-2.5 py-2.5 text-right tabular-nums font-semibold ${bestCpk === v.cpk ? "text-success" : ""}`} title={bestCpk === v.cpk ? "Lowest cost per km in this view" : undefined}>{inr(v.cpk)}{bestCpk === v.cpk && <span className="sr-only"> (lowest)</span>}</td>
                    <td className={`px-2.5 py-2.5 text-right tabular-nums ${bestEmis === v.emissions_g_per_km ? "font-semibold text-success" : ""}`} title={bestEmis === v.emissions_g_per_km ? "Lowest emissions in this view" : undefined}>{formatNumber(v.emissions_g_per_km, 0)}{bestEmis === v.emissions_g_per_km && <span className="sr-only"> (lowest)</span>}</td>
                    <td className="px-2.5 py-2.5"><StatusPill status={v.available ? "available" : "inactive"} label={v.available ? "Available" : "Archived"} /></td>
                    <td className="px-2.5 py-2.5"><div className="flex flex-col items-start gap-1"><VerificationBadge value={v.verification} /><button type="button" onClick={() => setDetailId(v.id)}><IssueBadge issues={v.issues} /></button></div></td>
                    <td className="px-2.5 py-2.5">{actions(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 xl:hidden" aria-label="Vehicle profiles">
            {rows.map((v) => (
              <li key={v.id}>
                <Card className={`p-3 ${v.available ? "" : "opacity-80"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button type="button" className="text-left font-semibold hover:underline" onClick={() => setDetailId(v.id)}>{v.name}</button>
                      <div className="text-xs text-muted-foreground">{categoryLabel(v.category)} · {ENERGY_LABEL[v.energy_type]}</div>
                    </div>
                    <label className="flex shrink-0 items-center gap-1.5 text-xs"><input type="checkbox" className="size-4" checked={selected.includes(v.id)} disabled={!selected.includes(v.id) && selected.length >= MAX_COMPARE} onChange={() => toggleSel(v.id)} />Compare</label>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div><dt className="text-muted-foreground">Payload</dt><dd className="font-medium">{formatNumber(v.payload_kg, 0)} kg</dd></div>
                    <div><dt className="text-muted-foreground">Cargo volume</dt><dd className="font-medium">{formatNumber(v.volume_m3, 2)} m³</dd></div>
                    <div><dt className="text-muted-foreground">Efficiency</dt><dd className="font-medium">{formatNumber(v.efficiency_value)} {efficiencyUnitLabel(v.efficiency_unit)}</dd></div>
                    <div><dt className="text-muted-foreground">Energy price</dt><dd className="font-medium">{inr(Number(v.energy_price))} {priceUnitLabel(v.energy_type).slice(1)}</dd></div>
                    <div><dt className="text-muted-foreground">Cost per km</dt><dd className="font-semibold">{inr(v.cpk)}</dd></div>
                    <div><dt className="text-muted-foreground">Emissions</dt><dd className="font-medium">{formatNumber(v.emissions_g_per_km, 0)} g/km</dd></div>
                  </dl>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusPill status={v.available ? "available" : "inactive"} label={v.available ? "Available" : "Archived"} />
                    <VerificationBadge value={v.verification} />
                    <button type="button" onClick={() => setDetailId(v.id)}><IssueBadge issues={v.issues} /></button>
                  </div>
                  <div className="mt-1 border-t border-border pt-1">{actions(v)}</div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <VehicleFormDialog
        open={!!form} onOpenChange={(o) => !o && setForm(null)} mode={form?.mode ?? "create"} categories={categories}
        initial={form?.vehicle ? stripId(form.vehicle) : undefined}
        onSubmit={async (data) => { await save.mutateAsync({ mode: form?.mode ?? "create", id: form?.vehicle?.id, data }); }}
      />

      <ConfirmDialog open={!!toArchive} onOpenChange={(o) => !o && setToArchive(null)} title="Archive vehicle profile?"
        description={`${toArchive?.name ?? "This profile"} will be marked unavailable and excluded from recommendations. You can restore it any time.`}
        confirmLabel="Archive" onConfirm={() => toArchive && avail.mutate({ v: toArchive, available: false })} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Delete vehicle profile?" destructive
        description={`${toDelete?.name ?? "This profile"} will be permanently deleted. Archive it instead if plans still refer to it.`}
        confirmLabel="Delete" onConfirm={() => toDelete && del.mutate(toDelete.id)} />

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        {detail && (
          <DialogContent title={detail.name} description={`${categoryLabel(detail.category)} · ${ENERGY_LABEL[detail.energy_type]}`} className="max-w-2xl">
            <div className="mb-3 flex flex-wrap gap-1.5"><StatusPill status={detail.available ? "available" : "inactive"} label={detail.available ? "Available" : "Archived"} /><VerificationBadge value={detail.verification} /><IssueBadge issues={detail.issues} /></div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              {specRows(detail).map(([k, val]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{val}</dd></div>)}
            </dl>
            <div className="mt-3 rounded-xl bg-muted/60 p-3 text-xs"><div className="font-semibold">Data source</div><p className="mt-0.5 break-words text-muted-foreground">{detail.source || "No source recorded."}</p></div>
            <h3 className="mt-4 text-sm font-semibold">Spec validation</h3>
            {detail.issues.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">All costing specs are present and plausible.</p> : (
              <ul className="mt-1 space-y-1.5 text-sm">
                {detail.issues.map((i, n) => (
                  <li key={n} className="flex gap-2"><Badge tone={i.severity === "error" ? "danger" : i.severity === "warning" ? "warning" : "neutral"}>{i.severity === "info" ? "Note" : i.severity === "error" ? "Error" : "Review"}</Badge><span>{i.message}</span></li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end gap-2"><Button onClick={() => { setDetailId(null); setForm({ mode: "edit", vehicle: detail }); }}><Pencil />Edit</Button></div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={compareOpen && compare.length >= 2} onOpenChange={setCompareOpen}>
        <DialogContent title="Compare vehicle profiles" description="Side-by-side specs. Lowest cost per km and emissions are marked." className="max-w-4xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th scope="col" className="py-2 pr-3 font-semibold">Spec</th>{compare.map((v) => <th key={v.id} scope="col" className="px-2 py-2 font-semibold text-foreground">{v.name}</th>)}</tr></thead>
              <tbody>
                {COMPARE_ROWS.map(([label, fn]) => (
                  <tr key={label} className="border-t border-border">
                    <th scope="row" className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">{label}</th>
                    {compare.map((v) => { const c = fn(v, compare); return <td key={v.id} className={`px-2 py-2 tabular-nums ${c.best ? "font-semibold text-success" : ""}`}>{c.text}{c.best && <span className="sr-only"> (best)</span>}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function stripId(v: VehicleProfile): VehicleInput {
  const copy: Partial<VehicleProfile> = { ...v };
  delete copy.id;
  return copy as VehicleInput;
}

function specRows(v: Row): [string, string][] {
  return [
    ["Payload", `${formatNumber(v.payload_kg, 0)} kg`], ["Cargo volume", `${formatNumber(v.volume_m3, 2)} m³`],
    ["Efficiency", `${formatNumber(v.efficiency_value)} ${efficiencyUnitLabel(v.efficiency_unit)}`],
    ["Energy price", `${inr(Number(v.energy_price))} per ${v.energy_type === "electric" ? "kWh" : "L"}`],
    ["Energy cost", `${inr(energyCostPerKm(v))} per km`], ["Operating cost", `${inr(Number(v.operating_cost_per_km))} per km`],
    ["Total cost", `${inr(v.cpk)} per km`], ["Fixed cost", `${inr(Number(v.fixed_cost_per_delivery))} per delivery`],
    ["Emissions factor", `${formatNumber(v.emissions_g_per_km, 0)} g CO₂/km`], ["Average speed", `${formatNumber(v.avg_speed_kmph, 0)} km/h`],
    ["Range", v.range_km == null ? "Not set" : `${formatNumber(v.range_km, 0)} km`],
  ];
}

type Cell = { text: string; best?: boolean };
/** Mark only when the values differ; a tie is not a "best". */
const lowest = (vals: number[], x: number) => Math.min(...vals) !== Math.max(...vals) && x === Math.min(...vals);
const highest = (vals: number[], x: number) => Math.min(...vals) !== Math.max(...vals) && x === Math.max(...vals);
const COMPARE_ROWS: [string, (v: Row, all: Row[]) => Cell][] = [
  ["Category", (v) => ({ text: categoryLabel(v.category) })],
  ["Energy type", (v) => ({ text: ENERGY_LABEL[v.energy_type] })],
  ["Payload (kg)", (v, a) => ({ text: formatNumber(v.payload_kg, 0), best: highest(a.map((x) => x.payload_kg), v.payload_kg) })],
  ["Cargo volume (m³)", (v, a) => ({ text: formatNumber(v.volume_m3, 2), best: highest(a.map((x) => x.volume_m3), v.volume_m3) })],
  ["Efficiency", (v) => ({ text: `${formatNumber(v.efficiency_value)} ${efficiencyUnitLabel(v.efficiency_unit)}` })],
  ["Energy price", (v) => ({ text: `${inr(Number(v.energy_price))} /${v.energy_type === "electric" ? "kWh" : "L"}` })],
  ["Energy cost (₹/km)", (v, a) => ({ text: inr(energyCostPerKm(v)), best: lowest(a.map(energyCostPerKm), energyCostPerKm(v)) })],
  ["Operating cost (₹/km)", (v) => ({ text: inr(Number(v.operating_cost_per_km)) })],
  ["Total cost (₹/km)", (v, a) => ({ text: inr(v.cpk), best: lowest(a.map((x) => x.cpk), v.cpk) })],
  ["Fixed cost (₹/delivery)", (v) => ({ text: inr(Number(v.fixed_cost_per_delivery)) })],
  ["Emissions (g CO₂/km)", (v, a) => ({ text: formatNumber(v.emissions_g_per_km, 0), best: lowest(a.map((x) => x.emissions_g_per_km), v.emissions_g_per_km) })],
  ["Range (km)", (v) => ({ text: v.range_km == null ? "Not set" : formatNumber(v.range_km, 0) })],
  ["Verification", (v) => ({ text: VERIFICATION_LABEL[v.verification] })],
  ["Availability", (v) => ({ text: v.available ? "Available" : "Archived" })],
];
