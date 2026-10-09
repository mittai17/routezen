import * as React from "react";
import { Badge, type Tone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { BASIS_LABEL, formatCell, reportHasData, type Basis, type Cell, type Column, type ReportDoc } from "@/lib/api/reports";

const BASIS_TONE: Record<Basis, Tone> = { observed: "success", planned: "info", estimate: "warning", profile: "violet", info: "neutral" };
const BASIS_SHORT: Record<Basis, string> = { observed: "Observed", planned: "Planned", estimate: "Estimate", profile: "Profile", info: "" };

/** Print rules: hide everything except the report. Kept local because shared CSS is not owned by this module. */
const PRINT_CSS = `
@media print {
  @page { margin: 14mm; }
  body * { visibility: hidden !important; }
  .report-print, .report-print * { visibility: visible !important; }
  .report-print { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; background: #fff !important; color: #000 !important; }
  .report-print table { page-break-inside: auto; }
  .report-print tr { page-break-inside: avoid; }
  .report-print section { break-inside: avoid-page; }
  .report-print .overflow-x-auto { overflow: visible !important; }
}`;

function alignRight(c: Column) { return c.type === "num" || c.type === "inr" || c.type === "pct"; }

export function ReportPreview({ doc }: { doc: ReportDoc }) {
  const used = (["observed", "planned", "estimate", "profile"] as Basis[]).filter((b) => doc.sections.some((s) => s.columns.some((c) => c.basis === b)));
  const generated = new Date(doc.generatedAt).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });
  const empty = !reportHasData(doc);

  return (
    <article className="report-print rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6" aria-label={`${doc.title} report preview`}>
      <style>{PRINT_CSS}</style>
      <header className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">{doc.title}</h2>
          {doc.source === "demo" ? <Badge tone="brand" className="border border-brand/60 uppercase tracking-wide">Demo data</Badge> : <Badge tone="success">Live API data</Badge>}
        </div>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="flex gap-1.5"><dt className="font-semibold text-foreground">Generated</dt><dd>{generated}</dd></div>
          <div className="flex gap-1.5"><dt className="font-semibold text-foreground">Date range</dt><dd>{doc.range.label}</dd></div>
          <div className="flex gap-1.5 sm:col-span-2"><dt className="shrink-0 font-semibold text-foreground">Units</dt><dd>{doc.units.join(" · ")}</dd></div>
        </dl>
        {used.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" aria-label="Column labels">
            {used.map((b) => <li key={b} className="flex items-center gap-1.5"><Badge tone={BASIS_TONE[b]}>{BASIS_SHORT[b]}</Badge><span className="text-muted-foreground">{BASIS_LABEL[b]}</span></li>)}
          </ul>
        )}
      </header>

      {doc.caveats.length > 0 && (
        <div className="mt-4 space-y-1 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs">
          {doc.caveats.map((c) => <p key={c}>{c}</p>)}
        </div>
      )}

      {empty && <EmptyState className="mt-4 py-10" title="No data in this date range" description="Save a plan, run an optimisation, or widen the date range. Nothing is estimated when there is nothing to report." />}

      {doc.sections.map((s) => (
        <section key={s.title} className="mt-5" aria-label={s.title}>
          <h3 className="text-sm font-semibold">{s.title}</h3>
          {s.note && <p className="mt-0.5 text-xs text-muted-foreground">{s.note}</p>}
          {s.rows.length === 0 ? (
            !empty && <p className="mt-2 text-xs text-muted-foreground">No rows for this section.</p>
          ) : (
            <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label={`${s.title} table, scrollable`}>
              <table className="w-full min-w-[34rem] text-left text-xs">
                <caption className="sr-only">{s.title}</caption>
                <thead className="text-muted-foreground">
                  <tr>
                    {s.columns.map((c) => (
                      <th key={c.label} scope="col" className={cn("whitespace-nowrap border-b border-border px-2 py-1.5 align-bottom font-semibold", alignRight(c) && "text-right")}>
                        <div>{c.label}{c.unit && c.type !== "inr" ? <span className="font-normal"> ({c.unit})</span> : null}{c.unit && c.type === "inr" && c.unit !== "₹" ? <span className="font-normal"> ({c.unit})</span> : null}</div>
                        {c.basis !== "info" && <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-80">{BASIS_SHORT[c.basis]}</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r, i) => <Row key={i} cells={r} cols={s.columns} />)}
                </tbody>
                {s.footer && <tfoot className="font-semibold"><Row cells={s.footer} cols={s.columns} foot /></tfoot>}
              </table>
            </div>
          )}
        </section>
      ))}

      <section className="mt-6 grid gap-4 border-t border-border pt-4 text-xs sm:grid-cols-2" aria-label="Assumptions">
        <div>
          <h3 className="text-sm font-semibold">Assumptions</h3>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
            {doc.assumptions.map((a) => <li key={a}>{a}</li>)}
            <li>A dash (—) means the value is unknown or not recorded; it is never treated as zero.</li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">How to read this report</h3>
          <p className="mt-1 text-muted-foreground">Planned and estimated values are not measurements. Only columns tagged Observed come from recorded events or solver output. This is not a certified financial or carbon statement.</p>
        </div>
      </section>
    </article>
  );
}

function Row({ cells, cols, foot }: { cells: Cell[]; cols: Column[]; foot?: boolean }) {
  return (
    <tr className={cn(foot ? "border-t-2 border-border" : "border-t border-border")}>
      {cells.map((c, i) => {
        const col = cols[i];
        const text = formatCell(c, col);
        const cls = cn("px-2 py-1.5", alignRight(col) && "text-right tabular-nums", col.type === "dt" && "whitespace-nowrap", text === "—" && "text-muted-foreground");
        return i === 0 ? <th key={i} scope="row" className={cn(cls, "text-left font-medium")}>{text}</th> : <td key={i} className={cls}>{text}</td>;
      })}
    </tr>
  );
}
