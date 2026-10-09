import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AlertTriangle, CheckCircle2, Clock, Package as PackageIcon, Plus, Sparkles, Truck } from "lucide-react-native";

import { isDelayed, listPackages, STATUS_LABELS, type Package } from "../../../lib/api/packages";
import { ApiError } from "../../../lib/api/client";
import { Badge, Card, ErrorState, LoadingSkeleton, MetricCard, ScreenHeader } from "../home/_components/ui";

const MAX_FOR_STATS = 500; // backend's own per-request cap; dashboards at larger scale need a dedicated /analytics rollup.

export default function LogisticsDashboard() {
  const packagesQuery = useQuery({
    queryKey: ["logistics-stats"],
    queryFn: ({ signal }) => listPackages({ limit: MAX_FOR_STATS, sort: "created_at", order: "desc", signal }),
  });

  const items = packagesQuery.data?.items ?? [];
  const total = packagesQuery.data?.total ?? 0;
  const counted = items.length < total;

  const stats = {
    pending: items.filter((p) => p.status === "pending").length,
    inProgress: items.filter((p) => p.status === "assigned" || p.status === "in_transit").length,
    completed: items.filter((p) => p.status === "delivered").length,
    delayed: items.filter((p) => isDelayed(p)).length,
  };

  const recent = items.slice(0, 5);

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <ScreenHeader title="Logistics" subtitle="Packages, vehicles & dispatch" />

        <View className="px-5">
          <View className="flex-row gap-3">
            <Pressable onPress={() => router.push("/logistics/packages/new")} className="flex-1">
              <Card className="items-center gap-1 bg-brand-yellow">
                <Plus size={20} color="#0E1A14" />
                <Text className="text-xs font-bold text-ink">Add package</Text>
              </Card>
            </Pressable>
            <Pressable onPress={() => router.push("/logistics/packages")} className="flex-1">
              <Card className="items-center gap-1">
                <Sparkles size={20} color="#1B6B3F" />
                <Text className="text-xs font-bold text-ink">Recommend vehicle</Text>
              </Card>
            </Pressable>
            <Pressable onPress={() => router.push("/logistics/vehicles")} className="flex-1">
              <Card className="items-center gap-1">
                <Truck size={20} color="#1B6B3F" />
                <Text className="text-xs font-bold text-ink">View vehicles</Text>
              </Card>
            </Pressable>
          </View>
        </View>

        {packagesQuery.isLoading ? (
          <LoadingSkeleton rows={3} />
        ) : packagesQuery.isError ? (
          <ErrorState
            message={packagesQuery.error instanceof ApiError ? packagesQuery.error.message : "Could not load logistics data."}
            onRetry={() => packagesQuery.refetch()}
          />
        ) : (
          <>
            <View className="mt-5 flex-row flex-wrap gap-3 px-5">
              <MetricCard label="Total packages" value={String(total)} tone="info" />
              <MetricCard label="Pending" value={String(stats.pending)} tone="muted" />
              <MetricCard label="In progress" value={String(stats.inProgress)} tone="warning" />
              <MetricCard label="Completed" value={String(stats.completed)} tone="success" />
              <MetricCard label="Delayed" value={String(stats.delayed)} tone={stats.delayed > 0 ? "danger" : "muted"} hint="Past deadline, not yet delivered" />
            </View>
            {counted ? (
              <Text className="mt-2 px-5 text-[11px] text-ink-muted">
                Status breakdown is computed from the {items.length} most recently created packages of {total} total.
              </Text>
            ) : null}

            <View className="mt-6 px-5">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-base font-bold text-ink">Recent packages</Text>
                <Pressable onPress={() => router.push("/logistics/packages")}>
                  <Text className="text-xs font-semibold text-brand-green">View all</Text>
                </Pressable>
              </View>

              {recent.length === 0 ? (
                <Card className="items-center gap-2 py-8">
                  <PackageIcon size={32} color="#5B6B60" />
                  <Text className="text-sm font-semibold text-ink">No packages yet</Text>
                  <Text className="text-center text-xs text-ink-muted">Add your first package to start planning deliveries and vehicle assignments.</Text>
                </Card>
              ) : (
                <View className="gap-2">
                  {recent.map((p) => (
                    <RecentPackageRow key={p.id} pkg={p} />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const STATUS_ICON: Record<Package["status"], React.ReactNode> = {
  pending: <Clock size={16} color="#5B6B60" />,
  assigned: <Clock size={16} color="#1D5FB3" />,
  in_transit: <Truck size={16} color="#B3791A" />,
  delivered: <CheckCircle2 size={16} color="#1B6B3F" />,
  failed: <AlertTriangle size={16} color="#B3261E" />,
  cancelled: <AlertTriangle size={16} color="#B3261E" />,
};

function RecentPackageRow({ pkg }: { pkg: Package }) {
  return (
    <Pressable onPress={() => router.push(`/logistics/packages/${pkg.id}`)} className="flex-row items-center gap-3 rounded-card border border-border bg-white p-3">
      {STATUS_ICON[pkg.status]}
      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink">{pkg.reference}</Text>
        <Text className="text-xs text-ink-muted" numberOfLines={1}>
          {pkg.address ?? "No address"}
        </Text>
      </View>
      <Badge label={STATUS_LABELS[pkg.status]} tone="muted" />
    </Pressable>
  );
}
