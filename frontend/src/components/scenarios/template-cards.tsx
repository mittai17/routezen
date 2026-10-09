"use client";
import { Building2, Fuel, Gauge, Leaf, Plus, Repeat, Route, Wallet, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TEMPLATES, type Template, type TemplateContext } from "./scenario-form";

const ICONS = { building: Building2, zap: Zap, gauge: Gauge, leaf: Leaf, plus: Plus, wallet: Wallet, repeat: Repeat, route: Route, fuel: Fuel } as const;

export function TemplateCards({ ctx, loading, error, onUse, onCustom }: { ctx: TemplateContext | null; loading: boolean; error?: string; onUse: (t: Template) => void; onCustom: () => void }) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading templates">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36 w-full rounded-[var(--radius-card)]" />)}
      </div>
    );
  }
  return (
    <>
      {error && <p role="alert" className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">Templates need your locations and vehicles, which could not be loaded: {error}</p>}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((t) => {
          const Icon = ICONS[t.icon];
          const reason = ctx ? (t.unavailable?.(ctx) ?? null) : "Locations and vehicles are not loaded.";
          return (
            <li key={t.id}>
              <Card className="flex h-full flex-col p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-foreground"><Icon className="size-5" aria-hidden /></span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold leading-tight">{t.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-1">{t.tags.map((g) => <Badge key={g} tone={g === "Not available" ? "warning" : "neutral"}>{g}</Badge>)}</div>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                {reason && <p className="mt-2 text-[11px] text-warning">{reason}</p>}
                <Button variant="primary" size="sm" className="mt-3 w-full" disabled={!!reason} onClick={() => onUse(t)} aria-label={`Use template ${t.title}`}>Use template</Button>
              </Card>
            </li>
          );
        })}
        <li>
          <Card className="flex h-full flex-col border-dashed p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Plus className="size-5" aria-hidden /></span>
              <div><h3 className="text-[15px] font-semibold leading-tight">Custom scenario</h3><div className="mt-1"><Badge>Blank</Badge></div></div>
            </div>
            <p className="mt-3 flex-1 text-xs leading-relaxed text-muted-foreground">Start from scratch: choose the depot, stops, vehicles and scoring weights yourself.</p>
            <Button size="sm" className="mt-3 w-full" onClick={onCustom}>Create scenario</Button>
          </Card>
        </li>
      </ul>
    </>
  );
}
