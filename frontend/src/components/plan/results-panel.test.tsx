import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OptimizationRun, PlanStop } from "@/lib/api";
import { ResultsPanel } from "./results-panel";

const stops: PlanStop[] = [{
  id: "s1", name: "Adyar", address: "", latitude: 13, longitude: 80.2, zone_kind: "Residential",
  packages: 1, weight_kg: 2, priority: "low", window_start: "09:00", window_end: "12:00",
  service_minutes: 5, kind: "delivery",
}];

const run: OptimizationRun = {
  id: "h1", algorithm: "hybrid", status: "completed", objective: "distance", order: ["s1"],
  distance_km: 12, duration_min: 40, total_cost: 80, geometry: null, routing_available: false,
  distance_is_estimate: false, compute_seconds: 2, simulated: true, notes: [], created_at: "2026-10-09T00:00:00Z",
  hybrid: {
    simulation: true, disclaimer: "Aer simulation", objective: "distance", baseline_distance_km: 12,
    baseline_duration_min: 40, baseline_objective: 12, candidate_objective: 13,
    selected: "classical_baseline", clusters_attempted: 2, clusters_solved: 2,
    quantum_runtime_ms: 800, improvement_pct: 0,
  },
};

describe("ResultsPanel hybrid disclosure", () => {
  it("explains fallback selection and simulation status", () => {
    render(<ResultsPanel run={run} stops={stops} depotName="Depot" />);
    expect(screen.getByRole("heading", { name: /hybrid quantum-assisted outcome/i })).toBeInTheDocument();
    expect(screen.getByText(/classical baseline retained/i)).toBeInTheDocument();
    expect(screen.getByText(/2\/2/)).toBeInTheDocument();
    expect(screen.getByText(/not quantum hardware/i)).toBeInTheDocument();
  });
});
