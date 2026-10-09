"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, MapPin, Calendar, Users, ArrowRight, Plane } from "lucide-react";
import { listTrips, type TravelTrip } from "@/lib/api/travel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";

function TripCard({ trip }: { trip: TravelTrip }) {
  const statusColor: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    planned: "bg-info-soft text-info",
    active: "bg-success-soft text-success",
    completed: "bg-violet-soft text-violet",
    archived: "bg-muted text-muted-foreground",
  };

  return (
    <Card className="group hover:shadow-[var(--shadow-pop)] transition-all duration-200">
      <CardContent className="p-0">
        {/* Banner */}
        <div className="relative h-28 overflow-hidden rounded-t-[var(--radius-card)] bg-gradient-to-br from-[#1a2a3a] via-[#0f2a1c] to-[#2a1a0c] flex items-center px-5">
          <div className="absolute inset-0 opacity-20">
            <svg viewBox="0 0 400 112" className="w-full h-full" fill="#ffc629">
              <path d="M0 112V80L30 60 60 80 90 50 120 70 150 30 180 60 210 20 240 50 270 30 300 60 330 40 360 70 400 50V112Z" opacity="0.5"/>
              <path d="M0 112V90L40 75 80 85 120 65 160 80 200 55 240 70 280 45 320 65 360 50 400 70V112Z" opacity="0.4"/>
            </svg>
          </div>
          <div className="relative">
            <div className="text-xl font-bold text-white">{trip.origin_name.split(",")[0]}</div>
            <div className="flex items-center gap-2 text-white/60 text-sm mt-0.5">
              <ArrowRight className="size-3.5" />
              <span>{trip.destination_name.split(",")[0]}</span>
            </div>
          </div>
          <div className="ml-auto relative">
            <Plane className="size-10 text-brand opacity-80 -rotate-12" />
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold leading-tight">{trip.name}</h3>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="size-3.5" />
                {trip.origin_name} → {trip.destination_name}
              </p>
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusColor[trip.status] ?? "bg-muted text-muted-foreground"}`}>
              {trip.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {trip.departure_date && (
              <span className="flex items-center gap-1"><Calendar className="size-3" />{trip.departure_date}</span>
            )}
            <span className="flex items-center gap-1"><Users className="size-3" />{trip.adults} adults{trip.children ? `, ${trip.children} children` : ""}</span>
            <span className="capitalize">{trip.travel_mode}</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Link
              href={`/smart-travel/${trip.id}/routes`}
              className="text-sm font-semibold text-brand hover:underline flex items-center gap-1"
            >
              View trip <ArrowRight className="size-3.5" />
            </Link>
            <Link href={`/smart-travel/${trip.id}/itinerary`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View itinerary
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SmartTravelPage() {
  const { data: trips, isLoading, error } = useQuery({
    queryKey: ["travel-trips"],
    queryFn: listTrips,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart Travel"
        description="Plan your next road trip — personalised routes, stays, food and budget."
        actions={
          <Button variant="primary" asChild>
            <Link href="/smart-travel/new"><Plus className="size-4" /> New Trip</Link>
          </Button>
        }
      />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-56 rounded-[var(--radius-card)]" />)}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          Failed to load trips. Please try again.
        </div>
      )}

      {!isLoading && trips?.length === 0 && (
        <EmptyState
          icon={<Plane className="size-10 text-brand" />}
          title="No trips yet"
          description="Create your first smart travel trip to get started with personalised route planning."
          action={
            <Button variant="primary" asChild>
              <Link href="/smart-travel/new"><Plus className="size-4" /> Plan your first trip</Link>
            </Button>
          }
        />
      )}

      {!isLoading && trips && trips.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map(trip => <TripCard key={trip.id} trip={trip} />)}
        </div>
      )}
    </div>
  );
}
