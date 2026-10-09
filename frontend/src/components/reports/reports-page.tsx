"use client";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Printer, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form-controls";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportPreview } from "./report-preview";
import { USE_DEMO_DATA } from "@/lib/api/client";
import type { RangePreset } from "@/lib/api/analytics";
import {
  buildReport, downloadBackendCsv, downloadBlob, loadReportInput, reportFilename, reportHasData, reportToCsv, REPORT_KINDS, type ReportDoc, type ReportKind,
} from "@/lib/api/reports";

interface Config { kind: ReportKind; preset: RangePreset; from: string; to: string }
const sameConfig = (a: Config, b: Config) => a.kind === b.kind && a.preset === b.preset && (a.preset !== "custom" || (a.from === b.from && a.to === b.to));

export function ReportsPage() {
  const [cfg, setCfg] = React.useState<Config>({ kind: "delivery_plan_summary", preset: "30d", from: "", to: "" });
  const [generated, setGenerated] = React.useState<{ doc: ReportDoc; cfg: Config } | null>(null);
  const [status, setStatus] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["report-input"], queryFn: loadReportInput, retry: 1 });

  const badRange = cfg.preset === "custom" && !!cfg.from && !!cfg.to && cfg.from > cfg.to;
  const meta = REPORT_KINDS.find((k) => k.kind === cfg.kind) as (typeof REPORT_KINDS)[number];
  const stale = generated !== null && !sameConfig(generated.cfg, cfg);

  async function generate() {
    setStatus(null);
    setBusy(true);
    try {
      const data = await qc.fetchQuery({ queryKey: ["report-input"], queryFn: loadReportInput, staleTime: 0, retry: false });
      setGenerated({ doc: buildReport(cfg.kind, data, cfg.preset, { from: cfg.from, to: cfg.to }), cfg });
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof Error ? e.message : "Could not generate the report." });
    } finally { setBusy(false); }
  }

  async function backendExport() {
    if (!meta.backendCsv) return;
    setStatus(null);
    try {
      const name = await downloadBackendCsv(meta.backendCsv);
      setStatus({ tone: "ok", text: `Downloaded ${name}.` });
    } catch (e) { setStatus({ tone: "error", text: e instanceof Error ? e.message : "Export failed." }); }
  }

  const doc = generated?.doc;
  const canDownload = !!doc && !stale && reportHasData(doc);
  const demo = USE_DEMO_DATA;

  return (
    <>
      <PageHeader title="Reports" description="Generate, preview, print and download operational reports." actions={demo ? <DemoBadge /> : undefined} />
      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-4 print:hidden">
          <Card>
            <CardHeader title="Generate report" icon={<FileText />} />
            <CardContent className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <label htmlFor="rk" className="text-xs font-semibold">Report type</label>
                <Select id="rk" value={cfg.kind} onChange={(e) => setCfg({ ...cfg, kind: e.target.value as ReportKind })}>
                  {REPORT_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
                </Select>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="rr" className="text-xs font-semibold">Date range</label>
                <Select id="rr" value={cfg.preset} onChange={(e) => setCfg({ ...cfg, preset: e.target.value as RangePreset })}>
                  <option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option>
                  <option value="all">All time</option><option value="custom">Custom range</option>
                </Select>
              </div>
              {cfg.preset === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><label htmlFor="rf" className="text-xs font-semibold">From</label><Input id="rf" type="date" value={cfg.from} onChange={(e) => setCfg({ ...cfg, from: e.target.value })} /></div>
                  <div className="space-y-1.5"><label htmlFor="rt" className="text-xs font-semibold">To</label><Input id="rt" type="date" value={cfg.to} onChange={(e) => setCfg({ ...cfg, to: e.target.value })} /></div>
                  {badRange && <p role="alert" className="col-span-2 text-xs font-medium text-danger">The start date must be on or before the end date.</p>}
                </div>
              )}
              <Button variant="primary" className="w-full" onClick={generate} disabled={busy || badRange || q.isLoading}>
                {busy ? <RefreshCw className="animate-spin" /> : <FileText />} {generated ? "Regenerate report" : "Generate report"}
              </Button>
              <p className="text-xs text-muted-foreground">Data is re-read when you generate. Reports are built on demand and are not stored, so there is no list of previous reports.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Export" icon={<Download />} />
            <CardContent className="space-y-3 pt-3">
              <Button className="w-full" disabled={!canDownload} onClick={() => doc && downloadBlob(reportToCsv(doc), reportFilename(doc), "text/csv;charset=utf-8")}>
                <Download /> Download preview as CSV
              </Button>
              <p className="text-xs text-muted-foreground">Exactly the tables shown, for the selected date range, built in your browser. Column headers carry units and an estimate/observed tag.</p>
              {meta.backendCsv && (
                <>
                  <Button className="w-full" onClick={backendExport} disabled={demo}>
                    <Download /> Backend export ({meta.backendCsv}.csv)
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {demo ? "Unavailable in demo mode (no backend is called)." : `Raw stored ${meta.backendCsv} records from GET /reports/${meta.backendCsv}.csv. The backend ignores the date range and returns up to 10,000 rows.`}
                  </p>
                </>
              )}
              <Button className="w-full" disabled={!doc || stale} onClick={() => window.print()}>
                <Printer /> Print / save as PDF
              </Button>
              <p className="text-xs text-muted-foreground">Opens your browser&apos;s print dialog; choose &quot;Save as PDF&quot; there.</p>
              <div aria-live="polite" className="min-h-4 text-xs">
                {status && <p role={status.tone === "error" ? "alert" : "status"} className={status.tone === "error" ? "font-medium text-danger" : "font-medium text-success"}>{status.text}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0">
          {q.isLoading && <div role="status" aria-label="Loading data" className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>}
          {q.isError && !generated && <ErrorState title="Could not load report data" message={q.error instanceof Error ? q.error.message : undefined} onRetry={() => q.refetch()} />}
          {!q.isLoading && !q.isError && !doc && (
            <EmptyState icon={<FileText />} title="No report generated yet" description="Choose a report type and date range, then press Generate report to see a preview here." />
          )}
          {doc && (
            <>
              {stale && <p role="status" className="mb-3 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs font-medium print:hidden">The type or date range changed. Regenerate to update this preview before exporting.</p>}
              {q.isError && <p role="alert" className="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium print:hidden">Latest refresh failed; this preview uses the data from the last successful load.</p>}
              <ReportPreview doc={doc} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
