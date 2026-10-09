import { packageFormSchema, normRef, parseHandling, type PackageFormValues } from "./package-schema";

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF/LF, embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const DANGEROUS = /^[=+\-@\t\r]/;
/** Escape a cell, neutralising spreadsheet formula injection (plain numbers are left alone). */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join(";") : String(v);
  if (DANGEROUS.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_COLUMNS = [
  "reference", "recipient", "address", "weight_kg", "length_cm", "width_cm", "height_cm", "volume_m3",
  "priority", "handling", "kind", "status", "service_minutes", "latitude", "longitude", "notes",
] as const;

export function toCsv(rows: Record<string, unknown>[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}

export interface ImportRow {
  line: number;
  values?: PackageFormValues;
  errors: string[];
  duplicate?: "existing" | "file";
}

const ENUM_FIELDS = ["priority", "kind", "status"];

/** Validate CSV text into import rows with per-row errors and duplicate flags (by reference, case-insensitive). */
export function validateImport(text: string, existingRefs: string[]): { rows: ImportRow[]; fatal?: string } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], fatal: "The file is empty." };
  const header = table[0].map((h) => h.trim().toLowerCase());
  if (!header.includes("reference")) return { rows: [], fatal: 'Missing required "reference" column. Expected header: ' + CSV_COLUMNS.join(", ") };
  if (table.length === 1) return { rows: [], fatal: "The file has a header but no data rows." };
  if (table.length - 1 > 2000) return { rows: [], fatal: "At most 2000 rows can be imported at once." };

  const seen = new Set(existingRefs.map(normRef));
  const inFile = new Set<string>();
  const rows: ImportRow[] = [];
  table.slice(1).forEach((cells, idx) => {
    const rec: Record<string, string> = {};
    header.forEach((h, i) => { rec[h] = (cells[i] ?? "").trim(); });
    for (const f of ENUM_FIELDS) if (rec[f]) rec[f] = rec[f].toLowerCase().replace(/[ -]/g, "_");
    const parsed = packageFormSchema.safeParse({
      priority: "medium", kind: "delivery", status: "pending", service_minutes: 5, weight_kg: 0,
      ...Object.fromEntries(Object.entries(rec).filter(([, v]) => v !== "")),
      handling: rec.handling ?? "",
    });
    const line = idx + 2;
    if (!parsed.success) {
      rows.push({ line, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`) });
      return;
    }
    const key = normRef(parsed.data.reference);
    let duplicate: ImportRow["duplicate"];
    if (seen.has(key)) duplicate = "existing";
    else if (inFile.has(key)) duplicate = "file";
    inFile.add(key);
    rows.push({ line, values: { ...parsed.data, handling: parseHandling(parsed.data.handling).join(";") }, errors: [], duplicate });
  });
  return { rows };
}
