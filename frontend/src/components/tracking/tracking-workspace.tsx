"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, FlaskConical, Radio, RotateCcw, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge, DemoBadge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Switch, Textarea } from "@/components/ui/form-controls";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { MapView } from "@/components/maps/map-view";
import type { MapStop } from "@/components/maps/map-types";
import { api } from "@/lib/api";
import type { DeliveryEvent, Plan } from "@/lib/api/analytics";
import {
  EVENT_LABEL, STOP_EVENT_TYPES, deriveTracking, loadTrackingData, postEvent, type DelayIndicator, type EventType, type RouteState, type StopState, type TrackingData,
} from "@/lib/api/tracking";

const ROUTE_STATE: Record<RouteState, { label: string; tone: Tone }> = {
  planned: { label: "Planned (not dispatched)", tone: "neutral" },
  dispatched: { label: "Dispatched, not started", tone: "warning" },
  in_progress: { label: "In progress", tone: "info" },
  completed: { label: "Completed", tone: "success" },
};
const INDICATOR: Record<DelayIndicator, { label: string; tone: Tone }> = {
  on_time: { label: "On time", tone: "success" }, late: { label: "Late", tone: "danger" }, overdue: { label: "Overdue", tone: "danger" },
  pending: { label: "Scheduled", tone: "neutral" }, no_eta: { label: "No ETA", tone: "neutral" },
};
const STATUS_TONE: Record<string, Tone> = { pending: "neutral", arrived: "info", delivered: "success", failed: "danger", delayed: "warning" };

const fmtTime = (t: number | null) => (t === null ? "—" : new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
const toLocalInput = (t: number) => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60_000); return d.toISOString().slice(0, 16); };
const MIN = 60_000;

export function TrackingWorkspace() {
  const q = useQuery({ queryKey: ["tracking-data"], queryFn: loadTrackingData, refetchInterval: (query) => (query.state.data?.source === "api" ? 30_000 : false) });
  const [planId, setPlanId] = React.useState<string>("");
  const [simulation, setSimulation] = React.useState(false);
  const [simEvents, setSimEvents] = React.useState<DeliveryEvent[]>([]);
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(i); }, []);

  const data = q.data;
  const plans = React.useMemo(() => (data?.plans ?? []).filter((p) => p.status !== "cancelled" && p.assignments.length > 0), [data]);
  const plan = plans.find((p) => p.id === planId) ?? plans.find((p) => p.status === "dispatched") ?? plans[0];

  return (
    <>
      <PageHeader
        title="Live Tracking"
        description="Route status from planned ETAs and manually reported events. There is no GPS feed."
        actions={<>{data?.source === "demo" && <DemoBadge />}</>}
      />
      {q.isLoading && <div role="status" aria-label="Loading tracking" className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-96" /></div>}
      {q.isError && <ErrorState title="Could not load tracking data" message={q.error instanceof Error ? q.error.message : undefined} onRetry={() => q.refetch()} />}
      {data && plans.length === 0 && (
        <EmptyState icon={<Radio />} title="No plans to track" description="Save a plan with assigned packages from Plan Delivery. Once it exists you can report stop events here." />
      )}
      {data && plan && (
        <PlanTracker
          key={plan.id} data={data} plans={plans} plan={plan} onPlan={setPlanId} now={now}
          simulation={simulation} onSimulation={(v) => { setSimulation(v); setSimEvents([]); }} simEvents={simEvents} setSimEvents={setSimEvents}
        />
      )}
    </>
  );
}

function PlanTracker({ data, plans, plan, onPlan, now, simulation, onSimulation, simEvents, setSimEvents }: {
  data: TrackingData; plans: Plan[]; plan: Plan; onPlan: (id: string) => void; now: number; simulation: boolean; onSimulation: (v: boolean) => void;
  simEvents: DeliveryEvent[]; setSimEvents: React.Dispatch<React.SetStateAction<DeliveryEvent[]>>;
}) {
  const qc = useQueryClient();
  const events = simulation ? simEvents : data.events;
  const clock = simulation && simEvents.length ? Math.max(...simEvents.map((e) => Date.parse(e.occurred_at))) : now;
  const view = React.useMemo(() => deriveTracking(plan, data.packages, events, clock), [plan, data.packages, events, clock]);
  const planEvents = events.filter((e) => e.plan_id === plan.id).sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
  const depot = data.locations.find((l) => l.id === plan.depot_location_id);
  const vehicleName = (id?: string | null) => data.vehicles.find((v) => v.id === id)?.name ?? "—";

  const mappable = view.stops.filter((s) => s.lat !== null && s.lng !== null);
  const coords = React.useMemo(
    () => (depot ? [{ lat: depot.latitude, lng: depot.longitude }, ...mappable.map((s) => ({ lat: s.lat as number, lng: s.lng as number }))] : []),
    [depot, mappable],
  );
  const route = useQuery({
    queryKey: ["tracking-route", plan.id, coords.map((c) => `${c.lat},${c.lng}`).join("|")],
    queryFn: () => api.route(coords),
    enabled: coords.length >= 2, retry: false, staleTime: 5 * 60_000,
  });
  const mapStops: MapStop[] = mappable.map((s, i) => ({
    id: s.packageId, lat: s.lat as number, lng: s.lng as number, label: `${s.recipient} · ${s.status}`, order: i + 1,
    tone: s.status === "delivered" ? "success" : s.indicator === "late" || s.indicator === "overdue" || s.status === "failed" ? "high" : "default",
  }));

  const mutation = useMutation({
    mutationFn: postEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracking-data"] }),
  });

  const submit = (ev: { type: EventType; packageId: string | null; message: string; at: number }): Promise<void> => {
    const vehicleId = view.stops.find((s) => s.packageId === ev.packageId)?.vehicleId ?? plan.assignments[0]?.vehicle_id ?? null;
    const body = { plan_id: plan.id, package_id: ev.packageId, vehicle_id: vehicleId, type: ev.type, message: ev.message || null, occurred_at: new Date(ev.at).toISOString() };
    if (simulation) {
      setSimEvents((prev) => [...prev, { id: `sim-${prev.length}-${ev.at}`, ...body, latitude: null, longitude: null }]);
      return Promise.resolve();
    }
    return mutation.mutateAsync(body).then(() => undefined);
  };

  const simulateNext = (lateMin: number) => {
    const next = view.stops.find((s) => s.status !== "delivered" && s.status !== "failed");
    if (!next) return;
    const base = next.plannedEta ?? clock;
    void submit({ type: "delivered", packageId: next.packageId, message: lateMin ? `Simulated delivery ${lateMin} min late` : "Simulated on-time delivery", at: base + lateMin * MIN });
  };

  const rs = ROUTE_STATE[view.routeState];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 flex-1 space-y-1.5">
            <label htmlFor="plan" className="text-xs font-semibold">Plan</label>
            <Select id="plan" value={plan.id} onChange={(e) => onPlan(e.target.value)}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.status})</option>)}
            </Select>
          </div>
          <Switch checked={simulation} onChange={(e) => onSimulation(e.target.checked)} label="Simulation mode" />
          <Badge tone={rs.tone}>{rs.label}</Badge>
          <span className="text-xs text-muted-foreground">Vehicle: {vehicleName(plan.assignments[0]?.vehicle_id)}</span>
        </CardContent>
      </Card>

      {simulation && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-warning bg-warning-soft px-4 py-3 text-sm">
          <FlaskConical className="size-5 shrink-0 text-warning" />
          <p className="min-w-60 flex-1"><strong>SIMULATION.</strong> Events below are local to this page and are never saved or sent to the server. There is no GPS; no vehicle position is shown or simulated.</p>
          <Button size="sm" onClick={() => simulateNext(0)}>Deliver next on time</Button>
          <Button size="sm" onClick={() => simulateNext(15)}>Deliver next 15 min late</Button>
          <Button size="sm" variant="ghost" onClick={() => setSimEvents([])}><RotateCcw /> Reset</Button>
        </div>
      )}

      <section aria-label="Progress" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4 sm:col-span-2">
          <div className="flex items-baseline justify-between text-sm"><span className="font-semibold">Progress</span><span>{view.done} of {view.total} stops complete</span></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Route progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.progress * 100)}>
            <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${view.progress * 100}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{Math.round(view.progress * 100)}% (delivered or failed stops count as complete)</div>
        </Card>
        <Card className="flex items-center gap-3 p-4"><Clock className="size-5 text-danger" /><div><div className="text-xs text-muted-foreground">Late deliveries</div><div className="text-lg font-bold">{view.late}</div></div></Card>
        <Card className="flex items-center gap-3 p-4"><AlertTriangle className="size-5 text-warning" /><div><div className="text-xs text-muted-foreground">Overdue (no report yet)</div><div className="text-lg font-bold">{view.overdue}</div></div></Card>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader title="Stops: planned vs actual" subtitle={`Late = more than 5 min after ETA. Times in your local timezone.`} />
          <CardContent className="overflow-x-auto pt-2">
            <table className="w-full min-w-[30rem] text-left text-xs">
              <caption className="sr-only">Per-stop status with planned and actual times</caption>
              <thead className="text-muted-foreground"><tr><th scope="col" className="py-1.5">#</th><th scope="col">Stop</th><th scope="col">Status</th><th scope="col">Planned</th><th scope="col">Actual</th><th scope="col">Delay</th></tr></thead>
              <tbody>{view.stops.map((s, i) => <StopRow key={s.packageId} s={s} i={i} />)}</tbody>
            </table>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <div className="h-80 xl:h-[26rem]">
            <MapView
              height="100%" stops={mapStops} geometry={route.data?.geometry as [number, number][] | null | undefined}
              depot={depot ? { lat: depot.latitude, lng: depot.longitude, label: depot.name } : undefined}
            />
          </div>
          <p className="text-xs text-muted-foreground" role="status">
            {!depot ? "No depot is linked to this plan, so no road route is requested. Stop markers show real package coordinates."
              : route.isLoading ? "Requesting road geometry…"
              : route.isError ? "Routing unavailable: no road geometry, so no route line is drawn."
              : "Route line is real road geometry from the routing provider. Markers are planned stop locations, not vehicle positions."}
          </p>
          {mapStops.length < view.stops.length && <p className="text-xs text-warning">{view.stops.length - mapStops.length} stop(s) have no coordinates and are not on the map.</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <EventForm key={plan.id + String(simulation)} stops={view.stops} simulation={simulation} busy={mutation.isPending} serverError={!simulation && mutation.isError ? (mutation.error instanceof Error ? mutation.error.message : "Failed to save event") : null} onSubmit={submit} />
        <Card>
          <CardHeader title="Event log" subtitle={simulation ? "Simulated events (not saved)" : "Reported events for this plan, newest first"} />
          <CardContent className="max-h-80 overflow-y-auto pt-2">
            {planEvents.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No events reported yet.</p> : (
              <ol className="space-y-2">
                {planEvents.map((e) => {
                  const stop = view.stops.find((s) => s.packageId === e.package_id);
                  return (
                    <li key={e.id} className="flex gap-2 text-xs">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <span className="font-semibold">{EVENT_LABEL[e.type] ?? e.type}</span>{stop ? ` · ${stop.recipient}` : ""}
                        <span className="text-muted-foreground"> · {fmtTime(Date.parse(e.occurred_at))}</span>
                        {e.message && <div className="text-muted-foreground">{e.message}</div>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StopRow({ s, i }: { s: StopState; i: number }) {
  const ind = INDICATOR[s.indicator];
  return (
    <tr className="border-t border-border align-top">
      <td className="py-2 pr-2 font-semibold">{i + 1}</td>
      <th scope="row" className="pr-2 py-2 font-medium"><div>{s.recipient}</div><div className="font-normal text-muted-foreground">{s.reference}</div></th>
      <td><Badge tone={STATUS_TONE[s.status]}>{s.status[0].toUpperCase() + s.status.slice(1)}</Badge></td>
      <td>{fmtTime(s.plannedEta)}</td>
      <td>{fmtTime(s.actualAt)}</td>
      <td><Badge tone={ind.tone}>{ind.label}</Badge>{s.delayMin !== null && s.delayMin !== 0 && <div className="mt-0.5 text-muted-foreground">{s.delayMin > 0 ? "+" : ""}{s.delayMin} min</div>}</td>
    </tr>
  );
}

function EventForm({ stops, simulation, busy, serverError, onSubmit }: {
  stops: StopState[]; simulation: boolean; busy: boolean; serverError: string | null;
  onSubmit: (ev: { type: EventType; packageId: string | null; message: string; at: number }) => Promise<void>;
}) {
  const open = stops.filter((s) => s.status !== "delivered" && s.status !== "failed");
  const [stopId, setStopId] = React.useState<string>(open[0]?.packageId ?? "route");
  const [type, setType] = React.useState<EventType>("delivered");
  const [when, setWhen] = React.useState(() => toLocalInput(Date.now()));
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const isRoute = stopId === "route";
  const types: EventType[] = isRoute ? ["route_started", "route_completed"] : STOP_EVENT_TYPES;
  const effectiveType = types.includes(type) ? type : types[0];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const at = new Date(when).getTime();
    if (isNaN(at)) return setError("Enter a valid date and time.");
    if (at > new Date().getTime() + 5 * MIN && !simulation) return setError("Event time cannot be in the future.");
    if (!isRoute && !open.some((s) => s.packageId === stopId)) return setError("That stop is already complete.");
    setError(null);
    try {
      await onSubmit({ type: effectiveType, packageId: isRoute ? null : stopId, message: message.trim(), at });
      setSaved(true);
      setMessage("");
      const next = open.find((s) => s.packageId !== stopId);
      if (!isRoute && effectiveType !== "arrived" && effectiveType !== "delayed" && next) setStopId(next.packageId);
    } catch { /* surfaced through serverError */ }
  };

  return (
    <Card>
      <CardHeader title={simulation ? "Report event (simulation)" : "Report status event"} subtitle={simulation ? "Local only. Not sent to the server." : "Sends POST /events. Use this when a driver or dispatcher confirms a status."} icon={<Send />} />
      <CardContent className="pt-3">
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2" noValidate>
          <FormField label="Stop" htmlFor="ev-stop">
            <Select id="ev-stop" value={stopId} onChange={(e) => setStopId(e.target.value)}>
              <option value="route">Whole route</option>
              {open.map((s, i) => <option key={s.packageId} value={s.packageId}>{i + 1}. {s.recipient}</option>)}
            </Select>
          </FormField>
          <FormField label="Status" htmlFor="ev-type">
            <Select id="ev-type" value={effectiveType} onChange={(e) => setType(e.target.value as EventType)}>
              {types.map((t) => <option key={t} value={t}>{EVENT_LABEL[t]}</option>)}
            </Select>
          </FormField>
          <FormField label="Time" htmlFor="ev-when" error={error ?? undefined}>
            <Input id="ev-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-invalid={!!error} />
          </FormField>
          <FormField label="Note (optional)" htmlFor="ev-msg">
            <Textarea id="ev-msg" value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} className="min-h-10" />
          </FormField>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : simulation ? "Add simulated event" : "Report event"}</Button>
            {saved && <span role="status" className="text-xs font-medium text-success">Event recorded.</span>}
            {serverError && <span role="alert" className="text-xs font-medium text-danger">{serverError}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
