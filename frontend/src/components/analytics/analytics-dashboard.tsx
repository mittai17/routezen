"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Coins, Gauge, Leaf, Route, Truck, Package as PackageIcon, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Select, Input } from "@/components/ui/form-controls";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChartView, ChartCard, type BarDatum } from "@/components/charts/charts";
import { loadAnalyticsInput, computeAnalytics, resolveRange, type AnalyticsResult, type RangePreset } from "@/lib/api/analytics";
import { formatINR, formatNumber } from "@/lib/utils";

const ENERGY_COLOR: Record<string, string> = { petrol: "var(--chart-2)", diesel: "var(--chart-4)", cng: "var(--chart-3)", electric: "var(--chart-1)" };
/** Compact, unique chart labels (chart keys must not collide). Full names stay available in tables. */
function shortLabels(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((full) => {
    const clean = full.replace(/\s*\(demo\)/i, "").trim();
    let s = clean;
    if (s.length > 13) { const [first, ...rest] = s.split(/\s+/); s = rest.length ? `${first.slice(0, 4)}. ${rest.join(" ")}` : s; }
    if (s.length > 14) s = `${s.slice(0, 13)}…`;
    const n = (seen.get(s) ?? 0) + 1;
    seen.set(s, n);
    return n > 1 ? `${s} (${n})` : s;
  });
}
const withLabels = <T extends { name: string }>(rows: T[]) => { const l = shortLabels(rows.map((r) => r.name)); return rows.map((r, i) => ({ r, label: l[i] })); };
const r2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);
const dash = "—";

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legend">
      {items.map((i) => <li key={i.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: i.color }} />{i.label}</li>)}
    </ul>
  );
}
const energyLegend = Object.entries(ENERGY_COLOR).map(([label, color]) => ({ label, color }));

export function AnalyticsDashboard() {
  const [preset, setPreset] = React.useState<RangePreset>("30d");
  const [custom, setCustom] = React.useState({ from: "", to: "" });
  const q = useQuery({ queryKey: ["analytics-input"], queryFn: loadAnalyticsInput });
  const data = q.data;
  const result = React.useMemo<AnalyticsResult | null>(
    () => (data ? computeAnalytics(data, resolveRange(preset, custom)) : null),
    [data, preset, custom],
  );
  const badRange = preset === "custom" && custom.from && custom.to && custom.from > custom.to;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Cost, energy, emissions and solver comparison across saved delivery plans."
        actions={data?.source === "demo" ? <DemoBadge /> : undefined}
      />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="range" className="text-xs font-semibold">Date range</label>
            <Select id="range" value={preset} onChange={(e) => setPreset(e.target.value as RangePreset)} className="w-44">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
              <option value="custom">Custom range</option>
            </Select>
          </div>
          {preset === "custom" && (
            <>
              <div className="space-y-1.5"><label htmlFor="from" className="text-xs font-semibold">From</label><Input id="from" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="w-40" /></div>
              <div className="space-y-1.5"><label htmlFor="to" className="text-xs font-semibold">To</label><Input id="to" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="w-40" /></div>
            </>
          )}
          <p className="text-xs text-muted-foreground">Plans are filtered by start time (or creation time). Cancelled plans are excluded.</p>
          {badRange && <p role="alert" className="w-full text-xs font-medium text-danger">The start date must be on or before the end date.</p>}
        </CardContent>
      </Card>

      {q.isLoading && (
        <div role="status" aria-label="Loading analytics" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          <Skeleton className="h-72" />
        </div>
      )}
      {q.isError && <ErrorState title="Could not load analytics" message={q.error instanceof Error ? q.error.message : undefined} onRetry={() => q.refetch()} />}
      {result && data && <Body r={result} runsNote={data.runsNote} />}
    </>
  );
}

function Body({ r, runsNote }: { r: AnalyticsResult; runsNote?: string | null }) {
  const t = r.totals;
  const planBars = (pick: (p: AnalyticsResult["plans"][number]) => number | null): BarDatum[] =>
    withLabels(r.plans.slice().sort((a, b) => a.date.localeCompare(b.date))).map(({ r: p, label }) => ({ label, value: r2(pick(p)) }));
  const fuel = r.vehicles.filter((v) => v.energyUnit === "L");
  const elec = r.vehicles.filter((v) => v.energyUnit === "kWh");
  const d = r.deadline;
  const pct = (v: number | null) => (v === null ? dash : `${Math.round(v * 100)}%`);

  return (
    <div className="space-y-4">
      {!r.hasPlans && (
        <EmptyState icon={<BarChart3 />} title="No plans in this date range" description="Save a plan from Plan Delivery, or widen the date range. Vehicle efficiency comparison below still reflects your vehicle profiles." />
      )}
      {r.hasPlans && (
        <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Plans / deliveries" value={`${t.plans} / ${t.deliveries}`} icon={<PackageIcon />} tone="info" />
          <StatCard label="Total cost" value={t.cost === null ? dash : formatINR(t.cost)} icon={<Coins />} tone="brand" hint="Sum of plan total_cost" />
          <StatCard label="Cost per delivery" value={t.costPerDelivery === null ? dash : formatINR(t.costPerDelivery, 2)} icon={<Coins />} tone="brand" />
          <StatCard label="Cost per km" value={t.costPerKm === null ? dash : `${formatINR(t.costPerKm, 2)}/km`} icon={<Route />} tone="brand" />
          <StatCard label="Distance" value={t.distanceKm === null ? dash : `${formatNumber(t.distanceKm)} km`} icon={<Route />} tone="info" hint={r.anyEstimatedDistance ? "Some per-vehicle shares estimated" : undefined} />
          <StatCard label="Energy used" value={`${formatNumber(t.energyByUnit.L)} L · ${formatNumber(t.energyByUnit.kWh)} kWh`} icon={<Zap />} tone="violet" hint={t.energyCost === null ? undefined : `Energy cost ${formatINR(t.energyCost)}`} />
          <StatCard label="Emissions (tailpipe est.)" value={t.emissionsKg === null ? dash : `${formatNumber(t.emissionsKg)} kg CO₂e`} icon={<Leaf />} tone="success" hint="See assumptions below" />
          <StatCard label="Capacity utilisation" value={pct(r.utilisationOverall)} icon={<Gauge />} tone="success" hint="Avg payload used per vehicle" />
        </section>
      )}

      {r.hasPlans && (
        <section aria-label="Cost and distance" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Cost per delivery" subtitle="₹ per delivery, by plan" icon={<Coins />}><BarChartView data={planBars((p) => p.costPerDelivery)} unit="₹" /></ChartCard>
          <ChartCard title="Cost per km" subtitle="₹ per km, by plan" icon={<Route />}><BarChartView data={planBars((p) => p.costPerKm)} unit="₹/km" /></ChartCard>
          <ChartCard title="Distance" subtitle="km, by plan (road distance as saved on the plan)" icon={<Route />}><BarChartView data={planBars((p) => p.distanceKm)} unit="km" /></ChartCard>
        </section>
      )}

      {r.hasPlans && (
        <section aria-label="Energy" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Fuel use" subtitle="Litres, by vehicle (distance ÷ rated km/L)" icon={<Zap />}>
            <Legend items={energyLegend.filter((l) => l.label !== "electric")} />
            <BarChartView data={withLabels(fuel).map(({ r: v, label }) => ({ label, value: r2(v.energyUsed), color: ENERGY_COLOR[v.energyType] }))} unit="L" />
          </ChartCard>
          <ChartCard title="Electricity use" subtitle="kWh, by vehicle (distance ÷ rated km/kWh)" icon={<Zap />}>
            <Legend items={energyLegend.filter((l) => l.label === "electric")} />
            <BarChartView data={withLabels(elec).map(({ r: v, label }) => ({ label, value: r2(v.energyUsed), color: ENERGY_COLOR.electric }))} unit="kWh" />
          </ChartCard>
        </section>
      )}

      <section aria-label="Efficiency comparison" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Efficiency comparison" subtitle="Energy cost per km (₹/km) from each profile's price ÷ efficiency" icon={<Gauge />}>
          <Legend items={energyLegend} />
          <BarChartView data={withLabels(r.efficiency).map(({ r: e, label }) => ({ label, value: r2(e.energyCostPerKm), color: ENERGY_COLOR[e.energyType] }))} unit="₹/km" />
        </ChartCard>
        <Card>
          <CardHeader title="Vehicle profile comparison" subtitle="Values come from vehicle profiles; check the verification flag" />
          <CardContent className="overflow-x-auto pt-2">
            {r.efficiency.length === 0 ? <p className="text-sm text-muted-foreground">No vehicle profiles yet.</p> : (
              <table className="w-full min-w-[30rem] text-left text-xs">
                <caption className="sr-only">Vehicle efficiency, operating cost and emissions per km</caption>
                <thead className="text-muted-foreground"><tr><th scope="col" className="py-1.5 pr-2">Vehicle</th><th scope="col">Efficiency</th><th scope="col">Operating ₹/km</th><th scope="col">Emissions g/km</th><th scope="col">Verification</th></tr></thead>
                <tbody>
                  {r.efficiency.map((e, i) => (
                    <tr key={`${e.name}-${i}`} className="border-t border-border">
                      <th scope="row" className="py-1.5 pr-2 font-medium">{e.name}</th>
                      <td>{formatNumber(e.efficiency)} {e.unit}</td><td>{formatINR(e.operatingCostPerKm, 2)}</td><td>{formatNumber(e.emissionsGPerKm, 0)}</td>
                      <td><Badge tone={e.verification === "assumed" ? "warning" : "success"}>{e.verification}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      {r.hasPlans && (
        <section aria-label="Usage and compliance" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Vehicle usage" subtitle="Packages assigned per vehicle in saved plans" icon={<Truck />}>
            <Legend items={energyLegend} />
            <BarChartView data={withLabels(r.vehicles).map(({ r: v, label }) => ({ label, value: v.assignments, color: ENERGY_COLOR[v.energyType] }))} unit="packages" />
            <p className="mt-2 text-[11px] text-muted-foreground">Recommendations are computed on demand and are not stored, so recommendation frequency is shown as how often each vehicle was actually assigned.</p>
          </ChartCard>
          <ChartCard title="Capacity utilisation" subtitle="Avg % of payload used per plan, by vehicle" icon={<Gauge />}>
            <BarChartView data={withLabels(r.vehicles).map(({ r: v, label }) => ({ label, value: v.avgUtilisation === null ? null : Math.round(v.avgUtilisation * 100) }))} unit="%" />
          </ChartCard>
          <Card>
            <CardHeader title="Deadline compliance" icon={<Activity />} subtitle="Packages that have a deadline" />
            <CardContent className="space-y-3 pt-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Actual (delivered events)</div>
                <div className="text-2xl font-bold">{pct(d.actualRate)}</div>
                <div className="text-xs text-muted-foreground">{d.actualOnTime} on time · {d.actualLate} late</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Planned (ETA vs deadline, not yet delivered)</div>
                <div className="text-2xl font-bold">{pct(d.plannedRate)}</div>
                <div className="text-xs text-muted-foreground">{d.plannedOnTime} feasible · {d.plannedLate} at risk</div>
              </div>
              <p className="text-[11px] text-muted-foreground">{d.noDeadline} package(s) have no deadline and {d.unknown} have no ETA; both are excluded.</p>
            </CardContent>
          </Card>
        </section>
      )}

      {r.hasPlans && (
        <section aria-label="Emissions" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Emissions" subtitle="kg CO₂e (tailpipe estimate), by vehicle" icon={<Leaf />}>
            <Legend items={energyLegend} />
            <BarChartView data={withLabels(r.vehicles).map(({ r: v, label }) => ({ label, value: r2(v.emissionsKg), color: ENERGY_COLOR[v.energyType] }))} unit="kg" />
          </ChartCard>
          <Card>
            <CardHeader title="Emissions assumptions" icon={<Leaf />} />
            <CardContent className="pt-2">
              <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
                <li>Emissions = distance × the vehicle profile&apos;s <code>emissions_g_per_km</code>, unless the plan carries its own total.</li>
                <li>Profile values are planning figures. Vehicles flagged &quot;assumed&quot; are not measured or manufacturer-verified.</li>
                <li>Electric vehicles show tailpipe 0 and exclude grid generation emissions.</li>
                <li>Where a plan has no per-stop distance, distance is split in proportion to assigned packages (estimate).</li>
                <li>This is not a certified carbon account and must not be used for regulatory reporting.</li>
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      <section aria-label="Classical versus quantum" className="space-y-3">
        <Card>
          <CardHeader title="Classical vs quantum (simulated)" icon={<Activity />} subtitle="Quantum figures are a classical simulation of QAOA (Qiskit Aer). No quantum advantage is claimed." action={<Badge tone="warning">Simulation</Badge>} />
          <CardContent className="space-y-4 pt-3">
            {r.solvers.every((s) => s.runs === 0) ? (
              <EmptyState title="No optimisation runs in this range" description="Run an optimisation from Plan Delivery to see solver statistics." className="py-8" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[26rem] text-left text-xs">
                    <caption className="sr-only">Optimisation runs by solver</caption>
                    <thead className="text-muted-foreground"><tr><th scope="col" className="py-1.5">Solver</th><th scope="col">Runs</th><th scope="col">Succeeded</th><th scope="col">Failed / cancelled</th><th scope="col">Avg runtime</th></tr></thead>
                    <tbody>
                      {r.solvers.map((s) => (
                        <tr key={s.kind} className="border-t border-border"><th scope="row" className="py-1.5 font-medium capitalize">{s.kind === "quantum" ? "Quantum (simulated)" : s.kind === "hybrid" ? "Hybrid (Aer + OR-Tools)" : "Classical (OR-Tools)"}</th><td>{s.runs}</td><td>{s.succeeded}</td><td>{s.failed}</td><td>{s.avgRuntimeMs === null ? dash : `${formatNumber(s.avgRuntimeMs, 0)} ms`}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {r.quantumRows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[32rem] text-left text-xs">
                      <caption className="mb-1 text-left font-semibold">Simulated quantum runs vs references (matrix units, usually km)</caption>
                      <thead className="text-muted-foreground"><tr><th scope="col" className="py-1.5">Stops</th><th scope="col">Quantum sim.</th><th scope="col">Classical</th><th scope="col">Brute force</th><th scope="col">Gap vs brute force</th><th scope="col">Matches</th></tr></thead>
                      <tbody>
                        {r.quantumRows.map((q) => (
                          <tr key={q.id} className="border-t border-border"><td className="py-1.5">{q.nStops ?? dash}</td><td>{q.quantumCost === null ? dash : formatNumber(q.quantumCost, 2)}</td><td>{q.classicalCost === null ? dash : formatNumber(q.classicalCost, 2)}</td><td>{q.bruteForceCost === null ? dash : formatNumber(q.bruteForceCost, 2)}</td><td>{q.gapPct === null ? dash : `${formatNumber(q.gapPct, 1)}%`}</td><td>{q.matchesBruteForce === null ? dash : q.matchesBruteForce ? "Yes" : "No"}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            {runsNote && <p className="text-[11px] text-muted-foreground">{runsNote}</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
