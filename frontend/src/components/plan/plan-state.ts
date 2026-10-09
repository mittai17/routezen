"use client";
import * as React from "react";
import { api, USE_DEMO_DATA, type OptimizationRun, type PlanStop } from "@/lib/api";
import type { Constraints, OptimizeConfig } from "@/lib/schemas";
import { uid } from "@/lib/utils";

/** Real coordinates of Chennai Central, the default depot. */
export const DEFAULT_DEPOT = { id: "loc-depot", name: "Depot (Chennai Central)", lat: 13.0827, lng: 80.2757 };

export const STEPS = [
  { title: "Locations", subtitle: "Add delivery stops" },
  { title: "Vehicle Recommendation", subtitle: "Best vehicle per stop" },
  { title: "Constraints", subtitle: "Time, capacity, priority" },
  { title: "Optimize", subtitle: "Choose algorithm and run" },
  { title: "Results", subtitle: "Visit order and metrics" },
];

export interface PlanState {
  step: number;
  maxStep: number;
  stops: PlanStop[];
  constraints: Constraints;
  config: OptimizeConfig;
  run: OptimizationRun | null;
}

export const defaultConstraints: Constraints = {
  depot_id: DEFAULT_DEPOT.id, start_time: "09:00", max_vehicles: 2, respect_capacity: true, respect_time_windows: true,
  priority_handling: "consider", return_to_depot: true, prefer_electric: false,
};

export function initialState(): PlanState {
  return {
    step: 0, maxStep: 0,
    stops: USE_DEMO_DATA ? api.demoPlanStops() : [],
    constraints: defaultConstraints,
    config: { algorithm: "classical_2opt", objective: "distance" },
    run: null,
  };
}

export type PlanAction =
  | { type: "goto"; step: number }
  | { type: "hydrate"; state: PlanState }
  | { type: "addStop"; stop: Omit<PlanStop, "id"> }
  | { type: "updateStop"; stop: PlanStop }
  | { type: "removeStop"; id: string }
  | { type: "duplicateStop"; id: string }
  | { type: "moveStop"; from: number; to: number }
  | { type: "setStops"; stops: PlanStop[] }
  | { type: "setConstraints"; constraints: Constraints }
  | { type: "setConfig"; config: OptimizeConfig }
  | { type: "setRun"; run: OptimizationRun | null };

/** Any change to the inputs invalidates a previous optimisation result. */
const invalidate = (s: PlanState, patch: Partial<PlanState>): PlanState => ({ ...s, ...patch, run: null, maxStep: Math.min(s.maxStep, 3) });

export function planReducer(s: PlanState, a: PlanAction): PlanState {
  switch (a.type) {
    case "hydrate": return a.state;
    case "goto": return { ...s, step: a.step, maxStep: Math.max(s.maxStep, a.step) };
    case "addStop": return invalidate(s, { stops: [...s.stops, { ...a.stop, id: uid("stop") }] });
    case "updateStop": return invalidate(s, { stops: s.stops.map((x) => (x.id === a.stop.id ? a.stop : x)) });
    case "removeStop": return invalidate(s, { stops: s.stops.filter((x) => x.id !== a.id) });
    case "duplicateStop": {
      const i = s.stops.findIndex((x) => x.id === a.id);
      if (i < 0) return s;
      const copy = { ...s.stops[i], id: uid("stop"), name: `${s.stops[i].name} (copy)` };
      return invalidate(s, { stops: [...s.stops.slice(0, i + 1), copy, ...s.stops.slice(i + 1)] });
    }
    case "moveStop": {
      if (a.to < 0 || a.to >= s.stops.length || a.from === a.to) return s;
      const next = [...s.stops];
      const [m] = next.splice(a.from, 1);
      next.splice(a.to, 0, m);
      return invalidate(s, { stops: next });
    }
    case "setStops": return invalidate(s, { stops: a.stops });
    case "setConstraints": return invalidate(s, { constraints: a.constraints });
    case "setConfig": return invalidate(s, { config: a.config });
    case "setRun": return { ...s, run: a.run, maxStep: a.run ? 4 : s.maxStep };
  }
}

const KEY = "routezen-plan-v1";

/** Plan state survives step changes and page reloads (sessionStorage, best effort). */
export function usePlanState() {
  const [state, dispatch] = React.useReducer(planReducer, undefined, initialState);
  const skipFirstWrite = React.useRef(true);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) dispatch({ type: "hydrate", state: { ...initialState(), ...JSON.parse(raw) } });
    } catch { /* corrupt or unavailable storage: start fresh */ }
  }, []);

  React.useEffect(() => {
    // The first run holds the not-yet-hydrated initial state; writing it would clobber the saved plan.
    if (skipFirstWrite.current) { skipFirstWrite.current = false; return; }
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }, [state]);

  return [state, dispatch] as const;
}
