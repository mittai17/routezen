"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clock, Fuel, Leaf, MapPin, Route, Truck, ArrowRight, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { MapView } from "@/components/maps/map-view";
import { BarChartView, ChartCard } from "@/components/charts/charts";
import { api, isApiError, USE_DEMO_DATA } from "@/lib/api";
import { DEFAULT_DEPOT } from "@/components/plan/plan-state";
import { formatDuration, formatINR } from "@/lib/utils";

export function OverviewDashboard() {
  const summary = useQuery({ queryKey: ["summary"], queryFn: () => api.summary() });
  const vehicles = useQuery({ queryKey: ["vehicles"], queryFn: () => api.vehicles.list() });
  const stops = USE_DEMO_DATA ? api.demoPlanStops() : [];
  const s = summary.data;
  const high = stops.filter((x) => x.priority === "high");

  return (
    <>
      <PageHeader
        title="Overview"
        description="Delivery operations at a glance for Chennai."
        actions={<>{USE_DEMO_DATA && <DemoBadge />}<Button variant="primary" size="lg" asChild><Link href="/plan"><Route /> Plan Delivery</Link></Button></>}
      />

      {summary.isError ? (
        <ErrorState title="Could not load summary" message={isApiError(summary.error) ? summary.error.userMessage : undefined} onRetry={() => summary.refetch()} className="mb-4" />
      ) : (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {summary.isLoading || !s ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[84px]" />) : (
            <>
              <StatCard label="Total Distance" value={s.total_distance_km !== null ? `${s.total_distance_km} km` : "—"} icon={<Route />} tone="success" hint={USE_DEMO_DATA ? "Straight-line estimate" : undefined} />
              <StatCard label="Estimated Time" value={s.total_duration_min !== null ? formatDuration(s.total_duration_min) : "—"} icon={<Clock />} tone="brand" />
              <StatCard label="Delivery Stops" value={s.delivery_stops} icon={<MapPin />} tone="violet" hint={`${high.length} high priority`} />
              <StatCard label="Vehicles Used" value={`${s.vehicles_used} / ${s.fleet_size}`} icon={<Truck />} tone="info" hint="of fleet profiles" />
              <StatCard label="Fuel Cost (est.)" value={s.fuel_cost !== null ? formatINR(s.fuel_cost) : "—"} icon={<Fuel />} tone="danger" />
              <StatCard label="CO₂ Emission (est.)" value={s.co2_kg !== null ? `${s.co2_kg} kg` : "—"} icon={<Leaf />} tone="success" />
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <CardHeader title="Delivery Map" subtitle="Chennai delivery stops and depot" action={USE_DEMO_DATA ? <DemoBadge /> : undefined} />
          <CardContent>
            <div className="h-[420px]">
              <MapView
                depot={{ lat: DEFAULT_DEPOT.lat, lng: DEFAULT_DEPOT.lng, label: "Depot" }}
                stops={stops.map((x, i) => ({ id: x.id, lat: x.latitude, lng: x.longitude, label: x.name, order: i + 1, tone: x.priority === "high" ? "high" : "default" }))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Route Assistant" action={<Badge tone="warning">Rule-based</Badge>} subtitle="Observations derived from the current plan data" />
            <CardContent className="space-y-3 text-sm">
              {stops.length === 0 && <p className="text-muted-foreground">No stops planned yet.</p>}
              {high.length > 0 && (
                <Insight tone="danger" title={`${high.length} high-priority stop${high.length > 1 ? "s" : ""}`}>{high.map((h) => h.name).join(", ")}. Consider dispatching these first.</Insight>
              )}
              {stops.length > 0 && <Insight tone="info" title="Heaviest load">{[...stops].sort((a, b) => b.weight_kg - a.weight_kg)[0].name} ({[...stops].sort((a, b) => b.weight_kg - a.weight_kg)[0].weight_kg} kg) needs a larger vehicle.</Insight>}
              <Insight tone="warning" title="Routing">Road routing is unavailable in demo mode, so totals are straight-line estimates and no route line is shown.</Insight>
              <Button asChild className="w-full"><Link href="/plan">Open planner <ArrowRight /></Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Cost per Delivery by Vehicle (₹)" subtitle="Reference 8 km trip, fixed + per-km cost. Demo vehicle assumptions.">
          {vehicles.isLoading ? <Skeleton className="h-48" /> : <BarChartView unit="₹" data={(vehicles.data ?? []).map((v) => ({ label: v.name, value: Math.round(Number(v.fixed_cost_per_delivery) + 8 * Number(v.operating_cost_per_km)) }))} />}
        </ChartCard>
        <ChartCard title="CO₂ per km by Vehicle (g/km)" subtitle="Electric shown as 0 tailpipe emissions. Demo vehicle assumptions.">
          {vehicles.isLoading ? <Skeleton className="h-48" /> : <BarChartView unit="g/km" data={(vehicles.data ?? []).map((v) => ({ label: v.name, value: v.emissions_g_per_km }))} />}
        </ChartCard>
      </div>
    </>
  );
}

function Insight({ tone, title, children }: { tone: "danger" | "info" | "warning"; title: string; children: React.ReactNode }) {
  const cls = { danger: "bg-danger-soft text-danger", info: "bg-info-soft text-info", warning: "bg-warning-soft text-warning" }[tone];
  return (
    <div className="flex gap-2.5">
      <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${cls}`}><AlertCircle className="size-4" /></span>
      <div><div className="font-semibold leading-tight">{title}</div><div className="text-xs text-muted-foreground">{children}</div></div>
    </div>
  );
}
