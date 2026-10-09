import React from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { MapPin, Plus, Calendar, Users, Compass } from "lucide-react-native";
import { listTrips, type TravelTrip } from "../../../lib/api/travel";
import { Button, Card, EmptyState, ErrorState, LoadingSkeleton, ScreenHeader, StatusBadge, type StatusTone } from "../../../components/ui";

const STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  planned: "info",
  active: "success",
  completed: "neutral",
  archived: "neutral",
};

function TripCard({ trip }: { trip: TravelTrip }) {
  const travellers = trip.adults + trip.children + trip.older_travellers;
  return (
    <Card onPress={() => router.push(`/travel/${trip.id}`)} accessibilityLabel={`Open trip ${trip.name}`} className="mb-3">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-base font-bold text-ink">{trip.name}</Text>
        <StatusBadge label={trip.status} tone={STATUS_TONE[trip.status] ?? "neutral"} />
      </View>
      <View className="mt-2 flex-row items-center gap-1.5">
        <MapPin size={14} color="#1B6B3F" />
        <Text className="flex-1 text-sm text-ink-muted" numberOfLines={1}>
          {trip.origin_name} {"→"} {trip.destination_name}
        </Text>
      </View>
      <View className="mt-2 flex-row items-center gap-4">
        <View className="flex-row items-center gap-1">
          <Calendar size={13} color="#5B6B60" />
          <Text className="text-xs text-ink-muted">{trip.departure_date ?? "No date set"}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Users size={13} color="#5B6B60" />
          <Text className="text-xs text-ink-muted">
            {travellers} traveller{travellers === 1 ? "" : "s"}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export default function TravelHomeScreen() {
  const { data: trips, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["travel-trips"],
    queryFn: listTrips,
  });

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["bottom"]}>
      <ScreenHeader
        title="Smart Travel"
        subtitle="Plan, compare and track road trips"
        right={
          <Pressable
            onPress={() => router.push("/travel/new")}
            accessibilityRole="button"
            accessibilityLabel="Plan a new trip"
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-full bg-brand-green active:bg-brand-green-light"
          >
            <Plus size={20} color="#FFFFFF" />
          </Pressable>
        }
      />

      <View className="flex-1 px-4 pt-4">
        {isLoading ? (
          <LoadingSkeleton variant="list" rows={4} />
        ) : isError ? (
          <ErrorState
            description={error instanceof Error ? error.message : "Could not load trips."}
            onRetry={() => refetch()}
          />
        ) : !trips || trips.length === 0 ? (
          <EmptyState
            icon={<Compass size={28} color="#5B6B60" />}
            title="No trips yet"
            description="Plan your first road trip — pick an origin, destination and stops, then compare real routes."
            actionLabel="Plan a Trip"
            onAction={() => router.push("/travel/new")}
          />
        ) : (
          <FlatList
            data={trips}
            keyExtractor={(t) => t.id}
            renderItem={({ item }) => <TripCard trip={item} />}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
            contentContainerStyle={{ paddingBottom: 96 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {trips && trips.length > 0 ? (
        <View className="absolute bottom-6 left-4 right-4">
          <Button label="Plan a New Trip" size="lg" icon={<Plus size={18} color="#FFFFFF" />} onPress={() => router.push("/travel/new")} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
