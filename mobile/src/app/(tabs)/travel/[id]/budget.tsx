import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info } from "lucide-react-native";
import { ApiError, getTripBudget } from "../../../../lib/api/travel";
import { Card, ErrorState, LoadingSkeleton, ScreenHeader, StatusBadge } from "../../../../components/ui";
import { fmtInr } from "../../../../components/travel/shared";

const LINE_ITEMS: { key: "fuel_inr" | "accommodation_inr" | "meals_inr" | "attractions_inr" | "tolls_inr" | "parking_inr" | "other_inr" | "contingency_inr"; label: string }[] = [
  { key: "fuel_inr", label: "Fuel" },
  { key: "accommodation_inr", label: "Accommodation" },
  { key: "meals_inr", label: "Meals" },
  { key: "attractions_inr", label: "Attractions" },
  { key: "tolls_inr", label: "Tolls" },
  { key: "parking_inr", label: "Parking" },
  { key: "other_inr", label: "Other" },
  { key: "contingency_inr", label: "Contingency" },
];

export default function BudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = String(id);

  const budgetQuery = useQuery({ queryKey: ["travel-budget", tripId], queryFn: () => getTripBudget(tripId) });

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["bottom"]}>
      <ScreenHeader title="Budget" showBack />
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, paddingBottom: 48, gap: 12 }}>
        {budgetQuery.isLoading ? (
          <LoadingSkeleton variant="list" rows={3} />
        ) : budgetQuery.isError ? (
          <ErrorState
            description={budgetQuery.error instanceof ApiError ? budgetQuery.error.message : "Could not load budget."}
            onRetry={() => budgetQuery.refetch()}
          />
        ) : budgetQuery.data ? (
          <>
            <Card className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-ink-muted">Estimated total</Text>
                <Text className="text-2xl font-extrabold text-ink">{fmtInr(budgetQuery.data.estimated_total_inr)}</Text>
              </View>
              {budgetQuery.data.target_budget_inr != null ? (
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-ink-muted">Your target</Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-semibold text-ink">{fmtInr(budgetQuery.data.target_budget_inr)}</Text>
                    <StatusBadge label={budgetQuery.data.over_budget ? "Over budget" : "Within budget"} tone={budgetQuery.data.over_budget ? "danger" : "success"} />
                  </View>
                </View>
              ) : null}
            </Card>

            <Card className="gap-1">
              <Text className="mb-1 text-sm font-bold text-ink">Breakdown</Text>
              {LINE_ITEMS.map(({ key, label }) => {
                const value = budgetQuery.data![key];
                return (
                  <View key={key} className="flex-row justify-between border-b border-border/60 py-1.5 last:border-b-0">
                    <Text className="text-sm text-ink-muted">{label}</Text>
                    <Text className="text-sm font-medium text-ink">{fmtInr(value ?? undefined)}</Text>
                  </View>
                );
              })}
            </Card>

            {budgetQuery.data.day_totals.length > 0 ? (
              <Card className="gap-1">
                <Text className="mb-1 text-sm font-bold text-ink">Per-day totals</Text>
                {budgetQuery.data.day_totals.map((d, i) => (
                  <View key={i} className="flex-row justify-between border-b border-border/60 py-1.5 last:border-b-0">
                    <Text className="text-sm text-ink-muted">
                      Day {String(d.day ?? i + 1)}
                      {d.date ? ` · ${String(d.date)}` : ""}
                    </Text>
                    <Text className="text-sm font-medium text-ink">{fmtInr(Number(d.total_inr ?? 0))}</Text>
                  </View>
                ))}
              </Card>
            ) : null}

            <Card className="gap-2">
              <View className="flex-row items-center gap-2">
                <Info size={15} color="#1D5FB3" />
                <Text className="text-sm font-bold text-ink">Assumptions ({budgetQuery.data.data_source})</Text>
              </View>
              {budgetQuery.data.assumptions.map((a, i) => (
                <Text key={i} className="text-xs text-ink-muted">
                  {"•"} {a}
                </Text>
              ))}
            </Card>

            {budgetQuery.data.unknown_items.length > 0 ? (
              <Card className="gap-2 border-warning/40 bg-warning/5">
                <View className="flex-row items-center gap-2">
                  <AlertTriangle size={15} color="#B3791A" />
                  <Text className="text-sm font-bold text-ink">Not accounted for</Text>
                </View>
                {budgetQuery.data.unknown_items.map((u, i) => (
                  <Text key={i} className="text-xs text-ink-muted">
                    {"•"} {u}
                  </Text>
                ))}
              </Card>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
