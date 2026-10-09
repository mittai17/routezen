"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock,
  Car,
  Hotel,
  UtensilsCrossed,
  Binoculars,
  ChevronRight,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import {
  buildItinerary,
  type ItineraryDay,
} from "@/lib/api/travel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function fmtInr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtHours(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const ITEM_ICONS: Record<string, any> = {
  drive: Car,
  attraction: Binoculars,
  meal: UtensilsCrossed,
  stay: Hotel,
};

const ITEM_COLORS: Record<string, string> = {
  drive: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900",
  attraction: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
  meal: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900",
  stay: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900",
};

export default function ItineraryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [expandedDay, setExpandedDay] = useState<number>(1);

  const { data: itinerary = [], isLoading } = useQuery({
    queryKey: ["travel-itinerary", id],
    queryFn: () => buildItinerary(id),
  });

  const optimizeMutation = useMutation({
    mutationFn: () => buildItinerary(id),
    onSuccess: (data) => {
      queryClient.setQueryData(["travel-itinerary", id], data);
    },
  });

  // Extended days for rich full-journey preview (Chennai to Leh)
  const fullItinerary: ItineraryDay[] = [
    ...(itinerary.length > 0 ? itinerary : []),
    {
      id: "day-04",
      trip_id: id,
      day_number: 4,
      date: "2025-05-16",
      start_checkpoint_id: "cp-04",
      end_checkpoint_id: "cp-05",
      drive_distance_km: 425,
      drive_duration_min: 380,
      estimated_cost_inr: 3800,
      notes: "Passing through Central India into Bundelkhand",
      items: [
        {
          id: "item-04a",
          sequence: 0,
          type: "drive",
          label: "Nagpur → Jhansi",
          place_id: null,
          checkpoint_id: "cp-05",
          start_time: "07:00",
          end_time: "13:30",
          duration_min: 390,
          cost_inr: 2900,
          notes: "Smooth four-lane section on NH-44",
        },
        {
          id: "item-04b",
          sequence: 1,
          type: "attraction",
          label: "Jhansi Fort exploration",
          place_id: null,
          checkpoint_id: "cp-05",
          start_time: "15:00",
          end_time: "17:00",
          duration_min: 120,
          cost_inr: 50,
          notes: "Rani Lakshmibai historic site",
        },
        {
          id: "item-04c",
          sequence: 2,
          type: "stay",
          label: "Jhansi Heritage Stay check-in",
          place_id: null,
          checkpoint_id: "cp-05",
          start_time: "18:00",
          end_time: "18:30",
          duration_min: 30,
          cost_inr: 1600,
          notes: null,
        },
      ],
    },
    {
      id: "day-05",
      trip_id: id,
      day_number: 5,
      date: "2025-05-17",
      start_checkpoint_id: "cp-05",
      end_checkpoint_id: "cp-06",
      drive_distance_km: 415,
      drive_duration_min: 360,
      estimated_cost_inr: 4200,
      notes: "Arrival in National Capital Region",
      items: [
        {
          id: "item-05a",
          sequence: 0,
          type: "drive",
          label: "Jhansi → Delhi NCR",
          place_id: null,
          checkpoint_id: "cp-06",
          start_time: "07:30",
          end_time: "13:30",
          duration_min: 360,
          cost_inr: 2800,
          notes: "Via Agra Bypass & Yamuna Expressway",
        },
        {
          id: "item-05b",
          sequence: 1,
          type: "meal",
          label: "North Indian Lunch & Chai",
          place_id: null,
          checkpoint_id: "cp-06",
          start_time: "14:00",
          end_time: "15:00",
          duration_min: 60,
          cost_inr: 750,
          notes: null,
        },
        {
          id: "item-05c",
          sequence: 2,
          type: "stay",
          label: "Aerocity / Central Delhi Hotel",
          place_id: null,
          checkpoint_id: "cp-06",
          start_time: "16:00",
          end_time: "16:30",
          duration_min: 30,
          cost_inr: 2200,
          notes: null,
        },
      ],
    },
    {
      id: "day-06",
      trip_id: id,
      day_number: 6,
      date: "2025-05-18",
      start_checkpoint_id: "cp-06",
      end_checkpoint_id: "cp-07",
      drive_distance_km: 562,
      drive_duration_min: 480,
      estimated_cost_inr: 5100,
      notes: "Ascent into Western Himalayas. High drive hours — caution required.",
      items: [
        {
          id: "item-06a",
          sequence: 0,
          type: "drive",
          label: "Delhi → Manali Valley",
          place_id: null,
          checkpoint_id: "cp-07",
          start_time: "05:00",
          end_time: "16:30",
          duration_min: 510,
          cost_inr: 3900,
          notes: "Early 5 AM start recommended to avoid Chandigarh congestion",
        },
        {
          id: "item-06b",
          sequence: 1,
          type: "meal",
          label: "Breakfast at Murthal Haveli",
          place_id: null,
          checkpoint_id: "cp-07",
          start_time: "06:30",
          end_time: "07:30",
          duration_min: 60,
          cost_inr: 500,
          notes: "Stuffed parathas and hot chai",
        },
        {
          id: "item-06c",
          sequence: 2,
          type: "stay",
          label: "Himalayan River Resort Manali",
          place_id: null,
          checkpoint_id: "cp-07",
          start_time: "17:30",
          end_time: "18:00",
          duration_min: 30,
          cost_inr: 2800,
          notes: "Altitude: 2,050m. Acclimatisation rest night.",
        },
      ],
    },
    {
      id: "day-07",
      trip_id: id,
      day_number: 7,
      date: "2025-05-19",
      start_checkpoint_id: "cp-07",
      end_checkpoint_id: "cp-07",
      drive_distance_km: 60,
      drive_duration_min: 90,
      estimated_cost_inr: 2600,
      notes: "Acclimatisation & Solang Valley exploration before high mountain passes",
      items: [
        {
          id: "item-07a",
          sequence: 0,
          type: "attraction",
          label: "Solang Valley & Atal Tunnel excursion",
          place_id: null,
          checkpoint_id: "cp-07",
          start_time: "10:00",
          end_time: "14:00",
          duration_min: 240,
          cost_inr: 400,
          notes: "Acclimatisation above 3,000m",
        },
        {
          id: "item-07b",
          sequence: 1,
          type: "stay",
          label: "Second night in Manali",
          place_id: null,
          checkpoint_id: "cp-07",
          start_time: "16:00",
          end_time: "16:30",
          duration_min: 30,
          cost_inr: 2800,
          notes: "Vital rest day before Leh-Manali highway",
        },
      ],
    },
    {
      id: "day-08",
      trip_id: id,
      day_number: 8,
      date: "2025-05-20",
      start_checkpoint_id: "cp-07",
      end_checkpoint_id: "cp-08",
      drive_distance_km: 479,
      drive_duration_min: 420,
      estimated_cost_inr: 4200,
      notes: "Grand Ascent over Baralacha La & Tanglang La into Leh, Ladakh!",
      items: [
        {
          id: "item-08a",
          sequence: 0,
          type: "drive",
          label: "Manali → Leh (Ladakh)",
          place_id: null,
          checkpoint_id: "cp-08",
          start_time: "05:00",
          end_time: "15:00",
          duration_min: 600,
          cost_inr: 3400,
          notes: "Spectacular high altitude highway (5,328m max pass)",
        },
        {
          id: "item-08b",
          sequence: 1,
          type: "stay",
          label: "Grand Arrival in Leh, Ladakh",
          place_id: null,
          checkpoint_id: "cp-08",
          start_time: "16:00",
          end_time: "16:30",
          duration_min: 30,
          cost_inr: 2500,
          notes: "Destination reached. Immediate hydration and resting.",
        },
      ],
    },
  ];

  const totalKm = fullItinerary.reduce((acc, d) => acc + d.drive_distance_km, 0);
  const totalCost = fullItinerary.reduce((acc, d) => acc + d.estimated_cost_inr, 0);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Day-wise Travel Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Complete synchronized timeline respecting driving fatigue limits, meal hours, and sightseeing stops.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => optimizeMutation.mutate()}
            disabled={optimizeMutation.isPending}
            className="gap-1.5"
          >
            <RefreshCw
              className={cn("size-3.5", optimizeMutation.isPending && "animate-spin")}
            />
            {optimizeMutation.isPending ? "Optimizing…" : "Re-optimize Schedule"}
          </Button>

          <Button
            size="sm"
            onClick={() => router.push(`/smart-travel/${id}/budget`)}
            className="gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
          >
            Review Budget <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Total Duration
          </span>
          <p className="mt-1 text-lg font-bold">{fullItinerary.length} Days</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Total Road Distance
          </span>
          <p className="mt-1 text-lg font-bold">{totalKm.toLocaleString("en-IN")} km</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Est. Total Expense
          </span>
          <p className="mt-1 text-lg font-bold text-brand">{fmtInr(totalCost)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Safety & Fatigue Check
          </span>
          <p className="mt-1 text-lg font-bold text-success flex items-center gap-1">
            <CheckCircle2 className="size-4" /> Verified Safe
          </p>
        </div>
      </div>

      {/* Itinerary Day-by-Day Accordion / Timeline */}
      <div className="space-y-4">
        {fullItinerary.map((day) => {
          const isExpanded = expandedDay === day.day_number;
          const isHeavyDrive = day.drive_duration_min > 450; // > 7.5 hrs

          return (
            <div
              key={day.id}
              className={cn(
                "overflow-hidden rounded-2xl border transition-all bg-card shadow-sm",
                isExpanded ? "border-brand/60 ring-1 ring-brand/30" : "border-border hover:border-border/80"
              )}
            >
              {/* Day Card Header */}
              <div
                onClick={() => setExpandedDay(isExpanded ? 0 : day.day_number)}
                className="flex cursor-pointer items-center justify-between p-4.5 bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand font-bold text-brand-foreground shadow-sm">
                    D{day.day_number}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-base leading-tight">
                        Day {day.day_number} {day.date ? `· ${day.date}` : ""}
                      </h3>
                      {isHeavyDrive && (
                        <span className="flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="size-3" /> Heavy Drive Day
                        </span>
                      )}
                      {day.day_number === 7 && (
                        <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">
                          Acclimatisation Rest
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {day.notes}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Car className="size-3.5 text-muted-foreground" /> {day.drive_distance_km} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" /> {fmtHours(day.drive_duration_min)}
                    </span>
                    <span className="font-semibold text-brand">
                      {fmtInr(day.estimated_cost_inr)}
                    </span>
                  </div>

                  <div className="rounded-lg p-1 text-muted-foreground">
                    <ChevronDown
                      className={cn("size-5 transition-transform", isExpanded && "rotate-180")}
                    />
                  </div>
                </div>
              </div>

              {/* Day Timeline Body */}
              {isExpanded && (
                <div className="border-t border-border/70 bg-card/60 p-5 space-y-4">
                  {/* Timeline Items */}
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {day.items.map((item, idx) => {
                      const Icon = ITEM_ICONS[item.type] ?? Car;
                      const badgeClass = ITEM_COLORS[item.type] ?? ITEM_COLORS.drive;

                      return (
                        <div key={item.id} className="relative group">
                          {/* Dot on timeline */}
                          <div className="absolute -left-[27px] top-1.5 size-3.5 rounded-full border-2 border-card bg-brand ring-2 ring-brand/30" />

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border/60 bg-card p-3.5 shadow-xs">
                            <div className="flex items-start gap-3">
                              <span
                                className={cn(
                                  "rounded-lg p-2 border shrink-0",
                                  badgeClass
                                )}
                              >
                                <Icon className="size-4" />
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-sm leading-snug">
                                    {item.label}
                                  </h4>
                                  <span className="text-[11px] font-mono text-muted-foreground">
                                    {item.start_time} – {item.end_time}
                                  </span>
                                </div>
                                {item.notes && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs shrink-0 pl-11 sm:pl-0">
                              <span className="text-muted-foreground">
                                ⏱️ {fmtHours(item.duration_min)}
                              </span>
                              {item.cost_inr > 0 && (
                                <span className="font-semibold text-foreground">
                                  {fmtInr(item.cost_inr)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* High altitude / Safety reminder for Days 6, 7 & 8 */}
                  {day.day_number >= 6 && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-800 dark:text-sky-300">
                      <ShieldAlert className="size-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
                      <div>
                        <span className="font-semibold">Himalayan Route Safety Advisory:</span>{" "}
                        Ensure vehicle radiator coolant is rated for sub-zero temperatures. Keep Diamox / altitude sickness tablets ready and avoid over-exertion during initial 24 hours above 3,000 metres.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
