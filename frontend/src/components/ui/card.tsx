import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius-card)] border border-border bg-card text-card-foreground shadow-[var(--shadow-card)]", className)} {...p} />;
}
export function CardHeader({ className, title, icon, action, subtitle, ...p }: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & { title?: React.ReactNode; subtitle?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 pt-4", className)} {...p}>
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="text-success [&_svg]:size-5">{icon}</span>}
        <div className="min-w-0">
          {title && <h3 className="truncate text-[15px] font-semibold leading-tight">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
export function CardContent({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...p} />;
}
