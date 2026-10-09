"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Moon,
  Hotel,
  UtensilsCrossed,
  Binoculars,
  Star,
  CheckCircle2,
  Calendar,
  Sparkles,
  ExternalLink,
  Plus,
} from "lucide-react";
import {
  listCheckpoints,
  listStays,
  listRestaurants,
  listAttractions,
  type TravelCheckpoint,
  type TravelPlace,
} from "@/lib/api/travel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TravelRouteMap = dynamic(
  () => import("@/components/maps/TravelRouteMap"),
  { ssr: false }
);

function fmtInr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function CheckpointDetailPage() {
  const { id, cid } = useParams<{ id: string; cid: string }>();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"stays" | "food" | "attractions">("stays");
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Record<string, boolean>>({
    "stay-01": true,
    "attr-02": true,
  });

  const { data: checkpoints = [] } = useQuery({
    queryKey: ["travel-checkpoints", id],
    queryFn: () => listCheckpoints(id),
  });

  const checkpoint = checkpoints.find((c) => c.id === cid) ?? checkpoints[2]; // fallback to Hyderabad if demo id mismatch

  const { data: stays = [], isLoading: staysLoading } = useQuery({
    queryKey: ["travel-stays", id, cid],
    queryFn: () => listStays(id, cid),
  });

  const { data: restaurants = [], isLoading: foodLoading } = useQuery({
    queryKey: ["travel-restaurants", id, cid],
    queryFn: () => listRestaurants(id, cid),
  });

  const { data: attractions = [], isLoading: attrLoading } = useQuery({
    queryKey: ["travel-attractions", id, cid],
    queryFn: () => listAttractions(id, cid),
  });

  function togglePlace(placeId: string) {
    setSelectedPlaceIds((prev) => ({
      ...prev,
      [placeId]: !prev[placeId],
    }));
  }

  const allPlaces: TravelPlace[] = [...stays, ...restaurants, ...attractions];

  return (
    <div className="space-y-6">
      {/* Back button & title */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/smart-travel/${id}/checkpoints`}
            className="grid size-8 place-items-center rounded-xl border border-border bg-card hover:bg-muted transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">
                {checkpoint?.name ?? "Checkpoint Explorer"}
              </h2>
              {checkpoint?.stay_overnight && (
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                  <Moon className="size-3" /> Overnight Hub
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              GPS: {checkpoint?.lat.toFixed(4)}, {checkpoint?.lng.toFixed(4)} · Sequence #{checkpoint?.sequence}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/smart-travel/${id}/checkpoints`)}
          >
            Back to Checkpoints
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/smart-travel/${id}/itinerary`)}
            className="bg-brand text-brand-foreground hover:bg-brand/90"
          >
            View in Itinerary
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Planned Arrival
          </span>
          <p className="mt-1 text-sm font-bold">
            {checkpoint?.planned_arrival
              ? new Date(checkpoint.planned_arrival).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "12:00 PM (Est.)"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Planned Departure
          </span>
          <p className="mt-1 text-sm font-bold">
            {checkpoint?.planned_departure
              ? new Date(checkpoint.planned_departure).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "07:00 AM (Next Day)"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Activity / Dwell
          </span>
          <p className="mt-1 text-sm font-bold text-brand">
            {checkpoint?.activity_duration_min ? `${checkpoint.activity_duration_min / 60} hours` : "Overnight"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Distance from Origin
          </span>
          <p className="mt-1 text-sm font-bold">
            {checkpoint?.distance_from_prev_km ? `+${checkpoint.distance_from_prev_km} km` : "Starting Point"}
          </p>
        </div>
      </div>

      {/* Main Grid: Left place discovery, Right map */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Explorer Tabs */}
        <div className="space-y-4 lg:col-span-7">
          {/* Tab selector */}
          <div className="flex gap-2 border-b border-border pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("stays")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "stays"
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Hotel className="size-4" /> Stays ({stays.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("food")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "food"
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <UtensilsCrossed className="size-4" /> Food & Dining ({restaurants.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("attractions")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "attractions"
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Binoculars className="size-4" /> Attractions ({attractions.length})
            </button>
          </div>

          {/* Stays tab content */}
          {activeTab === "stays" && (
            <div className="space-y-3">
              {stays.map((stay) => {
                const isSelected = !!selectedPlaceIds[stay.id];
                return (
                  <div
                    key={stay.id}
                    className={cn(
                      "rounded-2xl border p-4 transition-all bg-card",
                      isSelected ? "border-brand ring-1 ring-brand bg-brand-soft/20" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-base">{stay.name}</h4>
                          {stay.rating && (
                            <span className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                              <Star className="size-3 fill-current" /> {stay.rating}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{stay.address}</p>
                        <p className="text-xs text-foreground/80 mt-1">{stay.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {stay.amenities.map((a) => (
                            <span
                              key={a}
                              className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-base text-brand">
                          {stay.price_label ?? (stay.price_min ? fmtInr(stay.price_min) : "Inquire")}
                        </span>
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            onClick={() => togglePlace(stay.id)}
                            className={cn(
                              "text-xs h-8",
                              isSelected ? "bg-brand text-brand-foreground" : ""
                            )}
                          >
                            {isSelected ? (
                              <>
                                <CheckCircle2 className="size-3.5 mr-1" /> Selected
                              </>
                            ) : (
                              "Select Stay"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Food tab content */}
          {activeTab === "food" && (
            <div className="space-y-3">
              {restaurants.map((rest) => {
                const isSelected = !!selectedPlaceIds[rest.id];
                return (
                  <div
                    key={rest.id}
                    className={cn(
                      "rounded-2xl border p-4 transition-all bg-card",
                      isSelected ? "border-brand ring-1 ring-brand bg-brand-soft/20" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-base">{rest.name}</h4>
                          {rest.rating && (
                            <span className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                              <Star className="size-3 fill-current" /> {rest.rating}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{rest.address}</p>
                        <p className="text-xs text-foreground/80 mt-1">{rest.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {rest.amenities.map((a) => (
                            <span
                              key={a}
                              className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-semibold text-sm">
                          {rest.price_label ?? "₹400 / person"}
                        </span>
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            onClick={() => togglePlace(rest.id)}
                            className={cn(
                              "text-xs h-8",
                              isSelected ? "bg-brand text-brand-foreground" : ""
                            )}
                          >
                            {isSelected ? (
                              <>
                                <CheckCircle2 className="size-3.5 mr-1" /> Added
                              </>
                            ) : (
                              "Add to Plan"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Attractions tab content */}
          {activeTab === "attractions" && (
            <div className="space-y-3">
              {attractions.map((attr) => {
                const isSelected = !!selectedPlaceIds[attr.id];
                return (
                  <div
                    key={attr.id}
                    className={cn(
                      "rounded-2xl border p-4 transition-all bg-card",
                      isSelected ? "border-brand ring-1 ring-brand bg-brand-soft/20" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-base">{attr.name}</h4>
                          {attr.rating && (
                            <span className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                              <Star className="size-3 fill-current" /> {attr.rating}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{attr.address}</p>
                        <p className="text-xs text-foreground/80 mt-1">{attr.description}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          {attr.estimated_visit_min && (
                            <span>⏱️ {attr.estimated_visit_min} mins visit</span>
                          )}
                          {attr.detour_km != null && (
                            <span>🚗 {attr.detour_km} km detour</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-sm text-brand">
                          {attr.price_label ?? (attr.entry_price_inr ? fmtInr(attr.entry_price_inr) : "Free")}
                        </span>
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            onClick={() => togglePlace(attr.id)}
                            className={cn(
                              "text-xs h-8",
                              isSelected ? "bg-brand text-brand-foreground" : ""
                            )}
                          >
                            {isSelected ? (
                              <>
                                <CheckCircle2 className="size-3.5 mr-1" /> Added
                              </>
                            ) : (
                              "Add to Day"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Checkpoint local Map */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 space-y-4">
            <Card className="overflow-hidden border border-border shadow-sm">
              <div className="h-[460px] w-full">
                <TravelRouteMap
                  checkpoints={checkpoint ? [checkpoint] : []}
                  places={allPlaces}
                  selectedCheckpointId={checkpoint?.id}
                  height="100%"
                />
              </div>
            </Card>

            <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-2">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-brand" /> OpenStreetMap Powered Discovery
              </span>
              <p>
                All accommodations, food stops, and scenic points are geocoded and ranked by detour penalty and traveller ratings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
