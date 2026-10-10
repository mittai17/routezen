import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, Hotel, RefreshCw, Utensils, Landmark } from "lucide-react-native";
import { ApiError, buildItinerary, type ItineraryDay } from "../../../../lib/api/travel";
import { Button, Card, ErrorState, LoadingSkeleton, ScreenHeader } from "../../../../components/ui";
import { fmtInr, fmtKm, fmtMin } from "../../../../components/travel/shared";

const ITEM_ICON: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  drive: Car,
  stay: Hotel,
  meal: Utensils,
  attraction: Landmark,
};

function DayCard({ day }: { day: ItineraryDay }) {
  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold text-ink">
          Day {day.day_number}
          {day.date ? ` · ${day.date}` : ""}
        </Text>
        <Text className="text-sm font-semibold text-ink">{fmtInr(day.estimated_cost_inr)}</Text>
      </View>
      <View className="flex-row gap-3">
        <Text className="text-xs text-ink-muted">{fmtKm(day.drive_distance_km)} driving</Text>
        <Text className="text-xs text-ink-muted">{fmtMin(day.drive_duration_min)}</Text>
      </View>
      {day.notes ? <Text className="text-xs italic text-ink-muted">{day.notes}</Text> : null}

      <View className="gap-2 border-t border-border/60 pt-2">
        {day.items.map((item) => {
          const Icon = ITEM_ICON[item.type] ?? Car;
          return (
            <View key={item.id} className="flex-row items-start gap-2.5">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-muted">
                <Icon size={15} color="#1B6B3F" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-ink">{item.label}</Text>
                <Text className="text-[11px] text-ink-muted">
                  {item.start_time ?? "—"}
                  {item.end_time ? ` – ${item.end_time}` : ""} · {fmtMin(item.duration_min)} · {fmtInr(item.cost_inr)}
                </Text>
                {item.notes ? <Text className="text-[11px] italic text-ink-muted">{item.notes}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

export default function ItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = String(id);
  const queryClient = useQueryClient();
  const queryKey = ["travel-itinerary", tripId];

  const itineraryQuery = useQuery({ queryKey, queryFn: () => buildItinerary(tripId) });

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["bottom"]}>
      <ScreenHeader
        title="Itinerary"
        showBack
        right={
          <Button
            label="Rebuild"
            size="md"
            variant="secondary"
            icon={<RefreshCw size={14} color="#0E4429" />}
            loading={itineraryQuery.isFetching}
            onPress={() => queryClient.invalidateQueries({ queryKey })}
          />
        }
      />
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, paddingBottom: 48, gap: 12 }}>
        {itineraryQuery.isLoading ? (
          <LoadingSkeleton variant="list" rows={3} />
        ) : itineraryQuery.isError ? (
          <ErrorState
            title="Could not build itinerary"
            description={itineraryQuery.error instanceof ApiError ? itineraryQuery.error.message : "Please try again."}
            onRetry={() => queryClient.invalidateQueries({ queryKey })}
          />
        ) : !itineraryQuery.data || itineraryQuery.data.length === 0 ? (
          <Text className="py-12 text-center text-sm text-ink-muted">No itinerary could be built — add checkpoints to this trip first.</Text>
        ) : (
          itineraryQuery.data.map((day) => <DayCard key={day.id} day={day} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
