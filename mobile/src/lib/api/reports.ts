/**
 * Reports data access & sharing logic.
 *
 * Backend endpoint:
 * GET /reports/{kind}.csv
 * where kind in "locations" | "packages" | "vehicles" | "plans" | "events"
 *
 * Returns raw text/csv.
 * Uses File/Paths from expo-file-system and shareAsync from expo-sharing.
 */
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { apiRequest } from "./client";

export type ReportKind = "locations" | "packages" | "vehicles" | "plans" | "events";

export const REPORT_KINDS: { id: ReportKind; label: string; description: string }[] = [
  { id: "locations", label: "Locations", description: "All depot, stop, and warehouse coordinates and zones" },
  { id: "packages", label: "Packages", description: "Package references, weights, priority, and status history" },
  { id: "vehicles", label: "Vehicles", description: "Fleet vehicle specs, energy types, capacities, and costs" },
  { id: "plans", label: "Plans", description: "Dispatch plans with metrics, assignments, and status" },
  { id: "events", label: "Events", description: "Timeline audit trail and operational events" },
];

export async function fetchReportCsv(kind: ReportKind): Promise<string> {
  const result = await apiRequest<string>(`/reports/${kind}.csv`);
  return typeof result === "string" ? result : JSON.stringify(result);
}

export interface ExportReportResult {
  shared: boolean;
  fileUri?: string;
  csvText: string;
}

/**
 * Downloads report CSV, writes to temp cache file, and invokes OS share sheet.
 * If expo-sharing is unavailable, returns { shared: false, csvText } so UI can fall back to clipboard copy.
 */
export async function exportReportCsv(kind: ReportKind): Promise<ExportReportResult> {
  const csvText = await fetchReportCsv(kind);

  const isShareAvailable = await Sharing.isAvailableAsync().catch(() => false);
  if (!isShareAvailable) {
    return { shared: false, csvText };
  }

  const filename = `${kind}_export_${Date.now()}.csv`;
  const tempFile = new File(Paths.cache, filename);
  try {
    tempFile.write(csvText);
    await Sharing.shareAsync(tempFile.uri, {
      mimeType: "text/csv",
      dialogTitle: `Export ${kind}.csv`,
      UTI: "public.comma-separated-values-text",
    });
    return { shared: true, fileUri: tempFile.uri, csvText };
  } catch {
    // Sharing cancelled or failed; still return the text for fallback
    return { shared: false, csvText };
  }
}

export async function copyReportToClipboard(text: string): Promise<boolean> {
  return Clipboard.setStringAsync(text);
}
