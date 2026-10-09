"use client";
import { Bike, Gauge, Truck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChartView, ChartCard } from "@/components/charts/charts";
import { formatDuration, formatINR } from "@/lib/utils";
import type { OptimizationRun, PlanStop, Recommendation, VehicleProfile } from "@/lib/api";

const REF_KM = 8;

export function VehicleUsageSummary({ stops, recs }: { stops: PlanStop[]; recs?: Recommendation[] }) {
  const counts = new Map<string, number>();
  recs?.forEach((r) => { if (r.recommended) counts.set(r.recommended.name, (counts.get(r.recommended.name) ?? 0) + 1); });
  return (
    <Card>
      <CardHeader icon={<Truck />} title="Vehicle Usage Summary" />
      <div className="flex flex-wrap gap-2 p-4">
        {counts.size === 0 && <p className="text-xs text-muted-foreground">{stops.length ? "Waiting for recommendations…" : "No stops yet."}</p>}
        {[...counts].map(([name, n]) => (
          <div key={name} className="min-w-[72px] rounded-xl border border-border px-3 py-2 text-center">
            <Bike className="mx-auto size-5 text-muted-foreground" />
            <div className="mt-1 text-xs font-semibold">{name}</div>
            <Badge tone="success">{n} stop{n === 1 ? "" : "s"}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function EstimatedMetrics({ run, recs }: { run: OptimizationRun | null; recs?: Recommendation[] }) {
  const cost = recs?.reduce((a, r) => a + (r.recommended?.total_cost ?? 0), 0);
  return (
    <Card>
      <CardHeader icon={<Gauge />} title="Estimated Metrics" />
      <div className="grid grid-cols-3 gap-2 p-4" title="Run an optimization to compute distance and time">
        <M label={run?.distance_is_estimate ? "Distance (est.)" : "Total distance"} value={run?.distance_km != null ? `${Math.round(run.distance_km * 10) / 10} km` : "—"} />
        <M label="Est. time" value={run?.duration_min != null ? formatDuration(run.duration_min) : "—"} />
        <M label="Dispatch cost*" value={cost ? formatINR(cost) : "n/a"} />
      </div>
      <p className="px-4 pb-3 text-[10px] text-muted-foreground">*Sum of per-stop recommended-vehicle trip costs (each stop priced as a separate round trip).</p>
    </Card>
  );
}
function M({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border p-2.5"><div className="text-[10px] text-muted-foreground">{label}</div><div className="text-sm font-bold">{value}</div></div>;
}

export function VehicleCharts({ vehicles }: { vehicles?: VehicleProfile[] }) {
  if (!vehicles?.length) return null;
  const mileage = vehicles.map((v) => ({ label: v.name, value: v.efficiency_unit === "km_per_l" ? v.efficiency_value : null }));
  const cost = vehicles.map((v) => ({ label: v.name, value: Math.round(Number(v.fixed_cost_per_delivery) + REF_KM * Number(v.operating_cost_per_km)) }));
  const time = vehicles.map((v) => ({ label: v.name, value: Math.round((REF_KM / v.avg_speed_kmph) * 60 + 5) }));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard title="Mileage Comparison (km/L)" subtitle="Electric vehicles shown as N/A (km/kWh)"><BarChartView data={mileage} unit="km/L" /></ChartCard>
      <ChartCard title="Cost per Delivery (₹)" subtitle={`Reference ${REF_KM} km one-way trip, fixed + per-km cost`}><BarChartView data={cost} unit="₹" /></ChartCard>
      <ChartCard title="Delivery Time per Vehicle (mins)" subtitle={`Reference ${REF_KM} km trip at average speed + 5 min service`}><BarChartView data={time} unit="min" /></ChartCard>
    </div>
  );
}
