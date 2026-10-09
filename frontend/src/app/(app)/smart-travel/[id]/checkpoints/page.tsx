"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  MapPin,
  ArrowUp,
  ArrowDown,
  Moon,
  Plus,
  Trash2,
  ChevronRight,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Eye,
} from "lucide-react";
import {
  listCheckpoints,
  type TravelCheckpoint,
} from "@/lib/api/travel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Switch } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TravelRouteMap = dynamic(
  () => import("@/components/maps/TravelRouteMap"),
  { ssr: false }
);

function fmtHours(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function CheckpointsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: initialCheckpoints, isLoading } = useQuery({
    queryKey: ["travel-checkpoints", id],
    queryFn: () => listCheckpoints(id),
  });

  const [checkpoints, setCheckpoints] = useState<TravelCheckpoint[]>([]);
  const [selectedCpId, setSelectedCpId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCityName, setNewCityName] = useState("");
  const [newCityIsOvernight, setNewCityIsOvernight] = useState(true);

  // Sync state once query resolves
  if (initialCheckpoints && checkpoints.length === 0 && !isLoading) {
    setCheckpoints(initialCheckpoints);
  }

  const activeList = checkpoints.length > 0 ? checkpoints : (initialCheckpoints ?? []);

  function handleMoveUp(index: number) {
    if (index <= 1 || index >= activeList.length - 1) return; // cannot move origin or destination
    const next = [...activeList];
    const temp = next[index];
    next[index] = next[index - 1];
    next[index - 1] = temp;
    // update sequences
    next.forEach((cp, i) => (cp.sequence = i));
    setCheckpoints(next);
  }

  function handleMoveDown(index: number) {
    if (index === 0 || index >= activeList.length - 2) return; // cannot move destination
    const next = [...activeList];
    const temp = next[index];
    next[index] = next[index + 1];
    next[index + 1] = temp;
    next.forEach((cp, i) => (cp.sequence = i));
    setCheckpoints(next);
  }

  function handleToggleOvernight(idToToggle: string) {
    setCheckpoints((prev) =>
      prev.map((cp) =>
        cp.id === idToToggle ? { ...cp, stay_overnight: !cp.stay_overnight } : cp
      )
    );
  }

  function handleToggleMandatory(idToToggle: string) {
    setCheckpoints((prev) =>
      prev.map((cp) => {
        if (cp.id !== idToToggle) return cp;
        const nextMandatory = !cp.is_mandatory;
        return {
          ...cp,
          is_mandatory: nextMandatory,
          type: nextMandatory ? "mandatory" : "optional",
        };
      })
    );
  }

  function handleDeleteCheckpoint(idToDelete: string) {
    setCheckpoints((prev) => prev.filter((cp) => cp.id !== idToDelete));
  }

  function handleAddCheckpoint() {
    if (!newCityName.trim()) return;
    const newCp: TravelCheckpoint = {
      id: `cp-custom-${Date.now()}`,
      trip_id: id,
      sequence: activeList.length - 1,
      name: newCityName.trim(),
      address: newCityName.trim(),
      lat: 23.5, // approximate center
      lng: 78.5,
      type: "optional",
      is_mandatory: false,
      stay_overnight: newCityIsOvernight,
      planned_arrival: null,
      planned_departure: null,
      activity_duration_min: 60,
      notes: "Custom waypoint added by traveller",
      distance_from_prev_km: 250,
      duration_from_prev_min: 210,
    };

    // Insert just before destination
    const updated = [...activeList];
    updated.splice(updated.length - 1, 0, newCp);
    updated.forEach((cp, i) => (cp.sequence = i));
    setCheckpoints(updated);
    setNewCityName("");
    setShowAddModal(false);
  }

  const totalDistance = activeList.reduce(
    (acc, c) => acc + (c.distance_from_prev_km ?? 0),
    0
  );
  const totalOvernights = activeList.filter((c) => c.stay_overnight).length;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Checkpoint Management</h2>
          <p className="text-sm text-muted-foreground">
            Review stops along your route corridor, set overnight stays, or reorder waypoints.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="gap-1.5"
          >
            <Plus className="size-4" /> Add Checkpoint
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/smart-travel/${id}/stays`)}
            className="gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
          >
            Continue to Stays <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Stats summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Total Stops
          </span>
          <p className="mt-1 text-lg font-bold">{activeList.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Overnight Stays
          </span>
          <p className="mt-1 text-lg font-bold text-brand">{totalOvernights} nights</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Corridor Distance
          </span>
          <p className="mt-1 text-lg font-bold">
            {totalDistance.toLocaleString("en-IN")} km
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Driving Pace
          </span>
          <p className="mt-1 text-lg font-bold text-success flex items-center gap-1">
            <ShieldCheck className="size-4" /> Balanced
          </p>
        </div>
      </div>

      {/* Main split view: Checkpoint list on left, map on right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Checkpoint sequence */}
        <div className="space-y-3 lg:col-span-7">
          {isLoading && checkpoints.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            activeList.map((cp, idx) => {
              const isOrigin = idx === 0;
              const isDestination = idx === activeList.length - 1;
              const isSelected = selectedCpId === cp.id;

              return (
                <div
                  key={cp.id}
                  onClick={() => setSelectedCpId(cp.id)}
                  className={cn(
                    "group relative rounded-2xl border p-4 transition-all cursor-pointer",
                    isSelected
                      ? "border-brand bg-brand-soft/30 shadow-md ring-1 ring-brand"
                      : "border-border bg-card hover:border-border/80 hover:bg-card/90"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Step index badge */}
                      <div
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-xl font-bold text-xs shadow-sm",
                          isOrigin
                            ? "bg-success text-white"
                            : isDestination
                            ? "bg-danger text-white"
                            : cp.is_mandatory
                            ? "bg-brand text-brand-foreground"
                            : "bg-muted text-foreground border border-border"
                        )}
                      >
                        {isOrigin ? "S" : isDestination ? "E" : idx}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-base leading-tight">
                            {cp.name}
                          </h3>
                          {isOrigin && (
                            <span className="rounded-md bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success uppercase">
                              Origin
                            </span>
                          )}
                          {isDestination && (
                            <span className="rounded-md bg-danger/15 px-2 py-0.5 text-[11px] font-bold text-danger uppercase">
                              Destination
                            </span>
                          )}
                          {!isOrigin && !isDestination && cp.is_mandatory && (
                            <span className="rounded-md bg-brand/20 px-2 py-0.5 text-[11px] font-semibold text-brand-foreground">
                              Mandatory Stop
                            </span>
                          )}
                          {!isOrigin && !isDestination && !cp.is_mandatory && (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border">
                              Optional Stop
                            </span>
                          )}
                          {cp.stay_overnight && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">
                              <Moon className="size-3" /> Overnight
                            </span>
                          )}
                        </div>

                        {/* Distance & driving stats from prev stop */}
                        {cp.distance_from_prev_km != null && (
                          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              📍 {cp.distance_from_prev_km} km from prev stop
                            </span>
                            {cp.duration_from_prev_min != null && (
                              <span>
                                ⏱️ {fmtHours(cp.duration_from_prev_min)} drive
                              </span>
                            )}
                            {cp.activity_duration_min > 0 && (
                              <span>
                                ⏳ {fmtHours(cp.activity_duration_min)} visit
                              </span>
                            )}
                          </div>
                        )}

                        {cp.notes && (
                          <p className="mt-1.5 text-xs text-muted-foreground/90 italic">
                            “{cp.notes}”
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right side controls */}
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/smart-travel/${id}/checkpoints/${cp.id}`}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Explore Checkpoint Details"
                      >
                        <Eye className="size-4" />
                      </Link>

                      {!isOrigin && !isDestination && (
                        <>
                          <button
                            type="button"
                            disabled={idx <= 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveUp(idx);
                            }}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
                            title="Move Stop Up"
                          >
                            <ArrowUp className="size-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx >= activeList.length - 2}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveDown(idx);
                            }}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
                            title="Move Stop Down"
                          >
                            <ArrowDown className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCheckpoint(cp.id);
                            }}
                            className="rounded-lg p-1.5 text-danger/80 hover:bg-danger/10 hover:text-danger transition-colors"
                            title="Remove Stop"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Toggle switches row for intermediate stops */}
                  {!isOrigin && !isDestination && (
                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                          <input
                            type="checkbox"
                            checked={cp.stay_overnight}
                            onChange={() => handleToggleOvernight(cp.id)}
                            className="rounded border-border accent-brand"
                          />
                          <span>Overnight stay</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                          <input
                            type="checkbox"
                            checked={cp.is_mandatory}
                            onChange={() => handleToggleMandatory(cp.id)}
                            className="rounded border-border accent-brand"
                          />
                          <span>Mandatory stop</span>
                        </label>
                      </div>

                      <Link
                        href={`/smart-travel/${id}/checkpoints/${cp.id}`}
                        className="text-brand font-medium hover:underline inline-flex items-center gap-1"
                      >
                        Explore Stays & Food <ChevronRight className="size-3" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Interactive Map preview */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 space-y-4">
            <Card className="overflow-hidden border border-border shadow-sm">
              <div className="h-[480px] w-full">
                <TravelRouteMap
                  checkpoints={activeList}
                  selectedCheckpointId={selectedCpId ?? undefined}
                  height="100%"
                />
              </div>
            </Card>

            <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Info className="size-4 text-brand" /> Smart Checkpoint Tip
              </div>
              <p>
                Click on any checkpoint card to highlight it on the map or click the eye icon to view curated stays, restaurants, and attractions discovered for that area.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Checkpoint Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold">Add Stop Along Corridor</h3>
            <p className="text-xs text-muted-foreground">
              Enter the city or point of interest name. We will place it along the route before the destination.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold">City or Landmark Name</label>
                <Input
                  placeholder="e.g. Agra, Uttar Pradesh"
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <span className="text-sm font-medium">Plan overnight stay here</span>
                <input
                  type="checkbox"
                  checked={newCityIsOvernight}
                  onChange={(e) => setNewCityIsOvernight(e.target.checked)}
                  className="size-4 accent-brand cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddCheckpoint}
                className="bg-brand text-brand-foreground hover:bg-brand/90"
              >
                Add Stop
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
