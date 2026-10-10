import { useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AlertCircle, Clock, Info, Layers } from "lucide-react-native";

import {
  compareScenarios,
  SCENARIO_KIND_LABELS,
  type ScenarioCompareItem,
  type ScenarioKind,
} from "../../../../lib/api/scenarios";
import { ApiError } from "../../../../lib/api/client";
import { Card, EmptyState, ErrorState, LoadingSkeleton, MetricCard, ScreenHeader, StatusBadge } from "../../../../components/ui";

const KIND_TONE: Record<ScenarioKind, "info" | "success" | "warning"> = {
  classical: "info",
  recommendation: "success",
  quantum: "warning",
};

export default function CompareScenariosScreen() {
  const params = useLocalSearchParams<{ ids?: string | string[] }>();

  const scenarioIds = useMemo(() => {
    if (!params.ids) return [];
    if (Array.isArray(params.ids)) {
      return params.ids.flatMap((id) => id.split(",")).filter(Boolean);
    }
    return params.ids.split(",").filter(Boolean);
  }, [params.ids]);

  const compareQuery = useQuery({
    queryKey: ["scenarios-compare", scenarioIds],
    queryFn: () => compareScenarios(scenarioIds),
    enabled: scenarioIds.length >= 2 && scenarioIds.length <= 10,
  });

  if (scenarioIds.length < 2) {
    return (
      <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
        <ScreenHeader title="Scenario Comparison" showBack />
        <EmptyState
          title="At least 2 scenarios needed"
          description="Please select between 2 and 10 scenarios from the Scenarios list to compare their results side by side."
          icon={<Layers size={32} color="#5B6B60" />}
          actionLabel="Back to Scenarios"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (scenarioIds.length > 10) {
    return (
      <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
        <ScreenHeader title="Scenario Comparison" showBack />
        <EmptyState
          title="Too many scenarios selected"
          description="Comparison supports up to 10 scenarios at a time. Please deselect some scenarios and try again."
          icon={<AlertCircle size={32} color="#B3261E" />}
          actionLabel="Back to Scenarios"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
      <ScreenHeader
        title="Scenario Comparison"
        subtitle={`Comparing ${scenarioIds.length} scenarios`}
        showBack
      />

      {compareQuery.isLoading ? (
        <View className="p-4">
          <LoadingSkeleton variant="card" />
          <View className="mt-4">
            <LoadingSkeleton variant="list" rows={3} />
          </View>
        </View>
      ) : compareQuery.isError ? (
        <ErrorState
          title="Could not compare scenarios"
          description={
            compareQuery.error instanceof ApiError
              ? compareQuery.error.message
              : "An error occurred while fetching comparison data."
          }
          onRetry={() => compareQuery.refetch()}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
        >
          {/* Note Banner */}
          {compareQuery.data?.note ? (
            <View className="flex-row items-center gap-2 rounded-card border border-info/20 bg-info/10 p-3">
              <Info size={16} color="#1D5FB3" />
              <Text className="flex-1 text-xs font-medium text-info">
                {compareQuery.data.note}
              </Text>
            </View>
          ) : null}

          {/* Cards for each scenario in comparison */}
          {compareQuery.data?.scenarios.map((item, index) => (
            <ScenarioCompareCard key={item.id} scenario={item} index={index + 1} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ScenarioCompareCard({
  scenario,
  index,
}: {
  scenario: ScenarioCompareItem;
  index: number;
}) {
  const hasResult = !!scenario.result;
  const summary = scenario.summary ?? (scenario.result as { summary?: Record<string, unknown> } | null)?.summary;

  const formattedLastRun = scenario.last_run_at
    ? new Date(scenario.last_run_at).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never run";

  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <View className="flex-row items-center gap-2">
            <View className="h-5 w-5 items-center justify-center rounded-full bg-muted">
              <Text className="text-[11px] font-bold text-ink-muted">{index}</Text>
            </View>
            <Text className="text-base font-bold text-ink" numberOfLines={1}>
              {scenario.name}
            </Text>
          </View>
          <Text className="mt-1 text-xs text-ink-muted">Last run: {formattedLastRun}</Text>
        </View>

        <StatusBadge
          label={SCENARIO_KIND_LABELS[scenario.kind]}
          tone={KIND_TONE[scenario.kind]}
        />
      </View>

      {!hasResult ? (
        <View className="items-center rounded-xl border border-dashed border-border bg-muted/40 py-5">
          <Clock size={20} color="#5B6B60" />
          <Text className="mt-1 text-xs font-semibold text-ink-muted">Not run yet</Text>
          <Text className="mt-0.5 text-center text-[11px] text-ink-muted">
            Run this scenario individually to see optimization metrics here.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {summary ? (
            <View className="flex-row flex-wrap gap-2">
              {summary.total_cost != null ? (
                <MetricCard
                  label="Total Cost"
                  value={`₹${Number(summary.total_cost).toFixed(2)}`}
                />
              ) : null}
              {summary.total_distance_km != null ? (
                <MetricCard
                  label="Total Distance"
                  value={`${Number(summary.total_distance_km).toFixed(1)} km`}
                />
              ) : null}
              {summary.packages != null ? (
                <MetricCard
                  label="Packages"
                  value={String(summary.packages)}
                />
              ) : null}
              {summary.unassigned != null ? (
                <MetricCard
                  label="Unassigned"
                  value={String(summary.unassigned)}
                  trend={Number(summary.unassigned) > 0 ? "Has unassigned" : undefined}
                  trendTone="danger"
                />
              ) : null}
              {summary.unserved != null ? (
                <MetricCard
                  label="Unserved"
                  value={String(summary.unserved)}
                  trend={Number(summary.unserved) > 0 ? "Has unserved" : undefined}
                  trendTone="danger"
                />
              ) : null}
              {summary.status != null ? (
                <MetricCard
                  label="Status"
                  value={String(summary.status)}
                />
              ) : null}
            </View>
          ) : (
            <Text className="text-xs italic text-ink-muted">No summary metrics available.</Text>
          )}
        </View>
      )}

      {/* View Scenario link */}
      <View className="border-t border-border pt-2">
        <Pressable
          onPress={() => router.push(`/logistics/scenarios/${scenario.id}`)}
          className="self-end"
          hitSlop={8}
        >
          <Text className="text-xs font-semibold text-brand-green">View Details →</Text>
        </Pressable>
      </View>
    </Card>
  );
}
