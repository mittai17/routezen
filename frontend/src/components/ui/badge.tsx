import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4", {
  variants: {
    tone: {
      neutral: "bg-muted text-muted-foreground",
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-danger",
      info: "bg-info-soft text-info",
      violet: "bg-violet-soft text-violet",
      brand: "bg-brand-soft text-foreground",
    },
  },
  defaultVariants: { tone: "neutral" },
});
export type Tone = NonNullable<VariantProps<typeof badge>["tone"]>;

export function Badge({ tone, className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cn(badge({ tone }), className)}>{children}</span>;
}

const statusTone: Record<string, Tone> = {
  active: "success", available: "success", completed: "success", recommended: "success", delivered: "success", ok: "success",
  idle: "warning", pending: "warning", queued: "warning", running: "info", "in transit": "info",
  failed: "danger", cancelled: "danger", delayed: "danger", error: "danger", inactive: "neutral",
  high: "danger", medium: "warning", low: "success", demo: "brand",
};
/** Status pill: colour is derived from the status string; the label always carries the meaning (not colour alone). */
export function StatusPill({ status, label }: { status: string; label?: string }) {
  return <Badge tone={statusTone[status.toLowerCase()] ?? "neutral"}>{label ?? status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

export function DemoBadge({ className }: { className?: string }) {
  return <Badge tone="brand" className={cn("border border-brand/60 uppercase tracking-wide", className)}>Demo data</Badge>;
}
