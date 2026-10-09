import { describe, expect, it } from "vitest";
import { buildDemoInput } from "./analytics";
import { buildReport, csvCell, formatCell, reportHasData, reportToCsv, REPORT_KINDS, type ReportInput } from "./reports";

const NOW = new Date("2026-10-09T10:00:00Z");
const input = (): ReportInput => ({ ...buildDemoInput(NOW.getTime()), scenarios: [] });

describe("reports", () => {
  it("builds every report kind from demo data without throwing", () => {
    for (const k of REPORT_KINDS) {
      const doc = buildReport(k.kind, input(), "all", { from: "", to: "" }, NOW);
      expect(doc.sections.length).toBeGreaterThan(0);
      expect(doc.caveats.join(" ")).toMatch(/Demo data/);
      for (const s of doc.sections) for (const r of [...s.rows, ...(s.footer ? [s.footer] : [])]) expect(r.length).toBe(s.columns.length);
    }
  });
  it("is empty (not zero-filled) when nothing is in range", () => {
    const empty: ReportInput = { source: "api", plans: [], vehicles: [], packages: [], events: [], runs: [], scenarios: [] };
    const doc = buildReport("delivery_plan_summary", empty, "30d", { from: "", to: "" }, NOW);
    expect(reportHasData(doc)).toBe(false);
  });
  it("applies the date range to plans", () => {
    const all = buildReport("route_cost_breakdown", input(), "all", { from: "", to: "" }, NOW);
    const week = buildReport("route_cost_breakdown", input(), "7d", { from: "", to: "" }, NOW);
    expect(week.sections[0].rows.length).toBeLessThan(all.sections[0].rows.length);
  });
  it("leaves unknown observed values null", () => {
    const i = input(); i.events = [];
    const doc = buildReport("delivery_plan_summary", i, "all", { from: "", to: "" }, NOW);
    expect(doc.sections[0].rows.every((r) => r[4] === null)).toBe(true);
  });
  it("escapes csv and guards formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(null)).toBe("");
  });
  it("csv carries metadata, units and basis tags", () => {
    const csv = reportToCsv(buildReport("mileage_energy", input(), "all", { from: "", to: "" }, NOW));
    expect(csv).toContain("Generated at (UTC)");
    expect(csv).toContain("Demo data");
    expect(csv).toContain("[estimate]");
    expect(csv).toContain("Distance (km)");
  });
  it("formats dashes for missing values", () => {
    expect(formatCell(null, { label: "x", type: "num", basis: "info" })).toBe("—");
    expect(formatCell(0.5, { label: "x", type: "pct", basis: "info" })).toBe("50%");
  });
});
