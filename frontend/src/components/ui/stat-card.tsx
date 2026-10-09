import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "./card";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, icon, tone = "success", delta, deltaLabel, hint }: {
  label: string; value: React.ReactNode; icon: React.ReactNode; tone?: "success" | "brand" | "violet" | "info" | "danger";
  delta?: number; deltaLabel?: string; hint?: string;
}) {
  const toneCls = { success: "bg-success-soft text-success", brand: "bg-brand-soft text-warning", violet: "bg-violet-soft text-violet", info: "bg-info-soft text-info", danger: "bg-danger-soft text-danger" }[tone];
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl [&_svg]:size-5", toneCls)}>{icon}</div>
      <div className="min-w-0">
        <div className="truncate text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-bold leading-tight">{value}</div>
        {delta !== undefined ? (
          <div className={cn("flex items-center gap-0.5 text-[11px] font-medium", delta <= 0 ? "text-success" : "text-danger")}>
            {delta <= 0 ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}
            {Math.abs(delta)}% {deltaLabel}
          </div>
        ) : hint ? <div className="truncate text-[11px] text-muted-foreground">{hint}</div> : null}
      </div>
    </Card>
  );
}
