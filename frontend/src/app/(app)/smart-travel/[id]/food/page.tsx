"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  UtensilsCrossed,
  Star,
  MapPin,
  CheckCircle2,
  ChevronRight,
  Filter,
  Clock,
  Sparkles,
  Coffee,
  Heart,
  AlertCircle,
} from "lucide-react";
import {
  listRestaurants,
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

export default function FoodPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [dietFilter, setDietFilter] = useState<string>("all");
  const [selectedHub, setSelectedHub] = useState<string>("all");
  const [addedPlaces, setAddedPlaces] = useState<Record<string, boolean>>({
    "rest-01": true,
  });

  const { data: checkpoints = [] } = useQuery({
    queryKey: ["travel-checkpoints", id],
    queryFn: () => listCheckpoints(id),
  });

  const { data: rawRestaurants = [] } = useQuery({
    queryKey: ["travel-restaurants", id],
    queryFn: () => listRestaurants(id),
  });

  // Extended culinary stops across the corridor
  const extendedFood: TravelPlace[] = [
    ...rawRestaurants,
    {
      id: "food-vjw-01",
      trip_id: id,
      checkpoint_id: "cp-02",
      category: "restaurant",
      name: "Crossroads Andhra Mess",
      address: "Governorpet, Vijayawada",
      lat: 16.51,
      lng: 80.63,
      description: "Authentic spicy Andhra thali, Gongura pachadi & curd rice",
      rating: 4.5,
      review_count: 1420,
      price_min: 250,
      price_max: 400,
      price_label: "₹250–400 per person",
      amenities: ["Pure Vegetarian", "Unlimited Thali", "Quick Service"],
      opening_hours: "11:30–16:00, 19:00–22:30",
      website: null,
      source: "osm_demo",
      last_checked: new Date().toISOString(),
      is_selected: true,
      distance_from_route_km: 1.5,
      detour_km: 0,
      estimated_visit_min: 50,
      entry_price_inr: null,
    },
    {
      id: "food-ngp-01",
      trip_id: id,
      checkpoint_id: "cp-04",
      category: "restaurant",
      name: "Saoji Military Dhaba",
      address: "Outer Ring Road, Nagpur",
      lat: 21.12,
      lng: 79.11,
      description: "Legendary fiery Saoji cuisine & highway tandoori roti",
      rating: 4.3,
      review_count: 890,
      price_min: 300,
      price_max: 550,
      price_label: "₹350–550 per person",
      amenities: ["Spicy Specialties", "Highway Parking", "Family Seating"],
      opening_hours: "12:00–23:00",
      website: null,
      source: "osm_demo",
      last_checked: new Date().toISOString(),
      is_selected: false,
      distance_from_route_km: 0.8,
      detour_km: 0,
      estimated_visit_min: 60,
      entry_price_inr: null,
    },
    {
      id: "food-del-01",
      trip_id: id,
      checkpoint_id: "cp-06",
      category: "restaurant",
      name: "Murthal Haveli Dhaba",
      address: "GT Road / NH-44, Murthal",
      lat: 29.02,
      lng: 77.07,
      description: "Famous tandoori parathas with white makkhan & sweet lassi on NH-44",
      rating: 4.6,
      review_count: 8500,
      price_min: 200,
      price_max: 450,
      price_label: "₹250–450 per person",
      amenities: ["24x7 Open", "Huge Parking", "Clean Restrooms", "Pure Veg"],
      opening_hours: "Open 24 Hours",
      website: null,
      source: "osm_demo",
      last_checked: new Date().toISOString(),
      is_selected: true,
      distance_from_route_km: 0.2,
      detour_km: 0,
      estimated_visit_min: 45,
      entry_price_inr: null,
    },
  ];

  const filteredFood = extendedFood.filter((item) => {
    if (selectedHub !== "all" && item.checkpoint_id !== selectedHub) return false;
    if (dietFilter === "veg") {
      const isVeg = item.amenities.some(
        (a) => a.toLowerCase().includes("veg") && !a.toLowerCase().includes("non")
      );
      if (!isVeg) return false;
    }
    return true;
  });

  function toggleAdd(foodId: string) {
    setAddedPlaces((prev) => ({
      ...prev,
      [foodId]: !prev[foodId],
    }));
  }

  const addedCount = Object.values(addedPlaces).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Food & Culinary Stops</h2>
          <p className="text-sm text-muted-foreground">
            Regional gastronomic highlights and reliable highway pit-stops along your corridor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/smart-travel/${id}/stays`)}
          >
            Stays
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/smart-travel/${id}/attractions`)}
            className="gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
          >
            Continue to Attractions <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Stats KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Discovered Stops
          </span>
          <p className="mt-1 text-lg font-bold">{extendedFood.length} spots</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Added to Itinerary
          </span>
          <p className="mt-1 text-lg font-bold text-success flex items-center gap-1">
            <CheckCircle2 className="size-4" /> {addedCount} meals planned
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Avg Meal Cost
          </span>
          <p className="mt-1 text-lg font-bold text-brand">₹380 / person</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Dietary Preference
          </span>
          <p className="mt-1 text-lg font-bold text-foreground flex items-center gap-1">
            <Heart className="size-4 text-emerald-500" /> Veg & Regional
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Filter className="size-3.5" /> Dietary:
        </div>

        <button
          type="button"
          onClick={() => setDietFilter("all")}
          className={cn(
            "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
            dietFilter === "all"
              ? "bg-brand text-brand-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          All Flavours
        </button>
        <button
          type="button"
          onClick={() => setDietFilter("veg")}
          className={cn(
            "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
            dietFilter === "veg"
              ? "bg-brand text-brand-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          Pure Vegetarian 🌱
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Corridor Hub:</span>
          <select
            value={selectedHub}
            onChange={(e) => setSelectedHub(e.target.value)}
            className="rounded-xl border border-input bg-card px-2.5 py-1 text-xs text-foreground focus:outline-none"
          >
            <option value="all">All Locations</option>
            {checkpoints.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name.split(",")[0]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Split layout: Food cards + Map */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Food Cards */}
        <div className="space-y-4 lg:col-span-7">
          {filteredFood.map((rest) => {
            const isAdded = !!addedPlaces[rest.id];
            const hubName =
              checkpoints.find((c) => c.id === rest.checkpoint_id)?.name ?? "Corridor Rest Stop";

            return (
              <div
                key={rest.id}
                className={cn(
                  "rounded-2xl border p-4 transition-all bg-card shadow-sm",
                  isAdded
                    ? "border-brand ring-1 ring-brand bg-brand-soft/20"
                    : "border-border hover:border-border/80 hover:bg-card/90"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                        {hubName.split(",")[0]}
                      </span>
                      <h3 className="font-semibold text-base leading-tight">
                        {rest.name}
                      </h3>
                      {rest.rating && (
                        <span className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                          <Star className="size-3 fill-current" /> {rest.rating}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3 shrink-0" /> {rest.address}
                    </p>
                    <p className="mt-1.5 text-xs text-foreground/80 leading-relaxed">
                      {rest.description}
                    </p>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {rest.amenities.map((a) => (
                        <span
                          key={a}
                          className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border/50"
                        >
                          {a}
                        </span>
                      ))}
                      {rest.opening_hours && (
                        <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-400 flex items-center gap-1">
                          <Clock className="size-3" /> {rest.opening_hours}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-sm text-foreground">
                      {rest.price_label ?? "₹350/person"}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">typical meal</p>

                    <div className="mt-3">
                      <Button
                        size="sm"
                        onClick={() => toggleAdd(rest.id)}
                        className={cn(
                          "h-8 text-xs font-semibold",
                          isAdded
                            ? "bg-brand text-brand-foreground shadow-sm hover:bg-brand/90"
                            : "border border-border bg-card hover:bg-muted text-foreground"
                        )}
                      >
                        {isAdded ? (
                          <>
                            <CheckCircle2 className="size-3.5 mr-1" /> Added
                          </>
                        ) : (
                          "Add Stop"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Leaflet Map */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 space-y-4">
            <Card className="overflow-hidden border border-border shadow-sm">
              <div className="h-[480px] w-full">
                <TravelRouteMap
                  checkpoints={checkpoints}
                  places={filteredFood}
                  height="100%"
                />
              </div>
            </Card>

            <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Sparkles className="size-4 text-brand" /> Hygiene & Hygiene Rating Filter
              </div>
              <p>
                Highway dining recommendations are vetted for high turnover, pure bottled water availability, clean restrooms, and ample parking space.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
