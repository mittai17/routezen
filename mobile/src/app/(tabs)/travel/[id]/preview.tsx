import React, { useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { AlertTriangle, ChevronLeft, Crosshair, Flag, LocateFixed, LogOut } from "lucide-react-native";
import { ApiError, generateRouteOptions, listCheckpoints } from "../../../../lib/api/travel";
import { Button, ConfirmDialog, ErrorState, LoadingSkeleton, RouteZenMap, type RouteZenMapRef } from "../../../../components/ui";
import { fmtKm, fmtMin } from "../../../../components/travel/shared";

/**
 * Route Preview — explicitly NOT live turn-by-turn navigation.
 *
 * The backend has no live-tracking data source (no live traffic feed, no ETA
 * recalculation endpoint — verified against `backend/app/api/v1/travel.py`),
 * so this screen never claims to show live GPS speed, live traffic or
 * automatic turn-by-turn guidance. "Remaining distance/stops" is computed
 * purely from the saved route + checkpoint list and a progress marker the
 * traveller advances themselves ("Next stop reached"), not from a sensor.
 *
 * Device location IS used, but only on demand: tapping "Recenter" requests
 * foreground location permission (first tap only) and, if granted, shows a
 * one-shot "you are here" pin and centers the map on it. It is never
 * requested on mount, never polled/watched, and denial is handled
 * gracefully — the screen works fully without it (recenter just fits the
 * whole route instead).
 */
export default function RoutePreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = String(id);
  const mapRef = useRef<RouteZenMapRef>(null);

  const [currentIndex, setCurrentIndex] = useState(0); // TODO: replace with real progress if a live feed ever exists
  const [exitDialogVisible, setExitDialogVisible] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "error">("idle");

  const routesQuery = useQuery({ queryKey: ["route-options", tripId], queryFn: () => generateRouteOptions(tripId) });
  const checkpointsQuery = useQuery({ queryKey: ["travel-checkpoints", tripId], queryFn: () => listCheckpoints(tripId) });

  const route = useMemo(() => {
    const data = routesQuery.data;
    if (!data || data.length === 0) return null;
    return data.find((r) => r.is_selected) ?? data[0];
  }, [routesQuery.data]);

  const checkpoints = useMemo(() => [...(checkpointsQuery.data ?? [])].sort((a, b) => a.sequence - b.sequence), [checkpointsQuery.data]);

  const remaining = useMemo(() => {
    const stops = Math.max(0, checkpoints.length - 1 - currentIndex);
    if (checkpoints.length === 0) return { km: null, stops: 0 };

    const upcoming = checkpoints.slice(currentIndex + 1);
    const hasAnyLegDistances = upcoming.some((c) => c.distance_from_prev_km != null);

    if (hasAnyLegDistances) {
      const km = upcoming.reduce((sum, c) => sum + (c.distance_from_prev_km ?? 0), 0);
      return { km, stops };
    }

    if (currentIndex === 0) {
      return { km: route?.total_distance_km ?? null, stops };
    }

    return { km: null, stops };
  }, [checkpoints, currentIndex, route]);

  const hasRealGeometry = route && !route.fallback_estimate && route.geometry.length > 1;
  const coords = hasRealGeometry ? route!.geometry.map(([lat, lng]) => ({ latitude: lat, longitude: lng })) : [];

  function fitToRoute() {
    if (mapRef.current && coords.length > 1) {
      mapRef.current.fitToCoordinates(coords);
    }
  }

  /** On-demand only — never called on mount, never watched/polled. */
  async function recenter() {
    if (locationStatus === "denied") {
      fitToRoute();
      return;
    }
    try {
      setLocationStatus("requesting");
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationStatus(canAskAgain ? "idle" : "denied");
        fitToRoute();
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const here = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setUserCoords(here);
      setLocationStatus("granted");
      mapRef.current?.animateToRegion({ ...here, latitudeDelta: 0.1, longitudeDelta: 0.1 });
    } catch {
      setLocationStatus("error");
      fitToRoute();
    }
  }

  function confirmExit() {
    setExitDialogVisible(false);
    router.back();
  }

  const isLoading = routesQuery.isLoading || checkpointsQuery.isLoading;
  const isError = routesQuery.isError || checkpointsQuery.isError;

  return (
    <SafeAreaView className="flex-1 bg-ink" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => setExitDialogVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Exit route preview"
          className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
        >
          <ChevronLeft size={22} color="#FFFFFF" />
        </Pressable>
        <View className="items-center">
          <Text className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Route Preview</Text>
          <Text className="text-[10px] text-white/60">Not live turn-by-turn navigation</Text>
        </View>
        <Pressable
          onPress={() => setExitDialogVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Exit"
          className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
        >
          <LogOut size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSkeleton variant="text" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center p-6">
          <ErrorState
            description={
              routesQuery.error instanceof ApiError || checkpointsQuery.error instanceof ApiError
                ? (routesQuery.error as ApiError)?.message ?? (checkpointsQuery.error as ApiError)?.message
                : "Could not load the saved route."
            }
            onRetry={() => {
              routesQuery.refetch();
              checkpointsQuery.refetch();
            }}
          />
        </View>
      ) : !hasRealGeometry ? (
        <View className="flex-1 items-center justify-center gap-3 p-8">
          <AlertTriangle size={28} color="#F4C430" />
          <Text className="text-center text-base font-semibold text-white">No real road geometry to preview</Text>
          <Text className="text-center text-sm text-white/70">
            {route?.fallback_estimate
              ? "The routing service was unreachable when this route was generated, so only a straight-line distance estimate exists — not a real road route to preview."
              : "Generate route options for this trip first."}
          </Text>
          <Button label="Go to Route Options" variant="secondary" onPress={() => router.replace(`/travel/${tripId}/routes`)} />
        </View>
      ) : (
        <>
          <View className="flex-1">
            <RouteZenMap
              ref={mapRef}
              style={{ flex: 1 }}
              initialRegion={{
                latitude: coords[0].latitude,
                longitude: coords[0].longitude,
                latitudeDelta: 0.6,
                longitudeDelta: 0.6,
              }}
              onMapReady={fitToRoute}
              polyline={coords}
              polylineColor="#F4C430"
              fitToMarkers={false}
              markers={[
                ...checkpoints.map((cp, idx) => ({
                  id: cp.id,
                  latitude: cp.lat,
                  longitude: cp.lng,
                  title: `${cp.name} — ${idx <= currentIndex ? "Passed" : "Upcoming"}`,
                  color: idx <= currentIndex ? "#5B6B60" : idx === checkpoints.length - 1 ? "#B3261E" : "#1B6B3F",
                })),
                ...(userCoords
                  ? [{ id: "you-are-here", latitude: userCoords.latitude, longitude: userCoords.longitude, title: "You are here (one-shot fix, not live tracking)", color: "#1E90FF" }]
                  : []),
              ]}
            />

            <Pressable
              onPress={recenter}
              accessibilityRole="button"
              accessibilityLabel="Recenter map — uses your location if you allow it"
              disabled={locationStatus === "requesting"}
              className="absolute bottom-4 right-4 h-12 w-12 items-center justify-center rounded-full bg-white shadow-md active:bg-muted disabled:opacity-60"
            >
              {locationStatus === "granted" ? <LocateFixed size={20} color="#0E4429" /> : <Crosshair size={20} color="#0E4429" />}
            </Pressable>

            {locationStatus === "denied" || locationStatus === "error" ? (
              <View className="absolute left-4 right-16 top-3 rounded-lg bg-black/70 px-3 py-2">
                <Text className="text-[11px] text-white">
                  {locationStatus === "denied"
                    ? "Location permission denied — recenter shows the full route instead."
                    : "Couldn't get your location — showing the full route instead."}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Remaining distance / stops HUD — computed from the saved route & checkpoint list only */}
          <View className="gap-3 bg-ink px-4 pb-6 pt-4">
            <View className="flex-row gap-3">
              <View className="flex-1 rounded-xl bg-white/10 p-3">
                <Text className="text-[10px] font-bold uppercase text-white/60">Remaining distance</Text>
                <Text className="mt-0.5 text-xl font-extrabold text-white">
                  {remaining.km != null ? fmtKm(remaining.km) : "—"}
                </Text>
              </View>
              <View className="flex-1 rounded-xl bg-white/10 p-3">
                <Text className="text-[10px] font-bold uppercase text-white/60">Stops left</Text>
                <Text className="mt-0.5 text-xl font-extrabold text-white">{remaining.stops}</Text>
              </View>
              <View className="flex-1 rounded-xl bg-white/10 p-3">
                <Text className="text-[10px] font-bold uppercase text-white/60">Route total</Text>
                <Text className="mt-0.5 text-xl font-extrabold text-white">{fmtMin(route!.total_duration_min)}</Text>
              </View>
            </View>

            {currentIndex < checkpoints.length - 1 ? (
              <Button
                label={`Mark "${checkpoints[currentIndex + 1]?.name}" Reached`}
                icon={<Flag size={16} color="#FFFFFF" />}
                onPress={() => setCurrentIndex((i) => Math.min(checkpoints.length - 1, i + 1))}
              />
            ) : (
              <View className="items-center rounded-xl bg-success/20 py-3">
                <Text className="text-sm font-bold text-white">Destination reached</Text>
              </View>
            )}
            <Text className="text-center text-[10px] text-white/50">
              Progress is marked manually by you — RouteZen has no live GPS/traffic feed behind this screen.
            </Text>
          </View>
        </>
      )}

      <ConfirmDialog
        visible={exitDialogVisible}
        title="Exit route preview?"
        description="You'll return to the trip details. Your manually-marked progress on this screen isn't saved."
        confirmLabel="Exit"
        cancelLabel="Stay"
        destructive
        onConfirm={confirmExit}
        onCancel={() => setExitDialogVisible(false)}
      />
    </SafeAreaView>
  );
}
