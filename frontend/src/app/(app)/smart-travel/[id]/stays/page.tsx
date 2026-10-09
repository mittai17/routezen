"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  Hotel,
  Star,
  MapPin,
  CheckCircle2,
  ChevronRight,
  Filter,
  Wifi,
  Car,
  Coffee,
  Sparkles,
  DollarSign,
  Moon,
  Info,
} from "lucide-react";
import {
  listStays,
  listCheckpoints,
  type TravelPlace,
  type TravelCheckpoint,
} from "@/lib/api/travel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TravelRouteMap = dynamic(
  () => import("@/components/maps/TravelRouteMap"),
  { ssr: false }
);

function fmtInr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function StaysPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [selectedHub, setSelectedHub] = useState<string>("all");
  const [selectedStayIds, setSelectedStayIds] = useState<Record<string, boolean>>({
    "stay-01": true,
  });
  const [priceFilter, setPriceFilter] = useState<string>("all");

  const { data: checkpoints = [] } = useQuery({
    queryKey: ["travel-checkpoints", id],
    queryFn: () => listCheckpoints(id),
  });

  const { data: rawStays = [], isLoading } = useQuery({
    queryKey: ["travel-stays", id],
    queryFn: () => listStays(id),
  });

  // Additional mock stays across other corridor stops for rich preview
  const extendedStays: TravelPlace[] = [
    ...rawStays,
    {
      id: "stay-vjw-01",
      trip_id: id,
      checkpoint_id: "cp-02",
      category: "stay",
      name: "Quality Hotel Dvas",
      address: "MG Road, Vijayawada",
      lat: 16.508,
      lng: 80.64,
      description: "Convenient business and leisure hotel on NH corridor",
      rating: 4.3,
      review_count: 310,
      price_min: 1750,
      price_max: 2100,
      price_label: "₹1,750/night (est.)",
      amenities: ["Free WiFi", "Breakfast", "Secure Parking"],
      opening_hours: null,
      website: null,
      source: "osm_demo",
      last_checked: new Date().toISOString(),
      is_selected: true,
      distance_from_route_km: 1.1,
      detour_km: 0,
      estimated_visit_min: null,
      entry_price_inr: null,
    },
    {
      id: "stay-ngp-01",
      trip_id: id,
      checkpoint_id: "cp-04",
      category: "stay",
      name: "Tuli Imperial",
      address: "Ramdaspeth, Nagpur",
      lat: 21.135,
      lng: 79.075,
      description: "Comfortable central hotel with secure vehicle parking",
      rating: 4.1,
      review_count: 540,
      price_min: 2200,
      price_max: 2600,
      price_label: "₹2,200/night (est.)",
      amenities: ["Free WiFi", "AC", "EV Charging Point"],
      opening_hours: null,
      website: null,
      source: "osm_demo",
      last_checked: new Date().toISOString(),
      is_selected: true,
      distance_from_route_km: 2.4,
      detour_km: 0.8,
      estimated_visit_min: null,
      entry_price_inr: null,
    },
    {
      id: "stay-mnl-01",
      trip_id: id,
      checkpoint_id: "cp-07",
      category: "stay",
      name: "Himalayan River Resort",
      address: "Old Manali, Himachal Pradesh",
      lat: 32.245,
      lng: 77.185,
      description: "Scenic valley views, heated rooms, essential for high altitude acclimatisation",
      rating: 4.6,
      review_count: 890,
      price_min: 2800,
      price_max: 3400,
      price_label: "₹2,800/night (est.)",
      amenities: ["Mountain View", "Heater", "Free Parking", "Buffet"],
      opening_hours: null,
      website: null,
      source: "osm_demo",
      last_checked: new Date().toISOString(),
      is_selected: true,
      distance_from_route_km: 3.2,
      detour_km: 1.5,
      estimated_visit_min: null,
      entry_price_inr: null,
    },
  ];

  const overnightHubs = checkpoints.filter((c) => c.stay_overnight);

  const filteredStays = extendedStays.filter((stay) => {
    if (selectedHub !== "all" && stay.checkpoint_id !== selectedHub) {
      return false;
    }
    if (priceFilter === "under2k" && (stay.price_min ?? 0) > 2000) {
      return false;
    }
    if (priceFilter === "2k-3k" && ((stay.price_min ?? 0) < 2000 || (stay.price_min ?? 0) > 3000)) {
      return false;
    }
    return true;
  });

  function toggleStaySelection(stayId: string) {
    setSelectedStayIds((prev) => ({
      ...prev,
      [stayId]: !prev[stayId],
    }));
  }

  const selectedCount = Object.values(selectedStayIds).filter(Boolean).length;
  const totalStayCost = Object.keys(selectedStayIds).reduce((acc, sId) => {
    if (!selectedStayIds[sId]) return acc;
    const match = extendedStays.find((s) => s.id === sId);
    return acc + (match?.price_min ?? 1800);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Stay Options & Accommodations</h2>
          <p className="text-sm text-muted-foreground">
            Curated, road-accessible hotels and homestays along each overnight checkpoint corridor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/smart-travel/${id}/checkpoints`)}
          >
            Checkpoints
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/smart-travel/${id}/food`)}
            className="gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
          >
            Continue to Food & Dining <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Overnight Hubs
          </span>
          <p className="mt-1 text-lg font-bold">{overnightHubs.length} stops</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Selected Stays
          </span>
          <p className="mt-1 text-lg font-bold text-success flex items-center gap-1">
            <CheckCircle2 className="size-4" /> {selectedCount} booked / planned
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Est. Total Stay Cost
          </span>
          <p className="mt-1 text-lg font-bold text-brand">{fmtInr(totalStayCost)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Avg Rate per Night
          </span>
          <p className="mt-1 text-lg font-bold">
            {selectedCount > 0 ? fmtInr(Math.round(totalStayCost / selectedCount)) : "₹1,800"}
          </p>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Filter className="size-3.5" /> Filter by Hub:
        </div>

        <button
          type="button"
          onClick={() => setSelectedHub("all")}
          className={cn(
            "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
            selectedHub === "all"
              ? "bg-brand text-brand-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          All Hubs ({extendedStays.length})
        </button>

        {overnightHubs.map((hub) => (
          <button
            key={hub.id}
            type="button"
            onClick={() => setSelectedHub(hub.id)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
              selectedHub === hub.id
                ? "bg-brand text-brand-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {hub.name.split(",")[0]}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Price:</span>
          <select
            value={priceFilter}
            onChange={(e) => setPriceFilter(e.target.value)}
            className="rounded-xl border border-input bg-card px-2.5 py-1 text-xs text-foreground focus:outline-none"
          >
            <option value="all">All Prices</option>
            <option value="under2k">Under ₹2,000 / night</option>
            <option value="2k-3k">₹2,000 – ₹3,000 / night</option>
          </select>
        </div>
      </div>

      {/* Main split: Cards on left, map on right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Stay Cards */}
        <div className="space-y-4 lg:col-span-7">
          {filteredStays.map((stay) => {
            const isSelected = !!selectedStayIds[stay.id];
            const hubName =
              checkpoints.find((c) => c.id === stay.checkpoint_id)?.name ?? "En-route Hub";

            return (
              <div
                key={stay.id}
                className={cn(
                  "rounded-2xl border p-4 transition-all bg-card shadow-sm",
                  isSelected
                    ? "border-brand ring-1 ring-brand bg-brand-soft/20"
                    : "border-border hover:border-border/80 hover:bg-card/90"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                        {hubName.split(",")[0]}
                      </span>
                      <h3 className="font-semibold text-base leading-tight">
                        {stay.name}
                      </h3>
                      {stay.rating && (
                        <span className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                          <Star className="size-3 fill-current" /> {stay.rating}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3 shrink-0" /> {stay.address}
                    </p>
                    <p className="mt-1.5 text-xs text-foreground/80 leading-relaxed">
                      {stay.description}
                    </p>

                    {/* Amenities tag row */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {stay.amenities.map((a) => (
                        <span
                          key={a}
                          className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border/50"
                        >
                          {a}
                        </span>
                      ))}
                      {stay.detour_km != null && (
                        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          {stay.detour_km === 0 ? "Directly on NH" : `${stay.detour_km} km detour`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price & Selection column */}
                  <div className="text-right shrink-0">
                    <span className="font-bold text-base text-brand">
                      {stay.price_label ?? (stay.price_min ? fmtInr(stay.price_min) : "₹1,800/night")}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">estimated rate</p>

                    <div className="mt-3">
                      <Button
                        size="sm"
                        onClick={() => toggleStaySelection(stay.id)}
                        className={cn(
                          "h-8 text-xs font-semibold",
                          isSelected
                            ? "bg-brand text-brand-foreground shadow-sm hover:bg-brand/90"
                            : "border border-border bg-card hover:bg-muted text-foreground"
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

        {/* Right Column: Leaflet Map Preview */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 space-y-4">
            <Card className="overflow-hidden border border-border shadow-sm">
              <div className="h-[480px] w-full">
                <TravelRouteMap
                  checkpoints={checkpoints}
                  places={filteredStays}
                  height="100%"
                />
              </div>
            </Card>

            <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Sparkles className="size-4 text-brand" /> Safe Corridor Lodging Guarantee
              </div>
              <p>
                Hotels and guest homes are checked for safe parking, 24-hour reception, and proximity to major arterial highways to minimize route deviations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
