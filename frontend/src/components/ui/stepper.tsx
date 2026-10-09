import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step { title: string; subtitle: string }

export function Stepper({ steps, current, onSelect, maxReached }: { steps: Step[]; current: number; onSelect?: (i: number) => void; maxReached?: number }) {
  const reach = maxReached ?? current;
  return (
    <nav aria-label="Plan steps" className="min-w-0 overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const disabled = i > reach;
          return (
            <li key={s.title} className="flex items-center">
              <button
                type="button"
                disabled={disabled}
                aria-current={active ? "step" : undefined}
                onClick={() => onSelect?.(i)}
                className={cn("flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left", !disabled && "hover:bg-muted", disabled && "opacity-60")}
              >
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold", done ? "bg-success text-white" : active ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground")}>
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="hidden min-w-0 lg:block">
                  <span className="block text-[13px] font-semibold leading-tight">{s.title}</span>
                  <span className="block max-w-36 truncate text-[11px] text-muted-foreground">{s.subtitle}</span>
                </span>
              </button>
              {i < steps.length - 1 && <span aria-hidden className="mx-1 hidden h-px w-4 bg-border sm:block" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
