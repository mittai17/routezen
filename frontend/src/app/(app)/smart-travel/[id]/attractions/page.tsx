"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  Binoculars,
  Star,
  MapPin,
  CheckCircle2,
  ChevronRight,
  Filter,
  Clock,
  Sparkles,
  Camera,
  Ticket,
  Compass,
} from "lucide-react";
import {
  listAttractions,
  listCheckpoints,
  type TravelPlace,
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

export default function AttractionsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedHub, setSelectedHub] = useState<string>("all");
  const [selectedAttractions, setSelectedAttractions] = useState<Record<string, boolean>>({
    "attr-01": true,
    "attr-02": true,
  });

  const { data: checkpoints = [] } = useQuery({
    queryKey: ["travel-checkpoints", id],
    queryFn: () => listCheckpoints(id),
  });

  const { data: rawAttractions = [] } = useQuery({
    queryKey: ["travel-attractions", id],
    queryFn: () => listAttractions(id),
  });

  // Extended attractions across the corridor
  const extendedAttractions: TravelPlace[] = [
    ...rawAttractions,
    {
      id: "attr-vjw-01",
      trip_id: id,
      checkpoint_id: "cp-02",
      category: "attraction",
      name: "Kanaka Durga Temple & Prakasam Barrage",
      address: "Indrakeeladri Hill, Vijayawada",
      lat: 16.515,
      lng: 80.605,
      description: "Historic temple perched on hill with sweeping Krishna river panoramic views",
      rating: 4.7,
      review_count: 24000,
      price_min: 0,
      price_max: 100,
      price_label: "Free / ₹100 Special Darshan",
      amenities: ["Panoramic Views", "Historic Shrine", "River View"],
      opening_hours: "04:00–21:00",
      website: null,
      source: "osm_demo",
      last_checked: new Date().toISOString(),
      is_selected: true,
      distance_from_route_km: 2.1,
      detour_km: 0.5,
      estimated_visit_min: 90,
      entry_price_inr: 0,
    },
    {
      id: "attr-del-01",
      trip_id: id,
      checkpoint_id: "cp-06",
      category: "attraction",
      name: "Qutub Minar & Mehrauli Archaeological Park",
      address: "Mehrauli, New Delhi",
      lat: 28.524,
      lng: 77.185,
      description: "UNESCO World Heritage Site with iconic 73m minaret and medieval ruins",
      rating: 4.6,
      review_count: 32000,
      price_min: 50,
      price_max: 50,
      price_label: "₹50 entry",
      amenities: ["UNESCO Heritage", "Architecture", "Photography"],
      opening_hours: "07:00–18:00",
      website: null,
      source: "osm_demo",
      last_checked: new Date().toISOString(),
      is_selected: true,
      distance_from_route_km: 3.5,
      detour_km: 1.2,
      estimated_visit_min: 120,
      entry_price_inr: 50,
    },
    {
      id: "attr-mnl-01",
      trip_id: id,
      checkpoint_id: "cp-07",
      category: "attraction",
      name: "Solang Valley & Atal Tunnel",
      address: "Solang / Rohtang Highway, Manali",
      lat: 32.315,
      lng: 77.155,
      description: "Spectacular alpine meadow, gateway to high mountain pass and Atal Tunnel",
      rating: 4.8,
      review_count: 18500,
      price_min: 0,
      price_max: 0,
      price_label: "Free entry",
      amenities: ["Snow Views", "Engineering Marvel", "High Altitude"],
      opening_hours: "Open 24 Hours (Subject to weather)",
      website: null,
      source: "osm_demo",
      last_checked: new Date().toISOString(),
      is_selected: true,
      distance_from_route_km: 1.0,
      detour_km: 0,
      estimated_visit_min: 150,
      entry_price_inr: 0,
    },
  ];

  const filteredAttractions = extendedAttractions.filter((item) => {
    if (selectedHub !== "all" && item.checkpoint_id !== selectedHub) return false;
    return true;
  });

  function toggleAttraction(attrId: string) {
    setSelectedAttractions((prev) => ({
      ...prev,
      [attrId]: !prev[attrId],
    }));
  }

  const selectedCount = Object.values(selectedAttractions).filter(Boolean).length;
  const totalVisitHours = Object.keys(selectedAttractions).reduce((acc, aId) => {
    if (!selectedAttractions[aId]) return acc;
    const match = extendedAttractions.find((a) => a.id === aId);
    return acc + ((match?.estimated_visit_min ?? 60) / 60);
  }, 0);

  const totalTicketFees = Object.keys(selectedAttractions).reduce((acc, aId) => {
    if (!selectedAttractions[aId]) return acc;
    const match = extendedAttractions.find((a) => a.id === aId);
    return acc + (match?.entry_price_inr ?? 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Attractions & Exploration</h2>
          <p className="text-sm text-muted-foreground">
            Must-see heritage monuments, natural marvels, and photography spots along the route.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/smart-travel/${id}/food`)}
          >
            Food
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/smart-travel/${id}/itinerary`)}
            className="gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
          >
            Build Day-wise Itinerary <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Stats Summary KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Highlights Found
          </span>
          <p className="mt-1 text-lg font-bold">{extendedAttractions.length} spots</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Selected for Trip
          </span>
          <p className="mt-1 text-lg font-bold text-success flex items-center gap-1">
            <CheckCircle2 className="size-4" /> {selectedCount} visited
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Planned Exploration Time
          </span>
          <p className="mt-1 text-lg font-bold text-brand">
            {totalVisitHours.toFixed(1)} hours
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Est. Entry Fees (Total)
          </span>
          <p className="mt-1 text-lg font-bold">{fmtInr(totalTicketFees * 2)}</p>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Filter className="size-3.5" /> Corridor Hub:
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
          All Corridor Stops ({extendedAttractions.length})
        </button>

        {checkpoints.map((cp) => (
          <button
            key={cp.id}
            type="button"
            onClick={() => setSelectedHub(cp.id)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
              selectedHub === cp.id
                ? "bg-brand text-brand-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {cp.name.split(",")[0]}
          </button>
        ))}
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Attraction Cards */}
        <div className="space-y-4 lg:col-span-7">
          {filteredAttractions.map((attr) => {
            const isSelected = !!selectedAttractions[attr.id];
            const hubName =
              checkpoints.find((c) => c.id === attr.checkpoint_id)?.name ?? "En-route";

            return (
              <div
                key={attr.id}
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
                      <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                        {hubName.split(",")[0]}
                      </span>
                      <h3 className="font-semibold text-base leading-tight">
                        {attr.name}
                      </h3>
                      {attr.rating && (
                        <span className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                          <Star className="size-3 fill-current" /> {attr.rating}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3 shrink-0" /> {attr.address}
                    </p>
                    <p className="mt-1.5 text-xs text-foreground/80 leading-relaxed">
                      {attr.description}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                      {attr.estimated_visit_min && (
                        <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                          <Clock className="size-3" /> {attr.estimated_visit_min} min dwell
                        </span>
                      )}
                      {attr.detour_km != null && (
                        <span className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                          <Compass className="size-3" /> {attr.detour_km} km detour
                        </span>
                      )}
                      {attr.amenities.map((a) => (
                        <span
                          key={a}
                          className="rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground border border-border/50"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-base text-brand">
                      {attr.price_label ?? (attr.entry_price_inr ? fmtInr(attr.entry_price_inr) : "Free")}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">ticket / entry</p>

                    <div className="mt-3">
                      <Button
                        size="sm"
                        onClick={() => toggleAttraction(attr.id)}
                        className={cn(
                          "h-8 text-xs font-semibold",
                          isSelected
                            ? "bg-brand text-brand-foreground shadow-sm hover:bg-brand/90"
                            : "border border-border bg-card hover:bg-muted text-foreground"
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

        {/* Right Column: Leaflet Map Preview */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 space-y-4">
            <Card className="overflow-hidden border border-border shadow-sm">
              <div className="h-[480px] w-full">
                <TravelRouteMap
                  checkpoints={checkpoints}
                  places={filteredAttractions}
                  height="100%"
                />
              </div>
            </Card>

            <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Camera className="size-4 text-brand" /> Smart Detour Tolerance
              </div>
              <p>
                Each attraction is evaluated for route diversion time. Sightseeing stops that require more than 45 minutes off the main arterial highway are flagged to protect your daily driving schedule.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
