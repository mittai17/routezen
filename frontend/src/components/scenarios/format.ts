import { formatDuration, formatINR, formatNumber } from "@/lib/utils";

export const DASH = "—";
export const fmtCost = (v: number | null | undefined) => (v == null ? DASH : formatINR(v, 2));
export const fmtKm = (v: number | null | undefined) => (v == null ? DASH : `${formatNumber(v, 1)} km`);
export const fmtTime = (v: number | null | undefined) => (v == null ? DASH : formatDuration(v));
export const fmtEmissions = (g: number | null | undefined) => (g == null ? DASH : g >= 1000 ? `${formatNumber(g / 1000, 2)} kg` : `${formatNumber(g, 0)} g`);
export const fmtEnergy = (v: number | null | undefined, unit: "L" | "kWh") => (v == null ? DASH : `${formatNumber(v, 2)} ${unit}`);

export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  return isNaN(+d) ? DASH : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export const KIND_LABEL: Record<string, string> = {
  recommendation: "Vehicle recommendation",
  classical: "Route optimisation (OR-Tools)",
  quantum: "Quantum (simulation)",
};
