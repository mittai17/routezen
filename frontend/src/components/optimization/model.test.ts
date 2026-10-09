import { describe, expect, it } from "vitest";
import { optimizationApi, runRecordSchema, type ClassicalRun, type QuantumRun } from "@/lib/api/optimization";
import { csvCell, runToCsv } from "./csv";
import { classicalView, compareRuns, deriveEnergy, quantumView, type Ctx } from "./model";

const ctx: Ctx = { names: { d1: "Anna Nagar" }, vehicles: { "demo-van": { id: "demo-van", name: "Van", energy_type: "diesel", efficiency_value: 10, efficiency_unit: "km_per_l", energy_price: "100", verification: "assumed" } } };
const runs = await optimizationApi.listRuns();
const c = runs.find((r) => r.kind === "classical") as ClassicalRun;
const q = runs.find((r) => r.kind === "quantum") as QuantumRun;

describe("classicalView", () => {
  const v = classicalView(c, ctx)!;
  it("computes cost per delivery over assigned stops", () => {
    expect(v.assigned).toBe(6);
    expect(v.totals.costPerDelivery).toBeCloseTo(c.result!.total_cost / 6);
    expect(v.routes[0].costPerDelivery).toBeCloseTo(c.result!.routes[0].cost / 3);
  });
  it("flags late deadlines and unassigned stops", () => {
    expect(v.unassigned.map((u) => u.id)).toEqual(["d6", "d8"]);
    expect(v.routes[0].visits.find((x) => x.stopId === "d3")?.late).toBe(true); // arrives 52 > deadline 45
  });
  it("derives energy only with a matching profile", () => {
    expect(v.routes[0].energy?.amount).toBeCloseTo(3.63);
    expect(v.routes[1].energy).toBeNull();
    expect(v.totals.energy).toBeNull();
    expect(deriveEnergy(10, undefined)).toBeNull();
  });
  it("computes capacity utilisation from the request", () => {
    expect(v.routes[0].payloadUtil).toBeCloseTo(52 / 60);
  });
});

describe("quantum + comparison", () => {
  it("keeps backend gap and never claims advantage", () => {
    const v = quantumView(q, ctx)!;
    expect(v.gapPct).toBe(7.46);
    expect(v.matches).toBe(false);
  });
  it("is not comparable when stop sets differ", () => {
    expect(compareRuns(c, q)?.comparable).toBe(false);
  });
});

describe("csv", () => {
  it("neutralises formula injection and quotes", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(-3)).toBe("-3");
    expect(csvCell(NaN)).toBe("");
  });
  it("exports both kinds and labels demo data", () => {
    expect(runToCsv(c, ctx, { demo: true })).toContain("Demo data");
    expect(runToCsv(q, ctx, { demo: false })).toContain("SIMULATION");
  });
});

describe("schema", () => {
  it("rejects unknown status", () => {
    expect(runRecordSchema.safeParse({ id: "x", kind: "classical", status: "weird", created_at: "t", request: {} }).success).toBe(false);
  });
  it("accepts the backend's null hybrid field on a classical result", () => {
    expect(runRecordSchema.safeParse({ ...c, result: { ...c.result!, hybrid: null } }).success).toBe(true);
  });
  it("parses hybrid run metadata and labels the run as simulated", () => {
    const parsed = runRecordSchema.parse({
      ...c,
      id: "hybrid-12345678",
      kind: "hybrid",
      result: {
        ...c.result!,
        solver: "hybrid_qaoa_ortools",
        hybrid: {
          simulation: true,
          disclaimer: "QAOA was simulated classically with Qiskit Aer. No advantage is claimed.",
          objective: "distance",
          baseline_distance_km: 40,
          baseline_duration_min: 90,
          baseline_objective: 40,
          candidate_objective: 38,
          selected: "quantum_seeded",
          clusters_attempted: 2,
          clusters_solved: 2,
          quantum_runtime_ms: 800,
          improvement_pct: 5,
          clusters: [{ stop_ids: ["d1", "d2"], status: "solved", n_qubits: 4, order: ["d2", "d1"], cost: 12, brute_force_cost: 11, gap_vs_brute_force_pct: 9.09 }],
        },
      },
    });
    expect(parsed.kind).toBe("hybrid");
    if (parsed.kind === "quantum") throw new Error("expected a hybrid run");
    expect(parsed.result?.hybrid?.selected).toBe("quantum_seeded");
  });
});
