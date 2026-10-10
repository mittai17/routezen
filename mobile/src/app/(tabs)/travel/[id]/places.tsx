import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Star, MapPin } from "lucide-react-native";
import { ApiError, listAttractions, listRestaurants, listStays, type TravelPlace } from "../../../../lib/api/travel";
import { Card, ErrorState, LoadingSkeleton, ScreenHeader, StatusBadge } from "../../../../components/ui";
import { fmtInr } from "../../../../components/travel/shared";

const CATEGORIES = [
  { id: "stay", label: "Stays" },
  { id: "restaurant", label: "Restaurants" },
  { id: "attraction", label: "Attractions" },
] as const;

type Category = (typeof CATEGORIES)[number]["id"];

function PlaceCard({ place }: { place: TravelPlace }) {
  return (
    <Card className="gap-1.5">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-bold text-ink">{place.name}</Text>
        {/* Real backend field — never invented. Shown on every listing. */}
        <StatusBadge label={`source: ${place.source}`} tone="info" />
      </View>
      {place.address ? <Text className="text-xs text-ink-muted">{place.address}</Text> : null}
      <View className="flex-row flex-wrap items-center gap-3">
        {place.rating != null ? (
          <View className="flex-row items-center gap-1">
            <Star size={12} color="#D9A61E" fill="#D9A61E" />
            <Text className="text-xs text-ink">
              {place.rating.toFixed(1)}
              {place.review_count != null ? ` (${place.review_count})` : ""}
            </Text>
          </View>
        ) : null}
        {place.price_label ? <Text className="text-xs text-ink-muted">{place.price_label}</Text> : null}
        {place.entry_price_inr != null ? <Text className="text-xs text-ink-muted">Entry {fmtInr(place.entry_price_inr)}</Text> : null}
        {place.distance_from_route_km != null ? (
          <View className="flex-row items-center gap-1">
            <MapPin size={11} color="#5B6B60" />
            <Text className="text-xs text-ink-muted">{place.distance_from_route_km} km from route</Text>
          </View>
        ) : null}
      </View>
      {place.description ? (
        <Text className="text-xs text-ink-muted" numberOfLines={2}>
          {place.description}
        </Text>
      ) : null}
    </Card>
  );
}

export default function PlacesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = String(id);
  const [category, setCategory] = useState<Category>("stay");

  const query = useQuery({
    queryKey: ["travel-places", tripId, category],
    queryFn: () => {
      if (category === "stay") return listStays(tripId);
      if (category === "restaurant") return listRestaurants(tripId);
      return listAttractions(tripId);
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["bottom"]}>
      <ScreenHeader title="Stays, Food & Attractions" showBack />
      <View className="flex-row gap-2 px-4 pt-3">
        {CATEGORIES.map((c) => {
          const active = category === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategory(c.id)}
              className={`flex-1 items-center rounded-xl border px-3 py-2.5 ${active ? "border-brand-green bg-brand-green" : "border-border bg-surface"}`}
            >
              <Text className={`text-xs font-bold ${active ? "text-white" : "text-ink"}`}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 12, paddingBottom: 48, gap: 10 }}>
        {query.isLoading ? (
          <LoadingSkeleton variant="list" rows={3} />
        ) : query.isError ? (
          <ErrorState
            description={query.error instanceof ApiError ? query.error.message : "Could not load places."}
            onRetry={() => query.refetch()}
          />
        ) : !query.data || query.data.length === 0 ? (
          <Text className="py-12 text-center text-sm text-ink-muted">No {category} found along this route yet.</Text>
        ) : (
          query.data.map((p) => <PlaceCard key={p.id} place={p} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
