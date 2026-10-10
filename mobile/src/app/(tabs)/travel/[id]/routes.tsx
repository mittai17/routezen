import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Fuel, Leaf, MapPinned } from "lucide-react-native";
import {
  ApiError,
  emissionsAssumptionLabel,
  estimateEmissionsKg,
  generateRouteOptions,
  getTrip,
  type RouteOption,
} from "../../../../lib/api/travel";
import { Button, Card, ErrorState, LoadingSkeleton, RouteZenMap, ScreenHeader, StatusBadge } from "../../../../components/ui";
import { StatTile, fmtInr, fmtKm, fmtMin } from "../../../../components/travel/shared";

type Objective = "balanced" | "fastest" | "cheapest" | "shortest" | "lowest_emissions";

function sortForObjective(routes: RouteOption[], objective: Objective, travelMode: string) {
  const copy = [...routes];
  switch (objective) {
    case "fastest":
      return copy.sort((a, b) => a.total_duration_min - b.total_duration_min);
    case "cheapest":
      return copy.sort((a, b) => (a.estimated_total_cost_inr ?? Infinity) - (b.estimated_total_cost_inr ?? Infinity));
    case "shortest":
      return copy.sort((a, b) => a.total_distance_km - b.total_distance_km);
    case "lowest_emissions":
      return copy.sort(
        (a, b) => estimateEmissionsKg(a.total_distance_km, travelMode) - estimateEmissionsKg(b.total_distance_km, travelMode),
      );
    default:
      return copy.sort((a, b) => Number(b.is_selected) - Number(a.is_selected));
  }
}

function RouteMap({ route }: { route: RouteOption }) {
  const hasRealGeometry = !route.fallback_estimate && route.geometry.length > 1;

  if (!hasRealGeometry) {
    return (
      <View className="h-48 items-center justify-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-4">
        <AlertTriangle size={22} color="#B3791A" />
        <Text className="text-center text-sm font-semibold text-ink">Map unavailable for this option</Text>
        <Text className="text-center text-xs text-ink-muted">
          {route.geometry.length === 0
            ? "The backend returned no road geometry for this route."
            : "This is a straight-line distance estimate, not a real road route — the routing service was unreachable."}
        </Text>
      </View>
    );
  }

  const coords = route.geometry.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
  const first = coords[0];
  const last = coords[coords.length - 1];

  return (
    <View className="h-48 overflow-hidden rounded-xl border border-border">
      <RouteZenMap
        style={{ flex: 1 }}
        initialRegion={{
          latitude: first.latitude,
          longitude: first.longitude,
          latitudeDelta: Math.max(0.5, Math.abs(first.latitude - last.latitude) * 1.4),
          longitudeDelta: Math.max(0.5, Math.abs(first.longitude - last.longitude) * 1.4),
        }}
        polyline={coords}
        markers={[
          { id: "start", latitude: first.latitude, longitude: first.longitude, title: "Start", color: "#1B6B3F" },
          { id: "end", latitude: last.latitude, longitude: last.longitude, title: "End", color: "#B3261E" },
        ]}
      />
    </View>
  );
}

function RouteCard({
  route,
  rank,
  travelMode,
  expanded,
  onToggleExpand,
  selected,
  onSelect,
}: {
  route: RouteOption;
  rank: number;
  travelMode: string;
  expanded: boolean;
  onToggleExpand: () => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const emissionsKg = estimateEmissionsKg(route.total_distance_km, travelMode);
  return (
    <Card className={`gap-3 ${selected ? "border-brand-green" : ""}`}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-bold text-ink">{route.label}</Text>
            {rank === 0 ? <StatusBadge label="Best match" tone="success" /> : null}
          </View>
          <Text className="mt-0.5 text-xs text-ink-muted">{route.description}</Text>
        </View>
      </View>

      {route.fallback_estimate ? (
        <View className="flex-row items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5">
          <AlertTriangle size={13} color="#B3791A" />
          <Text className="flex-1 text-[11px] font-medium text-warning">{route.note ?? "Straight-line fallback estimate — not a real road route."}</Text>
        </View>
      ) : null}

      <View className="flex-row gap-2">
        <StatTile label="Distance" value={fmtKm(route.total_distance_km)} />
        <StatTile label="Duration" value={fmtMin(route.total_duration_min)} sub={`${route.estimated_days} day(s)`} />
        <StatTile label="Est. cost" value={fmtInr(route.estimated_total_cost_inr)} sub={`fuel ${fmtInr(route.estimated_fuel_cost_inr)}`} />
      </View>

      <View className="flex-row items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5">
        <Leaf size={13} color="#1B6B3F" />
        <Text className="flex-1 text-[11px] text-ink-muted">
          ~{emissionsKg} kg CO2e ({emissionsAssumptionLabel(travelMode)})
        </Text>
      </View>

      <RouteMap route={route} />

      <Pressable onPress={onToggleExpand} className="flex-row items-center justify-center gap-1 py-1">
        <Text className="text-xs font-semibold text-brand-green">{expanded ? "Hide details" : "View details"}</Text>
        {expanded ? <ChevronUp size={14} color="#0E4429" /> : <ChevronDown size={14} color="#0E4429" />}
      </Pressable>

      {expanded ? (
        <View className="gap-1.5 rounded-xl bg-muted p-3">
          <View className="flex-row justify-between">
            <Text className="text-xs text-ink-muted">Data source</Text>
            <Text className="text-xs font-medium text-ink">{route.data_source}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-ink-muted">Checkpoints covered</Text>
            <Text className="text-xs font-medium text-ink">{route.checkpoints.length}</Text>
          </View>
          {route.note ? (
            <View className="flex-row justify-between gap-2">
              <Text className="text-xs text-ink-muted">Note</Text>
              <Text className="flex-1 text-right text-xs font-medium text-ink">{route.note}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Button
        label={selected ? "Selected" : "Select this route"}
        variant={selected ? "secondary" : "primary"}
        icon={selected ? <CheckCircle2 size={16} color="#0E4429" /> : undefined}
        onPress={onSelect}
      />
    </Card>
  );
}

export default function RouteOptionsScreen() {
  const { id, objective: objectiveParam } = useLocalSearchParams<{ id: string; objective?: string }>();
  const tripId = String(id);
  const objective = (objectiveParam as Objective) ?? "balanced";
  const queryClient = useQueryClient();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tripQuery = useQuery({ queryKey: ["travel-trip", tripId], queryFn: () => getTrip(tripId) });
  const routesQuery = useQuery({
    queryKey: ["route-options", tripId],
    queryFn: () => generateRouteOptions(tripId),
    enabled: !!tripId,
  });

  const sorted = useMemo(() => {
    if (!routesQuery.data) return [];
    return sortForObjective(routesQuery.data, objective, tripQuery.data?.travel_mode ?? "car");
  }, [routesQuery.data, objective, tripQuery.data?.travel_mode]);

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["bottom"]}>
      <ScreenHeader title="Route Options" subtitle={tripQuery.data?.name} showBack />
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, paddingBottom: 96, gap: 12 }}>
        {routesQuery.isLoading ? (
          <LoadingSkeleton variant="list" rows={3} />
        ) : routesQuery.isError ? (
          <ErrorState
            title="Could not generate route options"
            description={routesQuery.error instanceof ApiError ? routesQuery.error.message : "Please try again."}
            onRetry={() => queryClient.invalidateQueries({ queryKey: ["route-options", tripId] })}
          />
        ) : sorted.length === 0 ? (
          <View className="items-center gap-2 py-16">
            <MapPinned size={28} color="#5B6B60" />
            <Text className="text-sm text-ink-muted">No route options returned.</Text>
          </View>
        ) : (
          <>
            <Text className="text-xs text-ink-muted">
              Sorted for your {"“"}
              {objective.replace("_", " ")}
              {"”"} priority. The backend computes the same 3 alternatives every time — this only changes their order and
              which one is flagged {"“"}Best match{"”"}.
            </Text>
            {sorted.map((route, i) => (
              <RouteCard
                key={route.id}
                route={route}
                rank={i}
                travelMode={tripQuery.data?.travel_mode ?? "car"}
                expanded={expandedId === route.id}
                onToggleExpand={() => setExpandedId(expandedId === route.id ? null : route.id)}
                selected={selectedId === route.id}
                onSelect={() => setSelectedId(route.id)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {selectedId ? (
        <View className="absolute bottom-6 left-4 right-4">
          <Button
            label="Continue to Trip Details"
            size="lg"
            icon={<Fuel size={18} color="#FFFFFF" />}
            onPress={() => router.push(`/travel/${tripId}`)}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
