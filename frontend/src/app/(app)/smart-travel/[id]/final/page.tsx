"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  CheckCheck,
  Calendar,
  MapPin,
  Car,
  Fuel,
  Users,
  Printer,
  Download,
  Share2,
  Navigation,
  Radio,
  FileText,
  ShieldCheck,
  Clock,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import {
  getTrip,
  listCheckpoints,
  getTripBudget,
} from "@/lib/api/travel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TravelRouteMap = dynamic(
  () => import("@/components/maps/TravelRouteMap"),
  { ssr: false }
);

function fmtInr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function FinalTripSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: trip } = useQuery({
    queryKey: ["travel-trip", id],
    queryFn: () => getTrip(id),
  });

  const { data: checkpoints = [] } = useQuery({
    queryKey: ["travel-checkpoints", id],
    queryFn: () => listCheckpoints(id),
  });

  const { data: budget } = useQuery({
    queryKey: ["travel-budget", id],
    queryFn: () => getTripBudget(id),
  });

  const [checklist, setChecklist] = useState({
    fastag: true,
    coolant: true,
    tyres: true,
    offlineMaps: true,
    meds: true,
    permits: false,
  });

  function toggleCheck(key: keyof typeof checklist) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleExportJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({ trip, checkpoints, budget }, null, 2)
    );
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `RouteZen_${trip?.name ?? "Trip"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              Trip Finalized & Ready
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight mt-1">
            {trip?.name ?? "Chennai to Leh — Grand Adventure"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Complete executive briefing sheet, pre-departure vehicle checklist, and navigation export.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <Printer className="size-4" /> Print Briefing
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            className="gap-1.5"
          >
            <Download className="size-4" /> Export JSON
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/smart-travel/${id}/live`)}
            className="gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90 font-bold shadow-md"
          >
            <Radio className="size-4 animate-pulse text-red-500" /> Start Live Journey
          </Button>
        </div>
      </div>

      {/* Hero Briefing Card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {/* Key Facts */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <FileText className="size-4 text-brand" /> Expedition Overview
            </h3>

            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Departure Date
                </span>
                <p className="font-semibold text-foreground mt-0.5">
                  {trip?.departure_date ?? "13 May 2025"}
                </p>
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Party Size
                </span>
                <p className="font-semibold text-foreground mt-0.5">
                  {trip?.adults ?? 2} Adults (Solo/Couple)
                </p>
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Travel Mode
                </span>
                <p className="font-semibold text-foreground mt-0.5 capitalize">
                  Personal SUV ({trip?.travel_mode ?? "Car"})
                </p>
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Total Distance
                </span>
                <p className="font-semibold text-foreground mt-0.5">
                  3,100 km (NH-44 Corridor)
                </p>
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Total Duration
                </span>
                <p className="font-semibold text-foreground mt-0.5">
                  8 Days · 7 Nights
                </p>
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Estimated Total Budget
                </span>
                <p className="font-bold text-brand mt-0.5">
                  {fmtInr(budget?.estimated_total_inr ?? 48000)}
                </p>
              </div>
            </div>
          </div>

          {/* Pre-Trip Vehicle & Safety Checklist */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
            <h3 className="font-bold text-base flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-500" /> Pre-Departure Vehicle & Safety Checklist
            </h3>
            <p className="text-xs text-muted-foreground">
              Complete these critical safety checks before embarking on the highway corridor.
            </p>

            <div className="space-y-2.5 pt-2">
              {[
                { key: "fastag", label: "FASTag account recharged with at least ₹5,000" },
                { key: "coolant", label: "Coolant & engine oil checked for sub-zero Himalayan temperatures" },
                { key: "tyres", label: "All 4 tyres & spare tyre pressure checked, tread depth verified" },
                { key: "offlineMaps", label: "Offline GPS maps downloaded for mountain areas without cellular data" },
                { key: "meds", label: "High altitude medicine kit (Diamox, ORS, pain relief, bandages) packed" },
                { key: "permits", label: "Inner Line Permit (ILP) application ready for Leh / Nubra Valley" },
              ].map(({ key, label }) => {
                const isChecked = checklist[key as keyof typeof checklist];
                return (
                  <label
                    key={key}
                    className="flex items-center gap-3 rounded-xl border border-border/70 p-3 text-xs font-medium cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(key as keyof typeof checklist)}
                      className="size-4 rounded accent-brand cursor-pointer"
                    />
                    <span className={cn(isChecked ? "text-foreground line-through opacity-70" : "text-foreground")}>
                      {label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Route Map Preview */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 space-y-4">
            <Card className="overflow-hidden border border-border shadow-sm">
              <div className="h-[460px] w-full">
                <TravelRouteMap
                  checkpoints={checkpoints}
                  height="100%"
                />
              </div>
            </Card>

            <div className="rounded-2xl border border-brand/40 bg-brand-soft/20 p-5 space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Sparkles className="size-4 text-brand" /> Ready to Hit the Road?
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Open the Live Journey HUD during your drive for real-time corridor turn-by-turn alerts, fuel countdowns, altitude profiles, and nearest SOS services.
              </p>
              <Button
                onClick={() => router.push(`/smart-travel/${id}/live`)}
                className="w-full bg-brand text-brand-foreground hover:bg-brand/90 font-bold"
              >
                Launch Live Journey HUD →
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
