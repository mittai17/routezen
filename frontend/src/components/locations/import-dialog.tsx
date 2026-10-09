"use client";
import * as React from "react";
import { Upload } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Location } from "@/lib/api";
import { describeError } from "@/lib/api/locations";
import { parseLocationsCsv, type ImportParse, type ImportRow } from "./location-utils";

const MAX_BYTES = 1_000_000;

type Props = {
  open: boolean; onOpenChange: (o: boolean) => void; existing: Location[];
  create: (v: Omit<Location, "id">) => Promise<unknown>; onDone: (summary: string) => void;
};

/** Dialog content mounts only while open, so ImportBody state resets on every open. */
export function ImportDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent title="Import locations from CSV" description="Required columns: name, latitude, longitude. Optional: address, type (depot, warehouse, stop), zone, notes." className="max-w-2xl">
        <ImportBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function ImportBody({ onOpenChange, existing, create, onDone }: Props) {
  const [parsed, setParsed] = React.useState<ImportParse | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [skipDup, setSkipDup] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [failures, setFailures] = React.useState<string[]>([]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setFileName(f.name);
    if (f.size > MAX_BYTES) { setParsed({ rows: [], fileError: "File is larger than 1 MB." }); return; }
    setParsed(parseLocationsCsv(await f.text(), existing));
  }

  const rows = parsed?.rows ?? [];
  const bad = rows.filter((r) => r.errors.length);
  const dups = rows.filter((r) => !r.errors.length && r.duplicateOf);
  const toImport: ImportRow[] = rows.filter((r) => !r.errors.length && (!r.duplicateOf || !skipDup));

  async function run() {
    setBusy(true); setFailures([]); setProgress(0);
    const fails: string[] = []; let ok = 0;
    for (const r of toImport) {
      try { await create(r.value!); ok++; } catch (e) { fails.push(`Line ${r.line} (${r.value!.name}): ${describeError(e)}`); }
      setProgress((p) => p + 1);
    }
    setBusy(false);
    if (fails.length) setFailures(fails);
    onDone(`Imported ${ok} of ${toImport.length} location${toImport.length === 1 ? "" : "s"}${fails.length ? `; ${fails.length} failed` : ""}.`);
    if (!fails.length) onOpenChange(false);
  }

  return (
    <>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-dashed border-input px-3 py-3 text-sm hover:bg-muted/50 focus-within:border-ring">
            <Upload className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{fileName || "Choose a .csv file (max 500 rows, 1 MB)"}</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
          </label>

          {parsed?.fileError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{parsed.fileError}</p>}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 text-xs" aria-live="polite">
                <Badge tone="success">{rows.length - bad.length - (skipDup ? dups.length : 0)} ready</Badge>
                <Badge tone={bad.length ? "danger" : "neutral"}>{bad.length} invalid</Badge>
                <Badge tone={dups.length ? "warning" : "neutral"}>{dups.length} possible duplicate{dups.length === 1 ? "" : "s"}</Badge>
              </div>
              {dups.length > 0 && (
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} /> Skip possible duplicates (same name or within 25 m of an existing location)</label>
              )}
              <div className="max-h-56 overflow-auto rounded-[var(--radius-control)] border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-left text-muted-foreground"><tr><th className="px-2 py-1.5">Line</th><th className="px-2 py-1.5">Name</th><th className="px-2 py-1.5">Status</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.line} className="border-t border-border align-top">
                        <td className="px-2 py-1.5 tabular-nums">{r.line}</td>
                        <td className="px-2 py-1.5">{r.raw.name || <em className="text-muted-foreground">(blank)</em>}</td>
                        <td className="px-2 py-1.5">
                          {r.errors.length ? <span className="text-danger">{r.errors.join("; ")}</span>
                            : r.duplicateOf ? <span className="text-warning">Possible duplicate of {r.duplicateOf}</span> : <span className="text-success">OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {failures.length > 0 && (
            <ul role="alert" className="max-h-28 list-disc space-y-0.5 overflow-auto rounded-lg border border-danger/30 bg-danger-soft py-2 pl-6 pr-3 text-xs text-danger">
              {failures.map((f) => <li key={f}>{f}</li>)}
            </ul>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground" aria-live="polite">{busy ? `Importing ${progress} / ${toImport.length}…` : ""}</span>
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => onOpenChange(false)}>{failures.length ? "Close" : "Cancel"}</Button>
              <Button variant="primary" disabled={busy || toImport.length === 0 || failures.length > 0} onClick={run}>Import {toImport.length || ""} location{toImport.length === 1 ? "" : "s"}</Button>
            </div>
          </div>
        </div>
    </>
  );
}
