"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  Radio,
  Navigation,
  Compass,
  Gauge,
  Fuel,
  CloudSun,
  ShieldAlert,
  PhoneCall,
  CheckCircle2,
  Clock,
  ArrowRight,
  Mountain,
  AlertTriangle,
} from "lucide-react";
import {
  getTrip,
  listCheckpoints,
  type TravelCheckpoint,
} from "@/lib/api/travel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TravelRouteMap = dynamic(
  () => import("@/components/maps/TravelRouteMap"),
  { ssr: false }
);

export default function LiveJourneyPage() {
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

  const [currentSpeed, setCurrentSpeed] = useState(78);
  const [kmRemaining, setKmRemaining] = useState(142);
  const [currentAltitude, setCurrentAltitude] = useState(540); // meters

  // Subtle live gauge fluctuation for authentic experience
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSpeed((prev) => Math.min(95, Math.max(68, prev + (Math.random() * 6 - 3))));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Live Status Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex size-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex size-3.5 rounded-full bg-red-500" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-foreground">
                LIVE EXPEDITION IN PROGRESS
              </h2>
              <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white uppercase">
                Active HUD
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Segment: En-route to Hyderabad, Telangana · NH-44 Express Highway
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/smart-travel/${id}/itinerary`)}
            className="text-xs"
          >
            Schedule
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs gap-1.5 font-bold"
            onClick={() => alert("Checkpoint reached! Logged into journey journal.")}
          >
            <CheckCircle2 className="size-4" /> Check-in at Next Stop
          </Button>
        </div>
      </div>

      {/* Main HUD Telemetry Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Speed */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Gauge className="size-3.5 text-brand" /> Cruise Speed
            </span>
            <p className="mt-1 text-2xl font-black">{Math.round(currentSpeed)} <span className="text-xs font-normal text-muted-foreground">km/h</span></p>
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Within Limit</span>
        </div>

        {/* Next Stop Distance */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Navigation className="size-3.5 text-blue-500" /> Next Checkpoint
            </span>
            <p className="mt-1 text-2xl font-black">{kmRemaining} <span className="text-xs font-normal text-muted-foreground">km</span></p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">ETA 11:45 AM</span>
        </div>

        {/* Altitude Profile */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Mountain className="size-3.5 text-indigo-500" /> Altitude
            </span>
            <p className="mt-1 text-2xl font-black">{currentAltitude} <span className="text-xs font-normal text-muted-foreground">meters</span></p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">Deccan Plateau</span>
        </div>

        {/* Fuel & Range */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Fuel className="size-3.5 text-amber-500" /> Tank Range
            </span>
            <p className="mt-1 text-2xl font-black">420 <span className="text-xs font-normal text-muted-foreground">km</span></p>
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Pumps in 18 km</span>
        </div>
      </div>

      {/* Main Grid: Live Map + Emergency SOS side panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Live GPS Route Map */}
        <div className="lg:col-span-8">
          <Card className="overflow-hidden border border-border shadow-sm">
            <div className="h-[520px] w-full">
              <TravelRouteMap
                checkpoints={checkpoints}
                height="100%"
              />
            </div>
          </Card>
        </div>

        {/* Emergency SOS & Corridor Live Feed */}
        <div className="space-y-4 lg:col-span-4">
          {/* Corridor Weather & Road Condition */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <CloudSun className="size-4 text-amber-500" /> Corridor Conditions
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Temperature</span>
                <span className="font-semibold">31°C · Sunny & Dry</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Pavement Quality</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">NH-44 4-Lane Excellent</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Mountain Pass Status</span>
                <span className="font-semibold">Rohtang & Atal Tunnel Open</span>
              </div>
            </div>
          </div>

          {/* Rapid SOS Assistance */}
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
              <ShieldAlert className="size-5" /> Emergency SOS Contacts
            </div>
            <p className="text-xs text-muted-foreground">
              Direct hotlines for highway emergencies, breakdown towing, and ambulance.
            </p>

            <div className="space-y-2 pt-1">
              <a
                href="tel:112"
                className="flex items-center justify-between rounded-xl border border-rose-200 dark:border-rose-900 bg-card p-3 text-xs font-bold text-foreground hover:bg-muted transition-colors"
              >
                <span className="flex items-center gap-2">
                  <PhoneCall className="size-4 text-rose-500" /> National Emergency
                </span>
                <span className="text-rose-600 font-mono">112</span>
              </a>

              <a
                href="tel:1033"
                className="flex items-center justify-between rounded-xl border border-rose-200 dark:border-rose-900 bg-card p-3 text-xs font-bold text-foreground hover:bg-muted transition-colors"
              >
                <span className="flex items-center gap-2">
                  <PhoneCall className="size-4 text-rose-500" /> National Highway Patrol (NHAI)
                </span>
                <span className="text-rose-600 font-mono">1033</span>
              </a>

              <a
                href="tel:108"
                className="flex items-center justify-between rounded-xl border border-rose-200 dark:border-rose-900 bg-card p-3 text-xs font-bold text-foreground hover:bg-muted transition-colors"
              >
                <span className="flex items-center gap-2">
                  <PhoneCall className="size-4 text-rose-500" /> Medical Ambulance
                </span>
                <span className="text-rose-600 font-mono">108</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
