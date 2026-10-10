import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Calendar, Clock, Play, Sparkles, Trash2 } from "lucide-react-native";

import {
  deleteScenario,
  getScenario,
  runScenario,
  SCENARIO_KIND_LABELS,
  type ScenarioKind,
} from "../../../../../lib/api/scenarios";
import { ApiError } from "../../../../../lib/api/client";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  LoadingSkeleton,
  MetricCard,
  ScreenHeader,
  StatusBadge,
} from "../../../../../components/ui";

const KIND_TONE: Record<ScenarioKind, "info" | "success" | "warning"> = {
  classical: "info",
  recommendation: "success",
  quantum: "warning",
};

export default function ScenarioDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const scenarioQuery = useQuery({
    queryKey: ["scenario", id],
    queryFn: ({ signal }) => getScenario(id!, signal),
    enabled: !!id,
  });

  const scenario = scenarioQuery.data;

  const runMutation = useMutation({
    mutationFn: (scenarioId: string) => runScenario(scenarioId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["scenario", id], updated);
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      Alert.alert("Run Finished", "Scenario executed successfully.");
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to run scenario.";
      Alert.alert("Run Error", msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (scenarioId: string) => deleteScenario(scenarioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      router.replace("/logistics/scenarios");
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to delete scenario.";
      Alert.alert("Delete Error", msg);
    },
  });

  if (scenarioQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
        <ScreenHeader title="Scenario" showBack />
        <View className="p-4">
          <LoadingSkeleton variant="card" />
          <View className="mt-4">
            <LoadingSkeleton variant="list" rows={3} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (scenarioQuery.isError || !scenario) {
    return (
      <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
        <ScreenHeader title="Scenario" showBack />
        <ErrorState
          title="Could not load scenario"
          description={
            scenarioQuery.error instanceof ApiError
              ? scenarioQuery.error.message
              : "Scenario not found or could not be loaded."
          }
          onRetry={() => scenarioQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  const isQuantum = scenario.kind === "quantum";
  const result = scenario.result as Record<string, unknown> | null;
  const summary = (result?.summary as Record<string, unknown> | undefined) ?? null;

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
      <ScreenHeader
        title={scenario.name}
        subtitle={`Scenario #${scenario.id.slice(0, 8)}`}
        showBack
        right={
          <Pressable
            onPress={() => setDeleteDialogOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Delete Scenario"
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full bg-danger/10 active:bg-danger/20"
          >
            <Trash2 size={18} color="#B3261E" />
          </Pressable>
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
      >
        {/* Header Overview Card */}
        <Card className="gap-3">
          <View className="flex-row items-center justify-between">
            <StatusBadge
              label={SCENARIO_KIND_LABELS[scenario.kind]}
              tone={KIND_TONE[scenario.kind]}
            />
            {isQuantum ? (
              <Pressable
                onPress={() => router.push("/lab")}
                hitSlop={8}
                className="flex-row items-center gap-1.5 rounded-pill bg-warning/20 px-3 py-1.5 active:bg-warning/30"
              >
                <Sparkles size={14} color="#B3791A" />
                <Text className="text-xs font-semibold text-warning">Open Quantum Lab</Text>
              </Pressable>
            ) : (
              <Button
                label={runMutation.isPending ? "Running..." : "Run Scenario"}
                variant="primary"
                size="md"
                loading={runMutation.isPending}
                disabled={runMutation.isPending}
                onPress={() => runMutation.mutate(scenario.id)}
                icon={<Play size={16} color="#FFFFFF" />}
                className="px-4 py-2"
              />
            )}
          </View>

          {scenario.description ? (
            <Text className="text-sm text-ink-muted">{scenario.description}</Text>
          ) : null}

          {/* Timestamps */}
          <View className="mt-2 gap-1.5 border-t border-border pt-3">
            <View className="flex-row items-center gap-2">
              <Clock size={14} color="#5B6B60" />
              <Text className="text-xs text-ink-muted">
                Last Run:{" "}
                <Text className="font-medium text-ink">
                  {scenario.last_run_at
                    ? new Date(scenario.last_run_at).toLocaleString("en-IN")
                    : "Not run yet"}
                </Text>
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Calendar size={14} color="#5B6B60" />
              <Text className="text-xs text-ink-muted">
                Created:{" "}
                <Text className="font-medium text-ink">
                  {new Date(scenario.created_at).toLocaleString("en-IN")}
                </Text>
              </Text>
            </View>
          </View>
        </Card>

        {/* Results Section */}
        <View className="gap-3">
          <Text className="text-sm font-bold uppercase tracking-wider text-ink-muted">
            Execution Result
          </Text>

          {result ? (
            <>
              {/* Summary Metrics */}
              {summary ? (
                <View className="flex-row flex-wrap gap-2.5">
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
              ) : null}

              {/* Full JSON Dump Card */}
              <Card className="gap-2">
                <Text className="text-xs font-semibold text-ink-muted uppercase">
                  Raw Output Data
                </Text>
                <View className="max-h-80 rounded-xl bg-muted/60 p-3">
                  <ScrollView nestedScrollEnabled>
                    <Text className="font-mono text-xs text-ink">
                      {JSON.stringify(result, null, 2)}
                    </Text>
                  </ScrollView>
                </View>
              </Card>
            </>
          ) : (
            <Card className="items-center py-8">
              <Clock size={32} color="#5B6B60" />
              <Text className="mt-2 text-sm font-bold text-ink">Not run yet</Text>
              <Text className="mt-1 text-center text-xs text-ink-muted">
                {isQuantum
                  ? "Quantum scenarios require quantum backend simulation. Open the Quantum Lab to launch."
                  : "Tap the Run Scenario button above to solve this scenario with live data."}
              </Text>
            </Card>
          )}
        </View>

        {/* Configuration Section */}
        <Card className="gap-3">
          <Text className="text-sm font-bold uppercase tracking-wider text-ink-muted">
            Scenario Configuration
          </Text>
          {Object.keys(scenario.config || {}).length === 0 ? (
            <Text className="text-xs italic text-ink-muted">Default system configuration (empty)</Text>
          ) : (
            <View className="max-h-60 rounded-xl bg-muted/60 p-3">
              <ScrollView nestedScrollEnabled>
                <Text className="font-mono text-xs text-ink">
                  {JSON.stringify(scenario.config, null, 2)}
                </Text>
              </ScrollView>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={deleteDialogOpen}
        title="Delete Scenario"
        description={`Are you sure you want to delete "${scenario.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          setDeleteDialogOpen(false);
          deleteMutation.mutate(scenario.id);
        }}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </SafeAreaView>
  );
}
