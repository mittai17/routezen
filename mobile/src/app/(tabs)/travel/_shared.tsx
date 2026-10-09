/**
 * Travel-feature-local helpers that are NOT in `src/components/ui` (the
 * shared design system, owned by the design-system agent per
 * mobile/AGENTS.md's file-ownership table).
 *
 * File is prefixed with `_` so Expo Router does not treat it as a route.
 *
 * Reconciliation note: this feature was started before `src/components/ui`
 * existed, so an earlier version of this file duplicated Card/Button/Badge/
 * EmptyState/ErrorState/LoadingState. Once the real design system landed,
 * every travel screen was switched to import those from
 * `../../../components/ui` instead — only genuinely travel-specific bits
 * (formatters, the compact stat tile, travel-mode metadata) remain here.
 * `StatTile` in particular has no equivalent in `src/components/ui` (the
 * closest is `MetricCard`, which is a full bordered Card — too large for a
 * dense 2-4 column distance/duration/cost/emissions row); it's a reasonable
 * candidate to promote into the shared kit later.
 */
import React from "react";
import { Text, View } from "react-native";
import { Car, Bike, Zap } from "lucide-react-native";
import type { TravelMode } from "../../../lib/api/travel";

// ── Stats ───────────────────────────────────────────────────────────────

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View className="flex-1 rounded-xl border border-border bg-muted px-3 py-2.5">
      <Text className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{label}</Text>
      <Text className="mt-0.5 text-base font-bold text-ink">{value}</Text>
      {sub ? <Text className="text-[11px] text-ink-muted">{sub}</Text> : null}
    </View>
  );
}

// ── Form input styling (ui kit has no raw TextInput primitive yet) ───────

export const inputClassName = "min-h-[44px] rounded-xl border border-border bg-surface px-3.5 py-3 text-base text-ink";

// ── Travel mode metadata ──────────────────────────────────────────────
// Kept in sync with TRAVEL_MODES in lib/api/travel.ts — see that file's
// header comment for why bus/train/walking/cycling are NOT offered here.

export const TRAVEL_MODE_META: Record<TravelMode, { label: string; Icon: typeof Car }> = {
  car: { label: "Car", Icon: Car },
  motorcycle: { label: "Motorcycle", Icon: Bike },
  ev: { label: "Electric Vehicle", Icon: Zap },
};

// ── Formatting helpers ──────────────────────────────────────────────────

export function fmtKm(km: number) {
  return `${km.toLocaleString("en-IN", { maximumFractionDigits: 0 })} km`;
}

export function fmtMin(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function fmtInr(value: number | null | undefined) {
  if (value == null) return "—";
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function fmtDate(value: string | null | undefined) {
  if (!value) return "No date set";
  return value;
}
