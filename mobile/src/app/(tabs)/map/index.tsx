/**
 * Map tab — shows the stop locations of a selected optimization run.
 *
 * Replaces the design-system agent's placeholder (src/components/ui's EmptyState/
 * ScreenHeader) with the real screen, owned by this agent per docs/MOBILE.md file
 * ownership #4. Reuses src/components/ui primitives now that they exist.
 *
 * IMPORTANT / scope note: this screen's only in-scope data sources are the ones this
 * agent owns (src/lib/api/optimization.ts, src/lib/api/analytics.ts). The backend's
 * OptimizationResult/QuantumResult schemas (backend/app/schemas/optimization.py) do NOT
 * include a `geometry` field anywhere — road route geometry only exists on
 * /routing/route and /travel/{id}/route-options, both owned by other agents (logistics
 * and Smart Travel groups respectively). So "real route geometry" is not something this
 * screen can show without reaching outside its ownership. Per docs/MOBILE.md's hard
 * rule ("Never draw a route as a straight line"), this screen deliberately does NOT draw
 * a polyline between stops — that would just be straight lines dressed up as a route.
 * Instead it plots real markers (origin + stops, numbered in visit order where known)
 * from the run's stored request/result, and says plainly that route geometry isn't
 * available here. See the in-app note for the exact wording shown to the user.
 */
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Compass, Crosshair, Flag, Info, Map as MapIcon, Maximize2 } from "lucide-react-native";

import { EmptyState, ErrorState, RouteZenMap, ScreenHeader, type RouteZenMapRef } from "../../../components/ui";
import { listRuns, type OptStop, type QuantumResult, type OptimizationResult, type RunRecord } from "../../../lib/api/optimization";
import { ApiError } from "../../../lib/api/client";

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const CHENNAI_REGION: Region = { latitude: 13.0827, longitude: 80.2707, latitudeDelta: 0.35, longitudeDelta: 0.35 };

interface MapPoint {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  kind: "depot" | "stop";
  sequence: number | null;
}

/** Visit order from a classical/hybrid result (first vehicle route) or a quantum/annealing result's `order`. */
function visitOrder(run: RunRecord): string[] {
  const result = run.result as OptimizationResult | QuantumResult | null;
  if (!result) return [];
  if ("routes" in result && Array.isArray(result.routes)) {
    return result.routes.flatMap((r) => r.stops.map((s) => s.stop_id));
  }
  if ("order" in result && Array.isArray(result.order)) return result.order;
  return [];
}

function extractPoints(run: RunRecord): { points: MapPoint[]; depotMissing: boolean } {
  const req = run.request as { depot?: { latitude: number; longitude: number; name?: string } | null; stops?: OptStop[] };
  const order = visitOrder(run);
  const stops = (req.stops ?? []).filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));
  const points: MapPoint[] = stops.map((s) => ({
    id: s.id,
    label: s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    kind: "stop",
    sequence: order.length ? order.indexOf(s.id) + 1 || null : null,
  }));
  const depot = req.depot;
  const depotMissing = !depot || !Number.isFinite(depot.latitude) || !Number.isFinite(depot.longitude);
  if (depot && !depotMissing) {
    points.unshift({ id: "depot", label: depot.name ?? "Depot", latitude: depot.latitude, longitude: depot.longitude, kind: "depot", sequence: null });
  }
  return { points, depotMissing };
}

const KIND_LABEL: Record<string, string> = { classical: "Classical", quantum: "Quantum (sim)", annealing: "Annealing", hybrid: "Hybrid" };

export default function MapTab() {
  const mapRef = useRef<RouteZenMapRef>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const runsQuery = useQuery({
    queryKey: ["optimization", "runs", "succeeded-for-map"],
    queryFn: () => listRuns({ status: "succeeded", limit: 20 }),
    staleTime: 15_000,
  });

  const runsData = runsQuery.data?.items;
  const runs = useMemo(() => runsData ?? [], [runsData]);
  const selectedRun = useMemo(() => runs.find((r) => r.id === selectedId) ?? runs[0] ?? null, [runs, selectedId]);
  const { points, depotMissing } = useMemo(() => (selectedRun ? extractPoints(selectedRun) : { points: [], depotMissing: false }), [selectedRun]);

  function fitToStops() {
    if (points.length === 0) return;
    if (points.length === 1) {
      mapRef.current?.animateToRegion({ latitude: points[0].latitude, longitude: points[0].longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 });
      return;
    }
    mapRef.current?.fitToCoordinates(
      points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    );
  }

  async function recenterToMyLocation() {
    setLocationNote(null);
    Alert.alert(
      "Use your location?",
      "RouteZen will center the map on your current position. Your location is only requested when you tap this button and is never sent to the backend.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Use location",
          onPress: async () => {
            setLocating(true);
            try {
              const Location = await import("expo-location");
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== "granted") {
                setLocationNote("Location permission was not granted, so the map can't be recentered on your position.");
                return;
              }
              const pos = await Location.getCurrentPositionAsync({});
              mapRef.current?.animateToRegion({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              });
            } catch (err) {
              setLocationNote(err instanceof Error ? `Could not get your location: ${err.message}` : "Could not get your location.");
            } finally {
              setLocating(false);
            }
          },
        },
      ],
    );
  }

  const loadError = runsQuery.isError
    ? runsQuery.error instanceof ApiError
      ? runsQuery.error.message
      : "Could not load optimization runs."
    : null;

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Map" subtitle="Stop locations from an optimization run" />

      {runsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0E4429" />
        </View>
      ) : loadError ? (
        <ErrorState description={loadError} onRetry={() => runsQuery.refetch()} />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={<MapIcon size={28} color="#5B6B60" />}
          title="No optimization run available yet"
          description="Run a classical or quantum experiment in the Quantum Optimization Lab, then come back here to see its stops on the map."
          actionLabel="Open Quantum Lab"
          onAction={() => router.push("/lab")}
        />
      ) : (
        <>
          <View style={{ height: 44, backgroundColor: "#FFFFFF" }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, alignItems: "center", gap: 8 }}>
              {runs.map((r) => {
                const active = selectedRun?.id === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setSelectedId(r.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? "#0E4429" : "#E4E8E1",
                      backgroundColor: active ? "#0E4429" : "#F4F6F3",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "500", color: active ? "#FFFFFF" : "#0E1A14" }}>
                      {KIND_LABEL[r.kind] ?? r.kind} · {new Date(r.created_at).toLocaleDateString()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View className="flex-row items-start gap-2 bg-info/10 px-4 py-2">
            <Info size={14} color="#1D5FB3" style={{ marginTop: 2 }} />
            <Text className="flex-1 text-xs text-ink-muted">
              /optimization endpoints don&apos;t return road route geometry (no `geometry` field in the result schema), so no route line is
              drawn here — only stop markers, numbered by visit order where the solver reports one. A straight line between stops would
              misrepresent the real road route, so none is shown.
            </Text>
          </View>

          {depotMissing && selectedRun && (
            <View className="flex-row items-center gap-2 bg-warning/10 px-4 py-2">
              <AlertTriangle size={14} color="#B3791A" />
              <Text className="flex-1 text-xs text-ink-muted">
                This run&apos;s depot coordinates aren&apos;t in the stored run record (it was likely started with a depot_location_id
                rather than inline coordinates). Showing stops only.
              </Text>
            </View>
          )}

          <View className="flex-1">
            {points.length === 0 ? (
              <EmptyState icon={<MapIcon size={28} color="#5B6B60" />} title="No usable coordinates" description="This run has no usable stop coordinates to plot." />
            ) : (
              <RouteZenMap
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={CHENNAI_REGION}
                onMapReady={fitToStops}
                markers={points.map((p) => ({
                  id: p.id,
                  latitude: p.latitude,
                  longitude: p.longitude,
                  title: p.kind === "depot" ? `Depot — ${p.label}` : p.sequence ? `${p.sequence}. ${p.label}` : p.label,
                  color: p.kind === "depot" ? "#0E4429" : "#F4C430",
                }))}
              />
            )}

            <View className="absolute bottom-4 right-4 gap-2">
              <Pressable onPress={fitToStops} className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow" accessibilityLabel="Fit to stops">
                <Maximize2 size={18} color="#0E1A14" />
              </Pressable>
              <Pressable
                onPress={recenterToMyLocation}
                disabled={locating}
                className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow"
                accessibilityLabel="Recenter on my location"
              >
                {locating ? <ActivityIndicator size="small" color="#0E1A14" /> : <Crosshair size={18} color="#0E1A14" />}
              </Pressable>
            </View>

            {selectedRun && (
              <View className="absolute left-4 right-20 top-3 flex-row items-center gap-2 rounded-card bg-surface/95 px-3 py-2 shadow">
                <Compass size={14} color="#1B6B3F" />
                <Text className="flex-1 text-xs text-ink-muted" numberOfLines={1}>
                  Run {selectedRun.id.slice(0, 8)} · {points.length} point{points.length === 1 ? "" : "s"}
                </Text>
              </View>
            )}
          </View>

          {locationNote && (
            <View className="flex-row items-center gap-2 border-t border-border bg-muted px-4 py-2">
              <Flag size={14} color="#B3791A" />
              <Text className="flex-1 text-xs text-ink-muted">{locationNote}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}
