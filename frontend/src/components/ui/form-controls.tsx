import * as React from "react";
import { cn } from "@/lib/utils";

const base = "w-full rounded-[var(--radius-control)] border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring disabled:opacity-60 aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(base, "h-10", className)} {...p} />;
});
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(base, "min-h-20 py-2", className)} {...p} />;
});
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={cn(base, "h-10 pr-8", className)} {...p} />;
});

export const Switch = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: string }>(function Switch({ className, label, ...p }, ref) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm", className)}>
      <input ref={ref} type="checkbox" role="switch" className="peer sr-only" {...p} />
      <span className="relative h-5 w-9 rounded-full bg-input transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-success peer-checked:after:translate-x-4 peer-focus-visible:shadow-[var(--focus-ring)]" />
      {label && <span>{label}</span>}
    </label>
  );
});
