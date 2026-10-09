"use client";
import * as React from "react";
import { Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { api, isApiError, type PlanStop, type Recommendation, type VehicleProfile } from "@/lib/api";
import { formatINR } from "@/lib/utils";

export function RecommendationPanel({ stops, recs, vehicles, loading, error, onRetry }: {
  stops: PlanStop[]; recs?: Recommendation[]; vehicles?: VehicleProfile[]; loading: boolean; error: unknown; onRetry: () => void;
}) {
  const estimated = api.demo || (recs ?? []).some((r) => r.fallback_estimate);
  const [reasonFor, setReasonFor] = React.useState<{ stop: PlanStop; rec: Recommendation } | null>(null);
  const byId = new Map(recs?.map((r) => [r.package_id, r]));
  const vname = (id: string) => vehicles?.find((v) => v.id === id)?.name ?? id;

  return (
    <Card>
      <CardHeader icon={<Sparkles />} title="Vehicle Recommendation" subtitle={estimated ? "Based on weight, distance and cost. Distances are straight-line fallback estimates." : "Based on weight, road distance (OSRM) and cost."} action={<Badge tone="warning">Rule-based</Badge>} />
      <div className="max-h-[620px] space-y-0 divide-y divide-border overflow-y-auto px-4 py-2">
        {stops.length === 0 && <EmptyState title="Add stops first" description="Recommendations appear once you have delivery stops." className="my-3 py-8" />}
        {loading && stops.length > 0 && Array.from({ length: Math.min(stops.length, 5) }).map((_, i) => <Skeleton key={i} className="my-3 h-14" />)}
        {!!error && !loading && <div className="py-3"><ErrorState title="Could not load recommendations" message={isApiError(error) ? error.userMessage : "Unexpected error"} onRetry={onRetry} /></div>}
        {!loading && !error && stops.map((s, i) => {
          const rec = byId.get(s.id);
          const best = rec?.recommended;
          return (
            <div key={s.id} className="flex items-start gap-3 py-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-info text-xs font-bold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{s.name}</div>
                <div className="text-[11px] text-muted-foreground">{s.zone_kind} · {s.weight_kg} kg</div>
                {best ? (
                  <div className="mt-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">{best.name}</span><Badge tone="success">Recommended</Badge></div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">≈ {formatINR(best.total_cost)} per trip · {(best.payload_utilisation * 100).toFixed(0)}% payload used</div>
                  </div>
                ) : rec ? (
                  <div className="mt-1 text-xs font-medium text-danger">No eligible vehicle (load or range too high)</div>
                ) : null}
              </div>
              {rec && <Button size="sm" onClick={() => setReasonFor({ stop: s, rec })}>View Reason</Button>}
            </div>
          );
        })}
      </div>

      <Dialog open={!!reasonFor} onOpenChange={(o) => !o && setReasonFor(null)}>
        {reasonFor && (
          <DialogContent title={`Why ${reasonFor.rec.recommended?.name ?? "no vehicle"} for ${reasonFor.stop.name}?`} description={`${reasonFor.stop.packages} package(s), ${reasonFor.stop.weight_kg} kg, ${Math.round(reasonFor.rec.distance_km * 10) / 10} km from depot (${reasonFor.rec.fallback_estimate || api.demo ? "straight-line estimate" : "road distance"})`}>
            <p className="text-sm">{reasonFor.rec.explanation}</p>
            {reasonFor.rec.recommended && (
              <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted p-3 text-xs">
                <dt className="text-muted-foreground">Variable cost</dt><dd className="text-right font-semibold">{formatINR(reasonFor.rec.recommended.variable_cost, 2)}</dd>
                <dt className="text-muted-foreground">Fixed cost</dt><dd className="text-right font-semibold">{formatINR(reasonFor.rec.recommended.fixed_cost, 2)}</dd>
                <dt className="text-muted-foreground">Energy used</dt><dd className="text-right font-semibold">{reasonFor.rec.recommended.energy_used} {reasonFor.rec.recommended.energy_unit}</dd>
                <dt className="text-muted-foreground">Score</dt><dd className="text-right font-semibold">{reasonFor.rec.recommended.score}</dd>
              </dl>
            )}
            {reasonFor.rec.alternatives.length > 0 && (
              <section className="mt-4"><h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Alternatives</h4>
                <ul className="mt-1 space-y-1 text-sm">{reasonFor.rec.alternatives.map((a) => <li key={a.vehicle_id} className="flex justify-between"><span>{a.name}</span><span className="text-muted-foreground">{formatINR(a.total_cost)} · score {a.score}</span></li>)}</ul>
              </section>
            )}
            {reasonFor.rec.ineligible.length > 0 && (
              <section className="mt-4"><h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ruled out</h4>
                <ul className="mt-1 space-y-1 text-xs">{reasonFor.rec.ineligible.map((x) => <li key={x.vehicle_id}><span className="font-semibold">{vname(x.vehicle_id)}:</span> {x.reasons.join("; ")}</li>)}</ul>
              </section>
            )}
            {reasonFor.rec.assumptions.length > 0 && (
              <section className="mt-4"><h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Assumptions</h4>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">{reasonFor.rec.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
              </section>
            )}
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
}
