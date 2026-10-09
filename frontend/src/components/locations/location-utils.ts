import { z } from "zod";
import type { Location } from "@/lib/api";

export const LOCATION_TYPES = ["depot", "warehouse", "stop"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];
export const TYPE_LABEL: Record<LocationType, string> = { depot: "Depot", warehouse: "Warehouse", stop: "Delivery stop" };

/** Rough Chennai metro bounding box. Coordinates outside it are valid but flagged as a warning. */
export const CHENNAI_BOUNDS = { latMin: 12.7, latMax: 13.5, lngMin: 79.9, lngMax: 80.5 };
export const DUPLICATE_RADIUS_M = 25;

/* ------------------------------------------------------------------ coordinates */
export const coordinateError = (lat: number, lng: number): string | null => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Coordinates are not numbers";
  if (lat < -90 || lat > 90) return "Latitude must be between -90 and 90";
  if (lng < -180 || lng > 180) return "Longitude must be between -180 and 180";
  if (lat === 0 && lng === 0) return "Coordinates are 0,0 (placeholder, not a real place)";
  return null;
};
export const outsideChennai = (lat: number, lng: number) =>
  lat < CHENNAI_BOUNDS.latMin || lat > CHENNAI_BOUNDS.latMax || lng < CHENNAI_BOUNDS.lngMin || lng > CHENNAI_BOUNDS.lngMax;

export function distanceM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad, dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ------------------------------------------------------------------ form schema */
const coord = (label: string, min: number, max: number) =>
  z.string().trim().min(1, `${label} is required`)
    .refine((v) => v === "" || Number.isFinite(Number(v)), `${label} must be a number`)
    .transform(Number)
    .pipe(z.number().min(min, `${label} must be between ${min} and ${max}`).max(max, `${label} must be between ${min} and ${max}`));

export const locationFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Max 200 characters"),
  address: z.string().trim().max(500, "Max 500 characters"),
  latitude: coord("Latitude", -90, 90),
  longitude: coord("Longitude", -180, 180),
  type: z.enum(LOCATION_TYPES),
  zone: z.string().trim().max(100, "Max 100 characters"),
  notes: z.string().trim().max(2000, "Max 2000 characters"),
}).superRefine((v, ctx) => {
  if (v.latitude === 0 && v.longitude === 0) ctx.addIssue({ code: "custom", path: ["latitude"], message: "0,0 is not a real location" });
});
export type LocationFormInput = z.input<typeof locationFormSchema>;
export type LocationFormValues = z.output<typeof locationFormSchema>;

export const toPayload = (v: LocationFormValues): Omit<Location, "id"> => ({
  name: v.name, address: v.address || null, latitude: v.latitude, longitude: v.longitude, type: v.type, zone: v.zone || null, notes: v.notes || null,
});

/* ------------------------------------------------------------------ issues */
export interface LocationIssues { invalid: string | null; outside: boolean; duplicates: { id: string; name: string; reason: "name" | "coordinates" }[] }

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Duplicate = same normalised name, or within DUPLICATE_RADIUS_M of another valid location. */
export function analyseLocations(list: Pick<Location, "id" | "name" | "latitude" | "longitude">[]): Map<string, LocationIssues> {
  const out = new Map<string, LocationIssues>();
  for (const l of list) {
    const invalid = coordinateError(l.latitude, l.longitude);
    out.set(l.id, { invalid, outside: !invalid && outsideChennai(l.latitude, l.longitude), duplicates: [] });
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const reasons: ("name" | "coordinates")[] = [];
      if (norm(a.name) === norm(b.name)) reasons.push("name");
      if (!out.get(a.id)!.invalid && !out.get(b.id)!.invalid && distanceM(a, b) <= DUPLICATE_RADIUS_M) reasons.push("coordinates");
      for (const reason of reasons) {
        out.get(a.id)!.duplicates.push({ id: b.id, name: b.name, reason });
        out.get(b.id)!.duplicates.push({ id: a.id, name: a.name, reason });
      }
    }
  }
  return out;
}

export const hasIssue = (i: LocationIssues | undefined) => !!i && (!!i.invalid || i.duplicates.length > 0);

/* ------------------------------------------------------------------ CSV */
export const CSV_COLUMNS = ["name", "address", "latitude", "longitude", "type", "zone", "notes"] as const;
const DANGEROUS = /^[=+\-@\t\r]/;

/** Guard against spreadsheet formula injection; plain numbers are left alone. */
export const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (DANGEROUS.test(s) && !Number.isFinite(Number(s))) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function locationsToCsv(list: Location[]): string {
  const rows = list.map((l) => CSV_COLUMNS.map((c) => csvCell(l[c])).join(","));
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}

/** RFC-4180-ish parser: quoted fields, escaped quotes, CRLF/LF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false, i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c;
    } else if (c === '"' && field === "") inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const ALIASES: Record<string, (typeof CSV_COLUMNS)[number]> = { lat: "latitude", lng: "longitude", lon: "longitude", long: "longitude", description: "notes", area: "zone" };

export interface ImportRow { line: number; raw: Record<string, string>; value?: Omit<Location, "id">; errors: string[]; duplicateOf?: string }
export interface ImportParse { rows: ImportRow[]; fileError?: string }
export const MAX_IMPORT_ROWS = 500;

export function parseLocationsCsv(text: string, existing: Pick<Location, "id" | "name" | "latitude" | "longitude">[]): ImportParse {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], fileError: "The file is empty." };
  const header = table[0].map((h) => { const k = h.trim().toLowerCase(); return ALIASES[k] ?? k; });
  const missing = (["name", "latitude", "longitude"] as const).filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], fileError: `Missing required column(s): ${missing.join(", ")}. Expected header: ${CSV_COLUMNS.join(", ")}.` };
  const body = table.slice(1);
  if (body.length === 0) return { rows: [], fileError: "The file has a header but no data rows." };
  if (body.length > MAX_IMPORT_ROWS) return { rows: [], fileError: `Too many rows (${body.length}). Import at most ${MAX_IMPORT_ROWS} at a time.` };

  const seen: Pick<Location, "id" | "name" | "latitude" | "longitude">[] = [...existing];
  const rows = body.map((cells, idx): ImportRow => {
    const raw: Record<string, string> = {};
    header.forEach((h, k) => { const v = (cells[k] ?? "").trim(); raw[h] = /^'[=+\-@]/.test(v) ? v.slice(1) : v; });
    const parsed = locationFormSchema.safeParse({
      name: raw.name ?? "", address: raw.address ?? "", latitude: raw.latitude ?? "", longitude: raw.longitude ?? "",
      type: (raw.type ?? "").toLowerCase() || "stop", zone: raw.zone ?? "", notes: raw.notes ?? "",
    });
    if (!parsed.success) return { line: idx + 2, raw, errors: parsed.error.issues.map((i) => `${String(i.path[0] ?? "row")}: ${i.message}`) };
    const value = toPayload(parsed.data);
    const cand = { id: `import-${idx}`, name: value.name, latitude: value.latitude, longitude: value.longitude };
    const dup = seen.find((s) => norm(s.name) === norm(cand.name) || distanceM(s, cand) <= DUPLICATE_RADIUS_M);
    seen.push(cand);
    return { line: idx + 2, raw, errors: [], value, duplicateOf: dup?.name };
  });
  return { rows };
}
