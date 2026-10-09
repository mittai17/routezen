"use client";
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DemoBadge } from "@/components/ui/badge";
import { Stepper } from "@/components/ui/stepper";
import { PageHeader } from "@/components/ui/page-header";
import { MapView, type MapStop } from "@/components/maps/map-view";
import { api, USE_DEMO_DATA } from "@/lib/api";
import { STEPS, DEFAULT_DEPOT, usePlanState } from "./plan-state";
import { StopsPanel } from "./stops-panel";
import { RecommendationPanel } from "./recommendation-panel";
import { ConstraintsPanel } from "./constraints-panel";
import { OptimizePanel } from "./optimize-panel";
import { ResultsPanel } from "./results-panel";
import { EstimatedMetrics, VehicleCharts, VehicleUsageSummary } from "./plan-metrics";

export function PlanWorkspace() {
  const [state, dispatch] = usePlanState();
  const { step, stops, constraints, config, run } = state;

  const locations = useQuery({ queryKey: ["locations"], queryFn: () => api.locations.list() });
  const vehicles = useQuery({ queryKey: ["vehicles"], queryFn: () => api.vehicles.list() });
  const depots = React.useMemo(() => (locations.data ?? []).filter((l) => l.type === "depot" || l.type === "warehouse"), [locations.data]);
  const depotLoc = depots.find((d) => d.id === constraints.depot_id) ?? depots[0];
  const depot = depotLoc ? { id: depotLoc.id, name: depotLoc.name, lat: depotLoc.latitude, lng: depotLoc.longitude } : DEFAULT_DEPOT;

  const recSig = JSON.stringify([stops.map((s) => [s.id, s.latitude, s.longitude, s.weight_kg, s.service_minutes]), depot.lat, depot.lng, constraints.prefer_electric]);
  const recs = useQuery({
    queryKey: ["recommendations", recSig],
    queryFn: () => api.recommendations({ stops, depot: { lat: depot.lat, lng: depot.lng }, preferences: { prefer_electric: constraints.prefer_electric } }),
    enabled: stops.length > 0,
  });

  const optimize = useMutation({
    mutationFn: () => api.optimize({ stops, depot, algorithm: config.algorithm, objective: config.objective, max_vehicles: constraints.max_vehicles, constraints }),
    onSuccess: (r) => { dispatch({ type: "setRun", run: r }); dispatch({ type: "goto", step: 4 }); },
  });

  const go = (s: number) => dispatch({ type: "goto", step: s });
  const canNext = step === 0 ? stops.length > 0 : step === 3 ? !!run : step < 4;
  const showRun = !!run && step === 4;

  const orderIndex = new Map(showRun ? run!.order.map((id, i) => [id, i + 1]) : []);
  const mapStops: MapStop[] = (showRun ? [...stops].sort((a, b) => (orderIndex.get(a.id) ?? 99) - (orderIndex.get(b.id) ?? 99)) : stops).map((s, i) => ({
    id: s.id, lat: s.latitude, lng: s.longitude, label: s.name, order: i + 1, tone: s.priority === "high" ? "high" : "default",
  }));

  return (
    <>
      <PageHeader
        title="Plan Delivery"
        description="Add locations, set constraints and optimize your delivery route."
        actions={<>{USE_DEMO_DATA && <DemoBadge />}<Button variant="primary" size="lg" disabled={stops.length < 2} onClick={() => go(3)}><Play /> Optimize Routes</Button></>}
      />
      <Card className="mb-4 flex items-center px-3 py-2">
        <Stepper steps={STEPS.map((s, i) => (i === 0 ? { ...s, subtitle: `${stops.length} delivery stop${stops.length === 1 ? "" : "s"}` } : s))} current={step} maxReached={Math.max(state.maxStep, stops.length > 0 ? 3 : 0)} onSelect={go} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_380px]">
        <StopsPanel stops={stops} dispatch={dispatch} />

        <div className="min-w-0 space-y-4">
          <div className="h-[460px] md:h-[520px]">
            <MapView stops={mapStops} depot={{ lat: depot.lat, lng: depot.lng, label: "Depot" }} geometry={showRun ? run!.geometry : null} hideRouteNotice={!api.demo && !run} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <VehicleUsageSummary stops={stops} recs={recs.data} />
            <EstimatedMetrics run={run} recs={recs.data} />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <Card className="p-4">
              <h2 className="text-[15px] font-semibold">Step 1: Locations</h2>
              <p className="mt-1 text-sm text-muted-foreground">Add every delivery stop with its weight and priority. Stops are shown on the map as you add them. Then continue to see the best vehicle for each stop.</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <S k="Stops" v={stops.length} /><S k="Packages" v={stops.reduce((a, s) => a + s.packages, 0)} /><S k="Total kg" v={+stops.reduce((a, s) => a + s.weight_kg, 0).toFixed(1)} />
              </dl>
            </Card>
          )}
          {step === 1 && <RecommendationPanel stops={stops} recs={recs.data} vehicles={vehicles.data} loading={recs.isLoading} error={recs.error} onRetry={() => recs.refetch()} />}
          {step === 2 && <ConstraintsPanel value={constraints} depots={depots} onChange={(c) => dispatch({ type: "setConstraints", constraints: c })} />}
          {step === 3 && <OptimizePanel config={config} onChange={(c) => dispatch({ type: "setConfig", config: c })} onRun={() => optimize.mutate()} running={optimize.isPending} error={optimize.error} stopCount={stops.length} />}
          {step === 4 && <ResultsPanel run={run} stops={stops} depotName={depot.name} />}

          <div className="flex items-center justify-between gap-2">
            <Button disabled={step === 0} onClick={() => go(step - 1)}><ArrowLeft /> Back</Button>
            {step < 4 && step !== 3 && <Button variant="primary" disabled={!canNext} onClick={() => go(step + 1)}>Next: {STEPS[step + 1].title} <ArrowRight /></Button>}
            {step === 3 && run && <Button variant="primary" onClick={() => go(4)}>View Results <ArrowRight /></Button>}
          </div>
        </div>
      </div>

      {step >= 1 && (
        <div className="mt-4 space-y-2">
          {USE_DEMO_DATA && <div className="flex items-center gap-2 text-xs text-muted-foreground"><DemoBadge /> Vehicle specifications below are assumed demo values, not measurements.</div>}
          <VehicleCharts vehicles={vehicles.data} />
        </div>
      )}
    </>
  );
}

function S({ k, v }: { k: string; v: number }) {
  return <div className="rounded-xl bg-muted p-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-lg font-bold">{v}</dd></div>;
}
