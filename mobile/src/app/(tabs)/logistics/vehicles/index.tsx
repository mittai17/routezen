import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, View, Pressable } from "react-native";
import { ArrowLeft, Battery, Fuel, Gauge, Leaf, Truck, Weight } from "lucide-react-native";

import {
  DISPLAY_CATEGORY_LABELS,
  DISPLAY_CATEGORY_ORDER,
  displayCategoryFor,
  listVehicles,
  type VehicleProfile,
} from "../../../../lib/api/vehicles";
import { ApiError } from "../../../../lib/api/client";
import { Badge, Card, EmptyState, ErrorState, fmt, fmtMoney, LoadingSkeleton } from "../../home/_components/ui";

export default function VehiclesScreen() {
  const vehiclesQuery = useQuery({ queryKey: ["vehicles"], queryFn: ({ signal }) => listVehicles({ limit: 200, signal }) });

  const grouped = new Map<string, VehicleProfile[]>();
  for (const v of vehiclesQuery.data?.items ?? []) {
    const key = displayCategoryFor(v);
    grouped.set(key, [...(grouped.get(key) ?? []), v]);
  }

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#0E1A14" />
        </Pressable>
        <Text className="text-lg font-bold text-ink">Vehicles</Text>
      </View>

      {vehiclesQuery.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : vehiclesQuery.isError ? (
        <ErrorState
          message={vehiclesQuery.error instanceof ApiError ? vehiclesQuery.error.message : "Could not load vehicles."}
          onRetry={() => vehiclesQuery.refetch()}
        />
      ) : (vehiclesQuery.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No vehicle profiles yet" message="Vehicle profiles are configured on the web app or backend." icon={<Truck size={36} color="#5B6B60" />} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 48 }}>
          {DISPLAY_CATEGORY_ORDER.filter((key) => grouped.has(key)).map((key) => (
            <View key={key}>
              <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">{DISPLAY_CATEGORY_LABELS[key]}</Text>
              <View className="gap-3">
                {grouped.get(key)!.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function VehicleCard({ vehicle: v }: { vehicle: VehicleProfile }) {
  return (
    <Card>
      <View className="flex-row items-start justify-between">
        <Text className="flex-1 pr-2 text-base font-bold text-ink">{v.name}</Text>
        <Badge label={v.available ? "Available" : "Unavailable"} tone={v.available ? "success" : "danger"} />
      </View>
      <Text className="text-xs text-ink-muted">
        raw category: {v.category} · {v.energy_type} · {v.verification}
      </Text>

      <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-2">
        <Spec icon={<Weight size={14} color="#5B6B60" />} label="Payload" value={`${v.payload_kg} kg`} />
        <Spec icon={<Weight size={14} color="#5B6B60" />} label="Cargo volume" value={`${v.volume_m3} m³`} />
        <Spec
          icon={v.efficiency_unit === "km_per_kwh" ? <Battery size={14} color="#5B6B60" /> : <Fuel size={14} color="#5B6B60" />}
          label="Efficiency"
          value={`${v.efficiency_value} ${v.efficiency_unit === "km_per_kwh" ? "km/kWh" : "km/L"}`}
        />
        <Spec icon={<Gauge size={14} color="#5B6B60" />} label="Operating cost" value={`${fmtMoney(v.operating_cost_per_km)}/km`} />
        <Spec icon={<Leaf size={14} color="#5B6B60" />} label="Emissions" value={`${v.emissions_g_per_km} g/km`} />
        <Spec icon={<Gauge size={14} color="#5B6B60" />} label="Range" value={fmt(v.range_km, { digits: 0, suffix: " km" })} />
      </View>

      {v.source ? <Text className="mt-2 text-[11px] text-ink-muted">{v.source}</Text> : null}
    </Card>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View className="min-w-[30%] flex-row items-center gap-1.5">
      {icon}
      <View>
        <Text className="text-[10px] text-ink-muted">{label}</Text>
        <Text className="text-xs font-semibold text-ink">{value}</Text>
      </View>
    </View>
  );
}
