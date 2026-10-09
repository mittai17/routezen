import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { ArrowLeft, Award, Battery, Clock, Fuel, Gauge, Leaf, MapPin, Weight } from "lucide-react-native";

import { getPackage } from "../../../../../lib/api/packages";
import { postRecommendations, type PackageRecommendation, type VehicleOption } from "../../../../../lib/api/recommendations";
import { apiRequest, ApiError } from "../../../../../lib/api/client";
import { Badge, Card, EmptyState, ErrorState, fmtMoney } from "../../../home/_components/ui";

interface LocationRow {
  id: string;
  name: string;
  type: "depot" | "stop" | "warehouse";
  latitude: number;
  longitude: number;
}

export default function RecommendVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [depotId, setDepotId] = useState<string | null>(null);

  const packageQuery = useQuery({ queryKey: ["package", id], queryFn: ({ signal }) => getPackage(id, signal), enabled: !!id });
  const locationsQuery = useQuery({
    queryKey: ["locations-depots"],
    queryFn: ({ signal }) => apiRequest<{ items: LocationRow[] }>("/locations", { query: { limit: 100 }, signal }),
  });

  const depots = useMemo(() => (locationsQuery.data?.items ?? []).filter((l) => l.type === "depot"), [locationsQuery.data]);
  const effectiveDepotId = depotId ?? depots[0]?.id ?? null;

  const recQuery = useQuery({
    queryKey: ["recommendation", id, effectiveDepotId],
    queryFn: () => postRecommendations({ package_ids: [id], depot_location_id: effectiveDepotId!, preferences: { top_n: 6 } }),
    enabled: !!id && !!effectiveDepotId,
  });

  const result: PackageRecommendation | undefined = recQuery.data?.[0];

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#0E1A14" />
        </Pressable>
        <Text className="text-lg font-bold text-ink">Vehicle recommendations</Text>
      </View>

      {packageQuery.isLoading || locationsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : depots.length === 0 ? (
        <EmptyState
          title="No depot configured"
          message="Add a location with type 'depot' before requesting vehicle recommendations — the engine needs a start point to calculate distance and cost."
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 14 }}>
          <Card>
            <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">For package</Text>
            <Text className="text-base font-semibold text-ink">{packageQuery.data?.reference}</Text>
            <Text className="text-xs text-ink-muted">{packageQuery.data?.weight_kg} kg{packageQuery.data?.volume_m3 ? ` · ${packageQuery.data.volume_m3} m³` : ""}</Text>
          </Card>

          <Card>
            <Text className="mb-2 flex-row items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">Depot</Text>
            <View className="flex-row flex-wrap gap-2">
              {depots.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => setDepotId(d.id)}
                  className={`rounded-pill border px-3 py-1.5 ${d.id === effectiveDepotId ? "border-brand-green bg-brand-green" : "border-border bg-white"}`}
                >
                  <Text className={`text-xs font-semibold ${d.id === effectiveDepotId ? "text-white" : "text-ink"}`}>{d.name}</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          {recQuery.isLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator />
            </View>
          ) : recQuery.isError ? (
            <ErrorState
              message={recQuery.error instanceof ApiError ? recQuery.error.message : "Could not fetch recommendations."}
              onRetry={() => recQuery.refetch()}
            />
          ) : !result ? (
            <EmptyState title="No result" message="The recommendation engine returned nothing for this package." />
          ) : (
            <>
              <Card>
                <View className="flex-row flex-wrap items-center gap-2">
                  <Badge label={`${result.distance_km.toFixed(1)} km`} tone="info" />
                  <Badge label={`${result.duration_min.toFixed(0)} min`} tone="info" />
                  {result.fallback_estimate ? <Badge label="Straight-line estimate — routing unavailable" tone="warning" /> : <Badge label="Real road route (OSRM)" tone="success" />}
                </View>
                <Text className="mt-2 text-xs text-ink-muted">{result.explanation}</Text>
              </Card>

              {result.recommended ? (
                <View>
                  <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Recommended</Text>
                  <VehicleOptionCard option={result.recommended} highlighted />
                </View>
              ) : (
                <EmptyState title="No eligible vehicle" message="Every vehicle profile failed a hard capacity or deadline constraint for this package — see 'Not eligible' below." />
              )}

              {result.alternatives.length > 0 ? (
                <View>
                  <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Alternatives</Text>
                  <View className="gap-3">
                    {result.alternatives.map((opt) => (
                      <VehicleOptionCard key={opt.vehicle_id} option={opt} />
                    ))}
                  </View>
                </View>
              ) : null}

              {result.ineligible.length > 0 ? (
                <View>
                  <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Not eligible</Text>
                  <View className="gap-2">
                    {result.ineligible.map((v) => (
                      <Card key={v.vehicle_id}>
                        <Text className="text-sm font-semibold text-ink">{v.name}</Text>
                        {v.reasons.map((r, i) => (
                          <Text key={i} className="text-xs text-danger">
                            • {r}
                          </Text>
                        ))}
                      </Card>
                    ))}
                  </View>
                </View>
              ) : null}

              {result.assumptions.length > 0 ? (
                <Card>
                  <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">Assumptions</Text>
                  {result.assumptions.map((a, i) => (
                    <Text key={i} className="text-[11px] text-ink-muted">
                      • {a}
                    </Text>
                  ))}
                </Card>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function VehicleOptionCard({ option, highlighted }: { option: VehicleOption; highlighted?: boolean }) {
  return (
    <Card className={highlighted ? "border-brand-green bg-brand-green/5" : undefined}>
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 pr-2 text-base font-bold text-ink">{option.name}</Text>
        {highlighted ? <Award size={18} color="#1B6B3F" /> : null}
      </View>
      <Text className="text-xs text-ink-muted">{option.category} · {option.verification}</Text>

      <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-2">
        <Spec icon={<Gauge size={14} color="#5B6B60" />} label="Score" value={option.score.toFixed(1)} />
        <Spec icon={<Clock size={14} color="#5B6B60" />} label="Travel" value={`${option.travel_minutes.toFixed(0)} min`} />
        <Spec
          icon={option.energy_unit === "kWh" ? <Battery size={14} color="#5B6B60" /> : <Fuel size={14} color="#5B6B60" />}
          label="Energy"
          value={`${option.energy_used.toFixed(2)} ${option.energy_unit}`}
        />
        <Spec icon={<Leaf size={14} color="#5B6B60" />} label="Emissions" value={`${option.emissions_g.toFixed(0)} g`} />
        <Spec icon={<Weight size={14} color="#5B6B60" />} label="Payload used" value={`${Math.round(option.payload_utilisation * 100)}%`} />
        <Spec icon={<MapPin size={14} color="#5B6B60" />} label="Volume used" value={`${Math.round(option.volume_utilisation * 100)}%`} />
      </View>

      <View className="mt-3 flex-row items-center justify-between border-t border-border pt-3">
        <View>
          <Text className="text-xs text-ink-muted">Total cost</Text>
          <Text className="text-base font-bold text-ink">{fmtMoney(option.total_cost)}</Text>
        </View>
        <Badge label={option.deadline_feasible ? "Meets deadline" : "Misses deadline"} tone={option.deadline_feasible ? "success" : "danger"} />
      </View>
    </Card>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View className="min-w-[28%] flex-row items-center gap-1.5">
      {icon}
      <View>
        <Text className="text-[10px] text-ink-muted">{label}</Text>
        <Text className="text-xs font-semibold text-ink">{value}</Text>
      </View>
    </View>
  );
}
