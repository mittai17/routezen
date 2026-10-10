import { useMemo, useState } from "react";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { CheckSquare, ChevronRight, Layers, Play, Plus, Search, Sparkles, Square, X } from "lucide-react-native";

import {
  listScenarios,
  runScenario,
  SCENARIO_KIND_LABELS,
  type Scenario,
  type ScenarioKind,
} from "../../../../lib/api/scenarios";
import { ApiError } from "../../../../lib/api/client";
import { Button, Card, EmptyState, ErrorState, LoadingSkeleton, ScreenHeader, StatusBadge } from "../../../../components/ui";

type KindFilter = "all" | ScenarioKind;

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "recommendation", label: "Recommendation" },
  { value: "classical", label: "Classical" },
  { value: "quantum", label: "Quantum" },
];

const KIND_TONE: Record<ScenarioKind, "info" | "success" | "warning"> = {
  classical: "info",
  recommendation: "success",
  quantum: "warning",
};

export default function ScenariosListScreen() {
  const queryClient = useQueryClient();
  const [filterKind, setFilterKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);

  const scenariosQuery = useQuery({
    queryKey: ["scenarios", { filterKind, search }],
    queryFn: ({ signal }) =>
      listScenarios({
        kind: filterKind === "all" ? undefined : filterKind,
        q: search.trim() || undefined,
        limit: 100,
        signal,
      }),
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => runScenario(id),
    onMutate: (id) => {
      setRunningId(id);
    },
    onSuccess: (updatedScenario) => {
      queryClient.setQueryData(
        ["scenarios", { filterKind, search }],
        (old: { items: Scenario[]; total: number } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((s) => (s.id === updatedScenario.id ? updatedScenario : s)),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["scenario", updatedScenario.id] });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to run scenario.";
      Alert.alert("Run Error", msg);
    },
    onSettled: () => {
      setRunningId(null);
    },
  });

  const items = useMemo(() => scenariosQuery.data?.items ?? [], [scenariosQuery.data?.items]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 10) {
        Alert.alert("Limit Reached", "You can compare up to 10 scenarios.");
        return prev;
      }
      return [...prev, id];
    });
  }

  function handleCompare() {
    if (selectedIds.length < 2) {
      Alert.alert("Compare Scenarios", "Please select at least 2 scenarios to compare.");
      return;
    }
    router.push(`/logistics/scenarios/compare?ids=${encodeURIComponent(selectedIds.join(","))}`);
  }

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
      <ScreenHeader
        title="Scenarios"
        subtitle="Compare optimization & recommendation scenarios"
        showBack
        right={
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => {
                if (selectMode) {
                  setSelectedIds([]);
                  setSelectMode(false);
                } else {
                  setSelectMode(true);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={selectMode ? "Cancel selection" : "Select multiple scenarios"}
              hitSlop={8}
              className={`rounded-pill border px-3 py-1.5 ${
                selectMode ? "border-brand-green bg-brand-green/10" : "border-border bg-surface"
              }`}
            >
              <Text className={`text-xs font-semibold ${selectMode ? "text-brand-green" : "text-ink"}`}>
                {selectMode ? "Done" : "Compare"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/logistics/scenarios/new")}
              accessibilityRole="button"
              accessibilityLabel="New Scenario"
              hitSlop={8}
              className="flex-row items-center gap-1 rounded-pill bg-brand-yellow px-3 py-1.5"
            >
              <Plus size={16} color="#0E1A14" />
              <Text className="text-xs font-bold text-ink">New</Text>
            </Pressable>
          </View>
        }
      />

      {/* Search & Filter Bar */}
      <View className="gap-2.5 border-b border-border bg-surface px-4 py-3">
        <View className="flex-row items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2">
          <Search size={16} color="#5B6B60" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search scenarios by name..."
            placeholderTextColor="#9AA79F"
            className="flex-1 text-sm text-ink"
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <X size={16} color="#5B6B60" />
            </Pressable>
          ) : null}
        </View>

        {/* Kind filter pills */}
        <View className="flex-row flex-wrap gap-2">
          {KIND_FILTERS.map((kf) => {
            const active = filterKind === kf.value;
            return (
              <Pressable
                key={kf.value}
                onPress={() => setFilterKind(kf.value)}
                accessibilityRole="button"
                className={`rounded-pill border px-3 py-1 ${
                  active ? "border-brand-green bg-brand-green" : "border-border bg-surface"
                }`}
              >
                <Text className={`text-xs font-semibold ${active ? "text-white" : "text-ink"}`}>
                  {kf.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Multi-select comparison banner */}
      {selectMode ? (
        <View className="flex-row items-center justify-between border-b border-brand-green/20 bg-brand-green/10 px-4 py-2.5">
          <Text className="text-xs font-semibold text-brand-green">
            {selectedIds.length} selected (choose 2 to 10)
          </Text>
          <Button
            label={`Compare (${selectedIds.length})`}
            size="md"
            variant="primary"
            disabled={selectedIds.length < 2 || selectedIds.length > 10}
            onPress={handleCompare}
            className="px-4 py-1.5"
          />
        </View>
      ) : null}

      {/* Main List */}
      {scenariosQuery.isLoading ? (
        <View className="p-4">
          <LoadingSkeleton variant="list" rows={4} />
        </View>
      ) : scenariosQuery.isError ? (
        <ErrorState
          title="Could not load scenarios"
          description={
            scenariosQuery.error instanceof ApiError
              ? scenariosQuery.error.message
              : "An unexpected error occurred while fetching scenarios."
          }
          onRetry={() => scenariosQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No scenarios found"
          description={
            filterKind !== "all" || search
              ? "Try adjusting your filters or search query."
              : "Create your first scenario to test optimization algorithms and compare outcomes."
          }
          icon={<Layers size={32} color="#5B6B60" />}
          actionLabel="New Scenario"
          onAction={() => router.push("/logistics/scenarios/new")}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.id);
            const isRunning = runningId === item.id;
            return (
              <ScenarioListItem
                scenario={item}
                selectMode={selectMode}
                isSelected={isSelected}
                isRunning={isRunning}
                onToggleSelect={() => toggleSelect(item.id)}
                onRun={() => runMutation.mutate(item.id)}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function ScenarioListItem({
  scenario,
  selectMode,
  isSelected,
  isRunning,
  onToggleSelect,
  onRun,
}: {
  scenario: Scenario;
  selectMode: boolean;
  isSelected: boolean;
  isRunning: boolean;
  onToggleSelect: () => void;
  onRun: () => void;
}) {
  const summary = (scenario.result as { summary?: Record<string, unknown> } | null)?.summary;

  const formattedLastRun = scenario.last_run_at
    ? new Date(scenario.last_run_at).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never run";

  return (
    <Card
      onPress={() => {
        if (selectMode) {
          onToggleSelect();
        } else {
          router.push(`/logistics/scenarios/${scenario.id}`);
        }
      }}
      className={`border ${isSelected ? "border-brand-green bg-brand-green/5" : "border-border"}`}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            {selectMode ? (
              <Pressable onPress={onToggleSelect} hitSlop={8} className="mr-1">
                {isSelected ? (
                  <CheckSquare size={20} color="#1B6B3F" />
                ) : (
                  <Square size={20} color="#5B6B60" />
                )}
              </Pressable>
            ) : null}
            <Text className="text-base font-bold text-ink" numberOfLines={1}>
              {scenario.name}
            </Text>
          </View>
          {scenario.description ? (
            <Text className="mt-1 text-xs text-ink-muted" numberOfLines={2}>
              {scenario.description}
            </Text>
          ) : null}
        </View>

        <StatusBadge
          label={SCENARIO_KIND_LABELS[scenario.kind]}
          tone={KIND_TONE[scenario.kind]}
        />
      </View>

      {/* Summary indicators if available */}
      {summary ? (
        <View className="mt-3 flex-row flex-wrap gap-2 rounded-md bg-muted/60 p-2">
          {summary.total_cost != null ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-xs text-ink-muted">Cost:</Text>
              <Text className="text-xs font-semibold text-ink">
                ₹{Number(summary.total_cost).toFixed(2)}
              </Text>
            </View>
          ) : null}
          {summary.total_distance_km != null ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-xs text-ink-muted">Distance:</Text>
              <Text className="text-xs font-semibold text-ink">
                {Number(summary.total_distance_km).toFixed(1)} km
              </Text>
            </View>
          ) : null}
          {summary.packages != null ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-xs text-ink-muted">Packages:</Text>
              <Text className="text-xs font-semibold text-ink">{String(summary.packages)}</Text>
            </View>
          ) : null}
          {summary.status != null ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-xs text-ink-muted">Status:</Text>
              <Text className="text-xs font-semibold text-ink">{String(summary.status)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Footer: Last run + Run Action */}
      <View className="mt-3 flex-row items-center justify-between border-t border-border pt-3">
        <Text className="text-xs text-ink-muted">Last run: {formattedLastRun}</Text>

        {!selectMode ? (
          scenario.kind === "quantum" ? (
            <Pressable
              onPress={() => router.push("/lab")}
              hitSlop={8}
              className="flex-row items-center gap-1 rounded-pill bg-warning/20 px-3 py-1.5 active:bg-warning/30"
            >
              <Sparkles size={14} color="#B3791A" />
              <Text className="text-xs font-semibold text-warning">Open Quantum Lab</Text>
            </Pressable>
          ) : (
            <Button
              label={isRunning ? "Running..." : "Run"}
              variant="secondary"
              loading={isRunning}
              disabled={isRunning}
              onPress={onRun}
              icon={<Play size={14} color="#1B6B3F" />}
              className="px-3.5 py-1.5"
            />
          )
        ) : (
          <View className="flex-row items-center gap-1">
            <Text className="text-xs font-medium text-ink-muted">Select</Text>
            <ChevronRight size={14} color="#5B6B60" />
          </View>
        )}
      </View>
    </Card>
  );
}
