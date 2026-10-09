/**
 * Quantum Optimization Lab.
 *
 * NOTE for reconciliation: docs/MOBILE.md's navigation group isn't built yet (no
 * src/app/(tabs)/_layout.tsx exists at the time this was written — the design-system
 * agent owns that file and the rest of src/components/{brand,ui}). Per the task
 * instructions this screen was placed at src/app/(tabs)/lab/index.tsx (a sibling of
 * map/ and analytics/, not nested under logistics) so it's reachable once the tab bar
 * exists; whoever wires up (tabs)/_layout.tsx should add a "lab" tab pointing here, or
 * move this file under a different group if the final IA differs (e.g. nested under
 * logistics, per the showcase image's "Quantum Lab" placement next to Analytics).
 *
 * Runs the same small, fixed, labelled Chennai stop set (see src/lib/api/optimization.ts
 * LAB_DEPOT/LAB_STOPS) through POST /optimization/{classical,quantum,annealing} so the
 * three solvers can be compared on one instance, exactly mirroring what the backend
 * returns — no "quantum advantage" number is computed or claimed anywhere here; the
 * QuantumResult.disclaimer string from the live API is shown verbatim instead.
 *
 * All solving happens server-side: classical/quantum/annealing POSTs return 202 + a
 * queued RunRecord, which this screen polls via GET /optimization/runs/{id} until a
 * terminal status. Nothing here runs optimization math on-device.
 */
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Atom, CheckCircle2, CircleDashed, Info, Play, XCircle } from "lucide-react-native";

import { Button, ScreenHeader } from "../../../components/ui";
import {
  LAB_DEPOT,
  LAB_STOPS,
  LAB_VEHICLE,
  QUANTUM_MAX_STOPS,
  listRuns,
  pollRun,
  startAnnealing,
  startClassical,
  startQuantum,
  type OptimizationResult,
  type QuantumResult,
  type RunRecord,
  type RunStatus,
} from "../../../lib/api/optimization";
import { ApiError } from "../../../lib/api/client";

type SolverKind = "classical" | "quantum" | "annealing";
const SOLVER_LABEL: Record<SolverKind, string> = { classical: "Classical (OR-Tools)", quantum: "Quantum (QAOA, simulated)", annealing: "Simulated annealing" };

interface SolverState {
  status: RunStatus | "idle" | "starting" | "error";
  run: RunRecord<OptimizationResult | QuantumResult> | null;
  errorMessage: string | null;
}
const IDLE_STATE: SolverState = { status: "idle", run: null, errorMessage: null };

function StatusIcon({ status }: { status: SolverState["status"] }) {
  if (status === "succeeded") return <CheckCircle2 size={16} color="#1B6B3F" />;
  if (status === "failed" || status === "error" || status === "timed_out" || status === "cancelled") return <XCircle size={16} color="#B3261E" />;
  if (status === "idle") return <CircleDashed size={16} color="#5B6B60" />;
  return <ActivityIndicator size="small" color="#D9A61E" />;
}

/** Distance/objective shown in the comparison table, in matrix units (km for the "distance" objective used here). */
function objectiveOf(kind: SolverKind, state: SolverState): number | null {
  if (!state.run?.result) return null;
  if (kind === "classical") return (state.run.result as OptimizationResult).total_distance_km ?? null;
  return (state.run.result as QuantumResult).cost ?? null;
}
function runtimeOf(state: SolverState): number | null {
  return state.run?.result?.runtime_ms ?? null;
}
function gapOf(kind: SolverKind, state: SolverState): number | null {
  if (kind === "classical" || !state.run?.result) return null;
  return (state.run.result as QuantumResult).gap_vs_brute_force_pct ?? null;
}

export default function QuantumLabTab() {
  const [stopCount, setStopCount] = useState(3);
  const [reps, setReps] = useState(1);
  const [shots, setShots] = useState(1024);
  const [solvers, setSolvers] = useState<Record<SolverKind, SolverState>>({ classical: IDLE_STATE, quantum: IDLE_STATE, annealing: IDLE_STATE });
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stops = useMemo(() => LAB_STOPS.slice(0, stopCount), [stopCount]);

  const historyQuery = useQuery({
    queryKey: ["optimization", "runs", "history"],
    queryFn: () => listRuns({ limit: 15 }),
    enabled: !running,
    staleTime: 10_000,
  });

  function updateSolver(kind: SolverKind, patch: Partial<SolverState>) {
    setSolvers((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
  }

  async function runExperiment() {
    setRunning(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSolvers({ classical: { ...IDLE_STATE, status: "starting" }, quantum: { ...IDLE_STATE, status: "starting" }, annealing: { ...IDLE_STATE, status: "starting" } });

    const bareStops = stops.map(({ label, ...s }) => s);

    const tasks: Promise<void>[] = [
      (async () => {
        try {
          const started = await startClassical({ depot: LAB_DEPOT, stops: bareStops, vehicles: [LAB_VEHICLE], return_to_depot: true, time_limit_s: 5 });
          updateSolver("classical", { status: started.status, run: started });
          const final = await pollRun<OptimizationResult>(started.id, {
            signal: controller.signal,
            onUpdate: (rec) => updateSolver("classical", { status: rec.status, run: rec }),
          });
          updateSolver("classical", { status: final.status, run: final, errorMessage: final.error });
        } catch (err) {
          updateSolver("classical", { status: "error", errorMessage: err instanceof ApiError ? err.message : "Classical run failed." });
        }
      })(),
      (async () => {
        try {
          const started = await startQuantum({ depot: LAB_DEPOT, stops: bareStops, objective: "distance", reps, shots, return_to_depot: true });
          updateSolver("quantum", { status: started.status, run: started });
          const final = await pollRun<QuantumResult>(started.id, {
            maxWaitMs: 150_000,
            signal: controller.signal,
            onUpdate: (rec) => updateSolver("quantum", { status: rec.status, run: rec }),
          });
          updateSolver("quantum", { status: final.status, run: final, errorMessage: final.error });
        } catch (err) {
          updateSolver("quantum", { status: "error", errorMessage: err instanceof ApiError ? err.message : "Quantum run failed." });
        }
      })(),
      (async () => {
        try {
          const started = await startAnnealing({ depot: LAB_DEPOT, stops: bareStops, objective: "distance", return_to_depot: true });
          updateSolver("annealing", { status: started.status, run: started });
          const final = await pollRun<QuantumResult>(started.id, {
            signal: controller.signal,
            onUpdate: (rec) => updateSolver("annealing", { status: rec.status, run: rec }),
          });
          updateSolver("annealing", { status: final.status, run: final, errorMessage: final.error });
        } catch (err) {
          updateSolver("annealing", { status: "error", errorMessage: err instanceof ApiError ? err.message : "Annealing run failed." });
        }
      })(),
    ];

    await Promise.allSettled(tasks);
    setRunning(false);
    historyQuery.refetch();
  }

  const anyError = (Object.keys(solvers) as SolverKind[]).find((k) => solvers[k].status === "error");
  const quantumDisclaimer = (solvers.quantum.run?.result as QuantumResult | undefined)?.disclaimer;

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="pb-10">
      <ScreenHeader
        title="Quantum Optimization Lab"
        subtitle="TSP route-ordering: classical vs. quantum (simulated) vs. annealing"
        right={<Atom size={20} color="#1B6B3F" />}
      />

      <View className="flex-row items-start gap-2 bg-info/10 px-4 py-2">
        <Info size={14} color="#1D5FB3" style={{ marginTop: 2 }} />
        <Text className="flex-1 text-xs text-ink-muted">
          Quantum results come from a classical statevector simulation of QAOA (Qiskit Aer), capped at {QUANTUM_MAX_STOPS} stops server-side.
          No quantum hardware is used and no quantum-advantage figure is shown — only what the API actually returns.
        </Text>
      </View>

      <View className="gap-4 p-4">
        <View className="rounded-card border border-border bg-surface p-4">
          <Text className="mb-3 text-sm font-semibold text-ink">Problem configuration</Text>

          <Text className="text-xs font-medium uppercase text-ink-muted">Stops ({stopCount})</Text>
          <View className="mb-3 mt-1 flex-row gap-2">
            {[2, 3, QUANTUM_MAX_STOPS].map((n) => (
              <Pressable
                key={n}
                onPress={() => setStopCount(n)}
                disabled={running}
                className={`rounded-pill border px-3 py-1.5 ${stopCount === n ? "border-brand-green bg-brand-green" : "border-border bg-muted"}`}
              >
                <Text className={`text-xs font-medium ${stopCount === n ? "text-white" : "text-ink"}`}>{n} stops</Text>
              </Pressable>
            ))}
          </View>
          <Text className="mb-3 text-xs text-ink-muted">{stops.map((s) => s.label).join(" -> ")} (fixed Chennai sample; real coordinates, illustrative demand)</Text>

          <Text className="text-xs font-medium uppercase text-ink-muted">QAOA reps (depth)</Text>
          <View className="mb-3 mt-1 flex-row gap-2">
            {[1, 2, 3].map((n) => (
              <Pressable
                key={n}
                onPress={() => setReps(n)}
                disabled={running}
                className={`rounded-pill border px-3 py-1.5 ${reps === n ? "border-brand-green bg-brand-green" : "border-border bg-muted"}`}
              >
                <Text className={`text-xs font-medium ${reps === n ? "text-white" : "text-ink"}`}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-xs font-medium uppercase text-ink-muted">Shots</Text>
          <View className="mt-1 flex-row gap-2">
            {[256, 1024, 4096, 8192].map((n) => (
              <Pressable
                key={n}
                onPress={() => setShots(n)}
                disabled={running}
                className={`rounded-pill border px-3 py-1.5 ${shots === n ? "border-brand-green bg-brand-green" : "border-border bg-muted"}`}
              >
                <Text className={`text-xs font-medium ${shots === n ? "text-white" : "text-ink"}`}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Button
          label={running ? "Running experiment…" : "Run Experiment"}
          onPress={runExperiment}
          loading={running}
          variant="secondary"
          size="lg"
          icon={running ? undefined : <Play size={18} color="#0E4429" />}
        />

        {(["classical", "quantum", "annealing"] as SolverKind[]).map((kind) => {
          const s = solvers[kind];
          if (s.status === "idle") return null;
          return (
            <View key={kind} className="flex-row items-center gap-2 rounded-card border border-border bg-muted px-3 py-2">
              <StatusIcon status={s.status} />
              <Text className="flex-1 text-xs text-ink">
                {SOLVER_LABEL[kind]}: {s.status}
                {s.errorMessage ? ` — ${s.errorMessage}` : ""}
              </Text>
            </View>
          );
        })}

        {anyError && (
          <View className="flex-row items-center gap-2 rounded-card bg-danger/10 px-3 py-2">
            <AlertTriangle size={14} color="#B3261E" />
            <Text className="flex-1 text-xs text-ink-muted">At least one solver failed — see the status rows above for the backend&apos;s error message.</Text>
          </View>
        )}

        {quantumDisclaimer && <Text className="rounded-card bg-warning/10 px-3 py-2 text-xs italic text-ink-muted">{quantumDisclaimer}</Text>}

        <View className="rounded-card border border-border bg-surface p-4">
          <Text className="mb-3 text-sm font-semibold text-ink">Results comparison</Text>
          <View className="flex-row border-b border-border pb-2">
            <Text className="flex-[1.4] text-xs font-semibold text-ink-muted">Solver</Text>
            <Text className="flex-1 text-right text-xs font-semibold text-ink-muted">Dist. (km)</Text>
            <Text className="flex-1 text-right text-xs font-semibold text-ink-muted">Time</Text>
            <Text className="flex-1 text-right text-xs font-semibold text-ink-muted">Gap vs BF</Text>
          </View>
          {(["classical", "quantum", "annealing"] as SolverKind[]).map((kind) => {
            const s = solvers[kind];
            const obj = objectiveOf(kind, s);
            const rt = runtimeOf(s);
            const gap = gapOf(kind, s);
            return (
              <View key={kind} className="flex-row items-center border-b border-border/60 py-2">
                <Text className="flex-[1.4] text-xs text-ink">{SOLVER_LABEL[kind]}</Text>
                <Text className="flex-1 text-right text-xs text-ink">{obj !== null ? obj.toFixed(2) : "—"}</Text>
                <Text className="flex-1 text-right text-xs text-ink">{rt !== null ? `${Math.round(rt)} ms` : "—"}</Text>
                <Text className="flex-1 text-right text-xs text-ink">
                  {kind === "classical" ? "n/a (no field)" : gap !== null ? `${gap.toFixed(1)}%` : "—"}
                </Text>
              </View>
            );
          })}
          <Text className="mt-2 text-[11px] text-ink-muted">
            Classical&apos;s OptimizationResult schema has no brute-force comparison field, so that column is genuinely unavailable for it —
            not a loading state. Quantum/annealing&apos;s gap_vs_brute_force_pct is null when the backend skips brute-force comparison (e.g.
            instance too large).
          </Text>
        </View>

        <View className="rounded-card border border-border bg-surface p-4">
          <Text className="mb-2 text-sm font-semibold text-ink">Experiment history</Text>
          {historyQuery.isLoading ? (
            <ActivityIndicator color="#0E4429" />
          ) : historyQuery.isError ? (
            <Text className="text-xs text-danger">Could not load run history.</Text>
          ) : (historyQuery.data?.items.length ?? 0) === 0 ? (
            <Text className="text-xs text-ink-muted">No runs yet.</Text>
          ) : (
            historyQuery.data!.items.map((r) => (
              <View key={r.id} className="flex-row items-center justify-between border-b border-border/60 py-1.5">
                <Text className="text-xs text-ink">{SOLVER_LABEL[(r.kind as SolverKind) ?? "classical"] ?? r.kind}</Text>
                <Text className="text-xs text-ink-muted">{r.status}</Text>
                <Text className="text-xs text-ink-muted">{new Date(r.created_at).toLocaleTimeString()}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
