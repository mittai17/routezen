"use client";
import { AlertTriangle, Play, Zap } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/form-controls";
import { ErrorState } from "@/components/ui/states";
import { isApiError } from "@/lib/api";
import type { OptimizeConfig } from "@/lib/schemas";

const QUANTUM_MAX = 4;

export function OptimizePanel({ config, onChange, onRun, running, error, stopCount }: {
  config: OptimizeConfig; onChange: (c: OptimizeConfig) => void; onRun: () => void; running: boolean; error: unknown; stopCount: number;
}) {
  const isQuantum = config.algorithm === "quantum_simulated";
  const isHybrid = config.algorithm === "hybrid";
  const isSimulated = isQuantum || isHybrid;
  const quantumTooMany = isQuantum && stopCount > QUANTUM_MAX;
  const canRun = !running && stopCount >= 2 && !quantumTooMany;

  return (
    <Card>
      <CardHeader icon={<Zap />} title="Optimization Settings" subtitle="Choose how the visit order is computed." />
      <div className="space-y-3 p-4">
        <FormField label="Algorithm" htmlFor="o-algo" hint={isSimulated ? "Runs QAOA on a Qiskit Aer SIMULATOR, not quantum hardware. No speed-up over classical solvers is claimed." : undefined}>
          <Select id="o-algo" value={config.algorithm} onChange={(e) => onChange({ ...config, algorithm: e.target.value as OptimizeConfig["algorithm"], objective: e.target.value === "hybrid" || e.target.value === "quantum_simulated" ? (config.objective === "cost" ? "distance" : config.objective) : config.objective })}>
            <option value="classical_greedy">Classical (OR-Tools; demo: nearest neighbour)</option>
            <option value="classical_2opt">Classical (OR-Tools; demo: 2-opt)</option>
            <option value="hybrid">Hybrid: QAOA clusters + OR-Tools</option>
            <option value="quantum_simulated">Quantum (QAOA, Qiskit Aer simulation)</option>
          </Select>
        </FormField>

        {isQuantum && (
          <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${quantumTooMany ? "border-danger/30 bg-danger-soft text-danger" : "border-info/30 bg-info-soft text-info"}`}>
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {quantumTooMany
                ? `Quantum QAOA is capped at ${QUANTUM_MAX} stops (${stopCount} selected). Remove stops or switch to Hybrid / Classical.`
                : `Quantum QAOA supports up to ${QUANTUM_MAX} stops. ${stopCount}/${QUANTUM_MAX} selected.`}
            </span>
          </div>
        )}

        {isHybrid && (
          <div className="flex items-start gap-2 rounded-xl border border-violet/30 bg-violet-soft px-3 py-2 text-xs text-violet-700 dark:text-violet-300">
            <Zap className="mt-0.5 size-3.5 shrink-0" />
            <span>Hybrid: OR-Tools assigns all stops, then QAOA simulation re-orders clusters of up to 4 stops. Runs may take 30–60 s.</span>
          </div>
        )}

        <FormField label="Objective" htmlFor="o-obj">
          <Select id="o-obj" value={config.objective} onChange={(e) => onChange({ ...config, objective: e.target.value as OptimizeConfig["objective"] })}>
            <option value="distance">Minimise distance</option><option value="time">Minimise time</option>{config.algorithm !== "hybrid" && config.algorithm !== "quantum_simulated" && <option value="cost">Minimise cost</option>}
          </Select>
        </FormField>
        {!!error && <ErrorState title="Optimization failed" message={isApiError(error) ? error.userMessage : "Unexpected error"} className="py-5" />}
        <Button variant="primary" size="lg" className="w-full" disabled={!canRun} onClick={onRun}>
          <Play /> {running ? "Optimizing…" : "Run Optimization"}
        </Button>
        {stopCount < 2 && <p className="text-xs text-muted-foreground">Add at least 2 stops to optimise a route.</p>}
      </div>
    </Card>
  );
}

