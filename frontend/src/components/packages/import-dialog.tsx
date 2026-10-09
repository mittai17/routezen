"use client";
import * as React from "react";
import { Upload } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CSV_COLUMNS, validateImport, type ImportRow } from "./csv";

const MAX_BYTES = 2_000_000;

type Props = { open: boolean; onOpenChange: (o: boolean) => void; existingRefs: string[]; onImport: (rows: ImportRow[]) => Promise<void> };

/** Content mounts only while open, so state resets on every open. */
export function ImportDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent title="Import packages from CSV" description={`Columns: ${CSV_COLUMNS.join(", ")}. Only "reference" is required. Volume is always recalculated from dimensions.`} className="max-w-2xl">
        <ImportBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function ImportBody({ onOpenChange, existingRefs, onImport }: Props) {
  const [fileName, setFileName] = React.useState("");
  const [rows, setRows] = React.useState<ImportRow[] | null>(null);
  const [fatal, setFatal] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [skipDupes, setSkipDupes] = React.useState(true);


  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name); setRows(null); setFatal(null);
    if (f.size > MAX_BYTES) { setFatal("File is larger than 2 MB."); return; }
    const res = validateImport(await f.text(), existingRefs);
    if (res.fatal) setFatal(res.fatal); else setRows(res.rows);
  };

  const valid = rows?.filter((r) => r.values && !r.duplicate) ?? [];
  const dupes = rows?.filter((r) => r.values && r.duplicate) ?? [];
  const invalid = rows?.filter((r) => !r.values) ?? [];
  const importable = skipDupes ? valid : [...valid, ...dupes.filter((d) => d.duplicate === "file")];

  return (
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-dashed border-input px-4 py-5 text-sm hover:bg-muted">
            <Upload className="size-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{fileName || "Choose a .csv file"}</span>
            <input aria-label="CSV file" type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          {fatal && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{fatal}</p>}
          {rows && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">{valid.length} ready</Badge>
                <Badge tone="warning">{dupes.length} duplicate reference{dupes.length === 1 ? "" : "s"}</Badge>
                <Badge tone="danger">{invalid.length} invalid</Badge>
              </div>
              {dupes.length > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} />
                  Skip duplicate references ({dupes.filter((d) => d.duplicate === "existing").length} already exist, {dupes.filter((d) => d.duplicate === "file").length} repeated in file)
                </label>
              )}
              {!skipDupes && dupes.some((d) => d.duplicate === "existing") && (
                <p className="text-xs text-muted-foreground">Rows whose reference already exists are never imported; only repeats within the file are added when this is unchecked.</p>
              )}
              {(invalid.length > 0 || dupes.length > 0) && (
                <ul className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2 text-xs" aria-label="Rows with problems">
                  {[...invalid, ...dupes].sort((a, b) => a.line - b.line).map((r) => (
                    <li key={r.line}><strong>Line {r.line}:</strong> {r.values ? `duplicate reference "${r.values.reference}" (${r.duplicate === "existing" ? "already exists" : "repeated in file"})` : r.errors.join("; ")}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" disabled={busy || importable.length === 0} onClick={async () => { setBusy(true); try { await onImport(importable); onOpenChange(false); } finally { setBusy(false); } }}>
              {busy ? "Importing…" : `Import ${importable.length} package${importable.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
  );
}
