import * as React from "react";
import { cn } from "@/lib/utils";

export function FormField({ label, htmlFor, error, hint, className, children }: { label: string; htmlFor: string; error?: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-foreground">{label}</label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} role="alert" className="text-[11px] font-medium text-danger">{error}</p>}
    </div>
  );
}
