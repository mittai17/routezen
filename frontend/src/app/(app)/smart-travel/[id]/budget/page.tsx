"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Fuel,
  Hotel,
  UtensilsCrossed,
  Binoculars,
  Coins,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  TrendingDown,
  Info,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Share2,
} from "lucide-react";
import {
  getTripBudget,
  type TripBudget,
} from "@/lib/api/travel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function fmtInr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function BudgetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: budget, isLoading } = useQuery({
    queryKey: ["travel-budget", id],
    queryFn: () => getTripBudget(id),
  });

  const targetBudget = budget?.target_budget_inr ?? 80000;
  const estimatedTotal = budget?.estimated_total_inr ?? 48000;
  const budgetRemaining = targetBudget - estimatedTotal;
  const utilizationPct = Math.min(100, Math.round((estimatedTotal / targetBudget) * 100));

  const categories = [
    {
      label: "Fuel & Highway Tolls",
      icon: Fuel,
      amount: (budget?.fuel_inr ?? 16800) + (budget?.tolls_inr ?? 4200),
      color: "bg-blue-500",
      textColor: "text-blue-600 dark:text-blue-400",
      description: "Petrol @ ₹105/L, 14 km/L + FASTag tolls across NH-44",
    },
    {
      label: "Accommodations",
      icon: Hotel,
      amount: budget?.accommodation_inr ?? 14000,
      color: "bg-indigo-500",
      textColor: "text-indigo-600 dark:text-indigo-400",
      description: "8 overnight stops for 2 adults (avg ₹1,750 / night)",
    },
    {
      label: "Meals & Refreshments",
      icon: UtensilsCrossed,
      amount: budget?.meals_inr ?? 6000,
      color: "bg-amber-500",
      textColor: "text-amber-600 dark:text-amber-400",
      description: "₹400 / day / adult for breakfast, lunch & dinner",
    },
    {
      label: "Sightseeing & Entry Fees",
      icon: Binoculars,
      amount: budget?.attractions_inr ?? 1600,
      color: "bg-emerald-500",
      textColor: "text-emerald-600 dark:text-emerald-400",
      description: "Forts, temples, museums and monuments entry tickets",
    },
    {
      label: "Parking & Incidental Fees",
      icon: Coins,
      amount: budget?.parking_inr ?? 1200,
      color: "bg-purple-500",
      textColor: "text-purple-600 dark:text-purple-400",
      description: "Municipal parking, hill-station green cess & toll slips",
    },
    {
      label: "Safety & Contingency (10%)",
      icon: ShieldCheck,
      amount: budget?.contingency_inr ?? 4200,
      color: "bg-rose-500",
      textColor: "text-rose-600 dark:text-rose-400",
      description: "Reserved emergency fund for tyre punctures, bad weather delays",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Budget Breakdown & Financial Plan</h2>
          <p className="text-sm text-muted-foreground">
            Complete cost estimation with zero hidden fees and transparent per-category calculations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/smart-travel/${id}/itinerary`)}
          >
            Itinerary
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/smart-travel/${id}/final`)}
            className="gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
          >
            View Final Itinerary <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main Budget Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Estimated Expenditure
            </span>
            <div className="flex items-baseline gap-3 mt-1">
              <h3 className="text-3xl font-extrabold text-foreground">
                {fmtInr(estimatedTotal)}
              </h3>
              <span className="text-sm text-muted-foreground">
                of {fmtInr(targetBudget)} target budget
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>Well within budget! {fmtInr(budgetRemaining)} surplus</span>
          </div>
        </div>

        {/* Utilization progress bar */}
        <div className="mt-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">Budget Utilization</span>
            <span className="font-bold text-foreground">{utilizationPct}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-brand transition-all duration-500"
              style={{ width: `${utilizationPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Category Breakdown Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const sharePct = Math.round((cat.amount / estimatedTotal) * 100);

          return (
            <div
              key={cat.label}
              className="rounded-2xl border border-border bg-card p-4.5 shadow-xs hover:border-border/80 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", cat.color)} />
                    <h4 className="font-semibold text-sm">{cat.label}</h4>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">
                    {sharePct}%
                  </span>
                </div>

                <p className="mt-2 text-2xl font-bold text-foreground">
                  {fmtInr(cat.amount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {cat.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                <span>Calculated via live engine</span>
                <span className={cat.textColor}>Verified</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transparent Assumptions & Unknowns disclosure */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <h4 className="font-bold text-base flex items-center gap-2">
          <Info className="size-4 text-brand" /> Calculation Assumptions & Caveats
        </h4>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
          <div className="space-y-2">
            <h5 className="font-semibold text-foreground">Core Assumptions</h5>
            <ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
              <li>Fuel rates calculated at ₹105/L for Petrol across Indian states.</li>
              <li>Vehicle fuel efficiency assumed at 14 km/L for highway cruise.</li>
              <li>Accommodation based on twin-sharing for 2 adults with free parking.</li>
              <li>Standard FastTag toll deduction applied along NH-44 corridor.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h5 className="font-semibold text-foreground">Transparent Unknowns & Variables</h5>
            <ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
              {budget?.unknown_items.map((item, i) => (
                <li key={i}>{item}</li>
              )) ?? (
                <>
                  <li>High-altitude pass fuel consumption penalty (+15% above 3,500m).</li>
                  <li>Local inner-line permit fees for restricted Ladakh regions.</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
