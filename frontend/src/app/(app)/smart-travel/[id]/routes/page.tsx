"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle, Clock, MapPin, Fuel, Info } from "lucide-react";
import dynamic from "next/dynamic";
import { generateRouteOptions, type RouteOption } from "@/lib/api/travel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TravelRouteMap = dynamic(() => import("@/components/maps/TravelRouteMap"), { ssr: false });

function fmt(n: number, unit: string) { return `${n.toLocaleString("en-IN")} ${unit}`; }
function fmtInr(n: number) { return `₹${n.toLocaleString("en-IN")}`; }
function fmtHours(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const ROUTE_COLORS: Record<number, string> = { 0: "#22c55e", 1: "#3b82f6", 2: "#f59e0b" };

function RouteCard({
  option,
  idx,
  selected,
  onSelect,
}: {
  option: RouteOption;
  idx: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-2xl border-2 p-4 transition-all",
        selected ? "border-brand bg-brand-soft shadow-sm" : "border-border bg-card hover:bg-muted",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full flex-shrink-0" style={{ background: ROUTE_COLORS[idx] ?? "#888" }} />
            <span className="font-semibold text-[15px]">{option.label}</span>
            {idx === 0 && <span className="text-[10px] font-bold uppercase tracking-wide bg-success text-white px-2 py-0.5 rounded-full">Recommended</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
        </div>
        {selected && <CheckCircle className="size-5 text-brand shrink-0" />}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Distance</span>
          <span className="font-semibold">{fmt(Math.round(option.total_distance_km), "km")}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Drive time</span>
          <span className="font-semibold">{fmtHours(option.total_duration_min)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Est. days</span>
          <span className="font-semibold">{option.estimated_days}–{option.estimated_days + 2} days</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Est. fuel</span>
          <span className="font-semibold">{option.estimated_fuel_cost_inr ? fmtInr(option.estimated_fuel_cost_inr) : "—"}</span>
        </div>
      </div>

      {option.estimated_total_cost_inr && (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Est. total cost</span>
          <span className="font-bold text-brand text-base">{fmtInr(option.estimated_total_cost_inr)}</span>
        </div>
      )}

      {option.fallback_estimate && (
        <p className="mt-2 text-[11px] text-warning flex items-center gap-1">
          <AlertTriangle className="size-3" /> {option.note ?? "Estimate only — road routing unavailable"}
        </p>
      )}
      {option.note && !option.fallback_estimate && (
        <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
          <Info className="size-3" /> {option.note}
        </p>
      )}
    </button>
  );
}

export default function RouteOptionsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const {
    data: routes,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["travel-routes", id],
    queryFn: () => generateRouteOptions(id),
  });

  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = routes?.[selectedIdx];

  // Gather all geometries for map
  const mapRoutes = routes?.map((r, i) => ({
    geometry: r.geometry,
    color: ROUTE_COLORS[i] ?? "#888",
    active: i === selectedIdx,
  })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Recommended Routes</h2>
          <p className="text-sm text-muted-foreground">Compare and select based on your preferences.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>Regenerate</Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" /> Failed to generate routes. Check your origin/destination and try again.
        </div>
      )}

      {routes && (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Route list */}
          <div className="space-y-3 lg:col-span-2">
            {routes.map((r, i) => (
              <RouteCard
                key={r.id}
                option={r}
                idx={i}
                selected={selectedIdx === i}
                onSelect={() => setSelectedIdx(i)}
              />
            ))}

            <div className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-xs text-warning flex items-start gap-2">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              <span>Route alternatives are generated using road distance data from OSRM and user-configured assumptions. Actual journey times, costs and conditions will vary. Verify before travel.</span>
            </div>

            {selected && (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => router.push(`/smart-travel/${id}/checkpoints`)}
              >
                Continue with this route <ArrowRight className="size-4" />
              </Button>
            )}
          </div>

          {/* Map */}
          <div className="lg:col-span-3">
            <Card className="overflow-hidden">
              <div className="h-[480px]">
                <TravelRouteMap routes={mapRoutes} />
              </div>
              {selected && (
                <CardContent className="border-t border-border py-3">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="size-3" /> {selected.checkpoints.length} stops</span>
                    <span className="flex items-center gap-1"><Clock className="size-3" /> {fmtHours(selected.total_duration_min)} drive total</span>
                    <span className="flex items-center gap-1"><Fuel className="size-3" /> {selected.data_source}</span>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
