"use client";
import { Play, Zap } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/form-controls";
import { ErrorState } from "@/components/ui/states";
import { isApiError } from "@/lib/api";
import type { OptimizeConfig } from "@/lib/schemas";

export function OptimizePanel({ config, onChange, onRun, running, error, stopCount }: {
  config: OptimizeConfig; onChange: (c: OptimizeConfig) => void; onRun: () => void; running: boolean; error: unknown; stopCount: number;
}) {
  return (
    <Card>
      <CardHeader icon={<Zap />} title="Optimization Settings" subtitle="Choose how the visit order is computed." />
      <div className="space-y-3 p-4">
        <FormField label="Algorithm" htmlFor="o-algo" hint={config.algorithm === "quantum_simulated" ? "Runs QAOA on a Qiskit Aer SIMULATOR, not quantum hardware. No speed-up over classical solvers is claimed." : undefined}>
          <Select id="o-algo" value={config.algorithm} onChange={(e) => onChange({ ...config, algorithm: e.target.value as OptimizeConfig["algorithm"] })}>
            <option value="classical_greedy">Classical: nearest neighbour</option>
            <option value="classical_2opt">Classical: nearest neighbour + 2-opt</option>
            <option value="quantum_simulated">Quantum (QAOA, Qiskit Aer simulation)</option>
          </Select>
        </FormField>
        <FormField label="Objective" htmlFor="o-obj">
          <Select id="o-obj" value={config.objective} onChange={(e) => onChange({ ...config, objective: e.target.value as OptimizeConfig["objective"] })}>
            <option value="distance">Minimise distance</option><option value="time">Minimise time</option><option value="cost">Minimise cost</option>
          </Select>
        </FormField>
        {!!error && <ErrorState title="Optimization failed" message={isApiError(error) ? error.userMessage : "Unexpected error"} className="py-5" />}
        <Button variant="primary" size="lg" className="w-full" disabled={running || stopCount < 2} onClick={onRun}>
          <Play /> {running ? "Optimizing…" : "Run Optimization"}
        </Button>
        {stopCount < 2 && <p className="text-xs text-muted-foreground">Add at least 2 stops to optimise a route.</p>}
      </div>
    </Card>
  );
}
