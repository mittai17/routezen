/**
 * RECONCILIATION NOTE: docs/MOBILE.md says a design-system agent is building
 * src/components/{brand,ui}/** (Button, Card, MetricCard, EmptyState, ErrorState,
 * LoadingSkeleton, ScreenHeader) in parallel. At the time this file was written only
 * src/components/brand/** existed — src/components/ui/** did not. These are minimal
 * local stand-ins, used by both home/** and logistics/** (import across those two
 * folders is fine — both are owned by this same agent), so logistics doesn't block
 * on the design-system agent. Once src/components/ui/** ships with equivalents,
 * swap the imports in home/** and logistics/** to point there and delete this file.
 */
import { ActivityIndicator, Pressable, Text, View, type PressableProps, type ViewProps } from "react-native";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react-native";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Formatting helpers (kept here so every screen formats the same way)
// ---------------------------------------------------------------------------

/** Distinguishes "no data" from a real 0 — never collapse them to the same glyph. */
export function fmt(value: number | string | null | undefined, opts: { digits?: number; suffix?: string } = {}): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  const digits = opts.digits ?? 0;
  return `${n.toFixed(digits)}${opts.suffix ?? ""}`;
}

export function fmtMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtKm(value: number | string | null | undefined): string {
  return fmt(value, { digits: 1, suffix: " km" });
}

export function fmtKg(value: number | string | null | undefined): string {
  return fmt(value, { digits: 1, suffix: " kg" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View className="flex-row items-start justify-between px-5 pb-4 pt-2">
      <View className="flex-1 pr-3">
        <Text className="text-2xl font-bold text-ink">{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-sm text-ink-muted">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, className = "", ...rest }: ViewProps & { className?: string; children?: ReactNode }) {
  return (
    <View className={`rounded-card border border-border bg-surface p-4 shadow-sm ${className}`} {...rest}>
      {children}
    </View>
  );
}

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  className = "",
  ...rest
}: Omit<PressableProps, "onPress" | "disabled"> & {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const styles: Record<ButtonVariant, { bg: string; text: string }> = {
    primary: { bg: "bg-brand-yellow", text: "text-ink" },
    secondary: { bg: "bg-brand-green", text: "text-white" },
    outline: { bg: "bg-transparent border border-border", text: "text-ink" },
    ghost: { bg: "bg-transparent", text: "text-brand-green" },
    danger: { bg: "bg-danger", text: "text-white" },
  };
  const s = styles[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={isDisabled ? undefined : onPress}
      className={`flex-row items-center justify-center gap-2 rounded-pill px-4 py-3 ${s.bg} ${isDisabled ? "opacity-50" : ""} ${className}`}
      {...rest}
    >
      {loading ? <ActivityIndicator size="small" color={variant === "primary" ? "#0E1A14" : "#FFFFFF"} /> : icon}
      <Text className={`text-center text-[15px] font-semibold ${s.text}`}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = "info" }: { label: string; tone?: "success" | "warning" | "danger" | "info" | "muted" }) {
  const map: Record<string, string> = {
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/15 text-danger",
    info: "bg-info/15 text-info",
    muted: "bg-muted text-ink-muted",
  };
  return (
    <View className={`self-start rounded-pill px-2.5 py-1 ${map[tone].split(" ")[0]}`}>
      <Text className={`text-xs font-semibold ${map[tone].split(" ")[1]}`}>{label}</Text>
    </View>
  );
}

export function MetricCard({ label, value, hint, tone = "info" }: { label: string; value: string; hint?: string; tone?: "success" | "warning" | "danger" | "info" | "muted" }) {
  const textTone: Record<string, string> = { success: "text-success", warning: "text-warning", danger: "text-danger", info: "text-ink", muted: "text-ink-muted" };
  return (
    <Card className="min-w-[140px] flex-1">
      <Text className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</Text>
      <Text className={`mt-1 text-2xl font-bold ${textTone[tone]}`}>{value}</Text>
      {hint ? <Text className="mt-0.5 text-xs text-ink-muted">{hint}</Text> : null}
    </Card>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View className="gap-3 px-5 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} className="h-20 animate-pulse rounded-card bg-muted" />
      ))}
    </View>
  );
}

export function EmptyState({ title, message, icon, action }: { title: string; message?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <View className="items-center justify-center gap-2 px-8 py-12">
      {icon ?? <Inbox size={36} color="#5B6B60" />}
      <Text className="text-center text-base font-semibold text-ink">{title}</Text>
      {message ? <Text className="text-center text-sm text-ink-muted">{message}</Text> : null}
      {action ? <View className="mt-3">{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="items-center justify-center gap-2 px-8 py-12">
      <AlertTriangle size={36} color="#B3261E" />
      <Text className="text-center text-base font-semibold text-ink">Something went wrong</Text>
      <Text className="text-center text-sm text-ink-muted">{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} className="mt-3 flex-row items-center gap-2 rounded-pill bg-muted px-4 py-2">
          <RefreshCw size={16} color="#0E1A14" />
          <Text className="text-sm font-semibold text-ink">Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function DemoDataBadge() {
  return <Badge label="Demo data" tone="warning" />;
}
