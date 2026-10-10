import { useState } from "react";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Boxes, Map as MapIcon, Package as PackageIcon, Plane, Search, Sparkles, Truck } from "lucide-react-native";

import { apiRequest } from "../../../lib/api/client";
import { listPackages, STATUS_LABELS, type Package } from "../../../lib/api/packages";
import { Badge, Card, DemoDataBadge, ErrorState, fmtMoney, LoadingSkeleton, MetricCard } from "../../../components/home/ui";

interface AnalyticsSummary {
  locations: number;
  packages: number;
  vehicles: number;
  plans: number;
  events: number;
  packages_by_status: Record<string, number>;
}

interface AnalyticsCost {
  plans_with_cost: number;
  total_cost: string;
  cost_per_delivery: string | null;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeDashboard() {
  const [search, setSearch] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["home-summary"],
    queryFn: ({ signal }) => apiRequest<AnalyticsSummary>("/analytics/summary", { signal }),
  });
  const costQuery = useQuery({
    queryKey: ["home-cost"],
    queryFn: ({ signal }) => apiRequest<AnalyticsCost>("/analytics/cost", { signal }),
  });
  const recentQuery = useQuery({
    queryKey: ["home-recent-packages"],
    queryFn: ({ signal }) => listPackages({ limit: 4, sort: "updated_at", order: "desc", signal }),
  });

  function runSearch() {
    router.push({ pathname: "/logistics/packages", params: search.trim() ? { q: search.trim() } : {} });
  }

  const loading = summaryQuery.isLoading || costQuery.isLoading;
  const errored = summaryQuery.isError || costQuery.isError;

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View className="px-5 pb-2 pt-3">
          <Text className="text-sm text-ink-muted">{greeting()}</Text>
          <Text className="text-2xl font-bold text-ink">RouteZen</Text>
        </View>

        <View className="px-5 pb-4">
          <View className="flex-row items-center gap-2 rounded-xl border border-border bg-white px-3 py-3">
            <Search size={18} color="#5B6B60" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={runSearch}
              placeholder="Search packages, places, deliveries…"
              placeholderTextColor="#9AA79F"
              returnKeyType="search"
              className="flex-1 text-sm text-ink"
            />
          </View>
        </View>

        <View className="px-5">
          <View className="flex-row flex-wrap gap-3">
            <QuickAction icon={<Plane size={20} color="#1B6B3F" />} label="Plan Travel" onPress={() => router.push("/travel")} />
            <QuickAction icon={<Sparkles size={20} color="#1B6B3F" />} label="Optimize Logistics" onPress={() => router.push("/lab")} />
            <QuickAction icon={<MapIcon size={20} color="#1B6B3F" />} label="Live Map" onPress={() => router.push("/map")} />
            <QuickAction icon={<Boxes size={20} color="#1B6B3F" />} label="My Deliveries" onPress={() => router.push("/logistics/packages")} />
          </View>
        </View>

        {loading ? (
          <LoadingSkeleton rows={2} />
        ) : errored ? (
          <ErrorState
            message="Could not load your activity summary."
            onRetry={() => {
              summaryQuery.refetch();
              costQuery.refetch();
            }}
          />
        ) : (
          <View className="mt-5 flex-row flex-wrap gap-3 px-5">
            <MetricCard label="Packages" value={String(summaryQuery.data?.packages ?? 0)} tone="info" />
            <MetricCard label="Vehicles" value={String(summaryQuery.data?.vehicles ?? 0)} tone="info" />
            <MetricCard label="Plans run" value={String(summaryQuery.data?.plans ?? 0)} tone="muted" />
            <MetricCard
              label="Total planned cost"
              value={fmtMoney(costQuery.data?.total_cost)}
              hint={costQuery.data?.plans_with_cost ? `${costQuery.data.plans_with_cost} plan(s) with cost` : "No optimized plans yet"}
              tone="muted"
            />
          </View>
        )}

        <View className="mt-6 px-5">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-bold text-ink">Recent activity</Text>
            <Pressable onPress={() => router.push("/logistics/packages")}>
              <Text className="text-xs font-semibold text-brand-green">View all</Text>
            </Pressable>
          </View>
          {recentQuery.isLoading ? (
            <LoadingSkeleton rows={2} />
          ) : recentQuery.isError ? (
            <ErrorState message="Could not load recent packages." onRetry={() => recentQuery.refetch()} />
          ) : (recentQuery.data?.items.length ?? 0) === 0 ? (
            <Card className="items-center gap-2 py-8">
              <PackageIcon size={28} color="#5B6B60" />
              <Text className="text-sm font-semibold text-ink">No activity yet</Text>
              <Text className="text-center text-xs text-ink-muted">Package and delivery updates will show up here.</Text>
            </Card>
          ) : (
            <View className="gap-2">
              {recentQuery.data!.items.map((p) => (
                <ActivityRow key={p.id} pkg={p} />
              ))}
            </View>
          )}
        </View>

        <View className="mt-6 px-5">
          <View className="mb-2 flex-row items-center gap-2">
            <Text className="text-base font-bold text-ink">Upcoming trips</Text>
            <DemoDataBadge />
          </View>
          <Card>
            <Text className="text-sm text-ink-muted">
              Smart Travel data isn&apos;t wired into this dashboard yet. Once trips exist, they&apos;ll show real origin, destination and
              departure time here instead of this placeholder.
            </Text>
            <Pressable onPress={() => router.push("/travel")} className="mt-3">
              <Text className="text-sm font-semibold text-brand-green">Plan a trip →</Text>
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="w-[47%]">
      <Card className="items-center gap-2 py-4">
        {icon}
        <Text className="text-center text-xs font-semibold text-ink">{label}</Text>
      </Card>
    </Pressable>
  );
}

const STATUS_TONE: Record<Package["status"], "success" | "warning" | "danger" | "info" | "muted"> = {
  pending: "muted",
  assigned: "info",
  in_transit: "warning",
  delivered: "success",
  failed: "danger",
  cancelled: "danger",
};

function ActivityRow({ pkg }: { pkg: Package }) {
  return (
    <Pressable onPress={() => router.push(`/logistics/packages/${pkg.id}`)} className="flex-row items-center gap-3 rounded-card border border-border bg-white p-3">
      <Truck size={16} color="#5B6B60" />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink">{pkg.reference}</Text>
        <Text className="text-xs text-ink-muted" numberOfLines={1}>
          {pkg.address ?? "No address"}
        </Text>
      </View>
      <Badge label={STATUS_LABELS[pkg.status]} tone={STATUS_TONE[pkg.status]} />
    </Pressable>
  );
}
