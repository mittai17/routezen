import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  Calendar,
  Users,
  MapPin,
  Route as RouteIcon,
  Navigation2,
  Hotel,
  ListChecks,
  Save,
} from "lucide-react-native";
import {
  ApiError,
  getTrip,
  getTripBudget,
  listCheckpoints,
  updateTrip,
  type RouteOption,
} from "../../../../lib/api/travel";
import { Button, Card, ErrorState, LoadingSkeleton, ScreenHeader, StatusBadge } from "../../../../components/ui";
import { fmtInr, fmtKm, inputClassName } from "../_shared";

function NavRow({ icon, label, sub, onPress }: { icon: React.ReactNode; label: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3.5 active:bg-muted">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-green/10">{icon}</View>
        <View>
          <Text className="text-sm font-semibold text-ink">{label}</Text>
          {sub ? <Text className="text-xs text-ink-muted">{sub}</Text> : null}
        </View>
      </View>
      <Text className="text-ink-muted">{"›"}</Text>
    </Pressable>
  );
}

export default function TripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = String(id);
  const queryClient = useQueryClient();
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  const tripQuery = useQuery({ queryKey: ["travel-trip", tripId], queryFn: () => getTrip(tripId) });
  const checkpointsQuery = useQuery({ queryKey: ["travel-checkpoints", tripId], queryFn: () => listCheckpoints(tripId) });
  const budgetQuery = useQuery({ queryKey: ["travel-budget", tripId], queryFn: () => getTripBudget(tripId) });

  const cachedRoutes = queryClient.getQueryData<RouteOption[]>(["route-options", tripId]);

  const saveNotesMutation = useMutation({
    mutationFn: (notes: string) => updateTrip(tripId, { notes }),
    onSuccess: (trip) => {
      queryClient.setQueryData(["travel-trip", tripId], trip);
      setNotesDraft(null);
    },
  });

  if (tripQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-muted" edges={["bottom"]}>
        <ScreenHeader title="Trip Details" showBack />
        <View className="p-4">
          <LoadingSkeleton variant="list" rows={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (tripQuery.isError || !tripQuery.data) {
    return (
      <SafeAreaView className="flex-1 bg-muted" edges={["bottom"]}>
        <ScreenHeader title="Trip Details" showBack />
        <ErrorState
          description={tripQuery.error instanceof ApiError ? tripQuery.error.message : "Could not load this trip."}
          onRetry={() => tripQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  const trip = tripQuery.data;
  const checkpoints = checkpointsQuery.data ?? [];
  const travellers = trip.adults + trip.children + trip.older_travellers;
  const notesValue = notesDraft ?? trip.notes ?? "";

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["bottom"]}>
      <ScreenHeader title={trip.name} subtitle={`${trip.origin_name} → ${trip.destination_name}`} showBack />
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, paddingBottom: 48, gap: 12 }}>
        <Card className="gap-3">
          <View className="flex-row items-center justify-between">
            <StatusBadge label={trip.status} tone={trip.status === "active" ? "success" : "info"} />
            <Text className="text-xs text-ink-muted">{trip.travel_mode}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Calendar size={14} color="#5B6B60" />
            <Text className="text-sm text-ink">{trip.departure_date ?? "No departure date set"}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Users size={14} color="#5B6B60" />
            <Text className="text-sm text-ink">
              {travellers} traveller{travellers === 1 ? "" : "s"} ({trip.adults} adult{trip.adults === 1 ? "" : "s"}
              {trip.children ? `, ${trip.children} child.` : ""}
              {trip.older_travellers ? `, ${trip.older_travellers} senior` : ""})
            </Text>
          </View>
        </Card>

        <Card className="gap-2">
          <Text className="text-sm font-bold text-ink">Ordered checkpoints ({checkpoints.length})</Text>
          {checkpointsQuery.isLoading ? (
            <LoadingSkeleton variant="text" />
          ) : checkpoints.length === 0 ? (
            <Text className="text-xs text-ink-muted">No checkpoints saved for this trip yet.</Text>
          ) : (
            checkpoints
              .sort((a, b) => a.sequence - b.sequence)
              .map((cp, idx) => (
                <View key={cp.id} className="flex-row items-center gap-2 border-b border-border/60 py-1.5 last:border-b-0">
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-muted">
                    <Text className="text-[10px] font-bold text-ink-muted">{idx + 1}</Text>
                  </View>
                  <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
                    {cp.name}
                  </Text>
                  <Text className="text-[11px] text-ink-muted">{cp.type}</Text>
                  {cp.distance_from_prev_km != null ? (
                    <Text className="text-[11px] text-ink-muted">{fmtKm(cp.distance_from_prev_km)}</Text>
                  ) : null}
                </View>
              ))
          )}
          <Button label="Manage Checkpoints" variant="secondary" onPress={() => router.push(`/travel/${tripId}/checkpoints`)} className="mt-1" />
        </Card>

        <Card className="gap-2">
          <View className="flex-row items-center gap-2">
            <Wallet size={16} color="#1B6B3F" />
            <Text className="text-sm font-bold text-ink">Cost & emissions basis</Text>
          </View>
          {budgetQuery.isLoading ? (
            <LoadingSkeleton variant="text" />
          ) : budgetQuery.isError ? (
            <Text className="text-xs text-danger">Could not load budget.</Text>
          ) : budgetQuery.data ? (
            <>
              <View className="flex-row justify-between">
                <Text className="text-xs text-ink-muted">Estimated total</Text>
                <Text className="text-sm font-bold text-ink">{fmtInr(budgetQuery.data.estimated_total_inr)}</Text>
              </View>
              {budgetQuery.data.target_budget_inr != null ? (
                <View className="flex-row justify-between">
                  <Text className="text-xs text-ink-muted">Your target budget</Text>
                  <Text className={`text-sm font-semibold ${budgetQuery.data.over_budget ? "text-danger" : "text-success"}`}>
                    {fmtInr(budgetQuery.data.target_budget_inr)} {budgetQuery.data.over_budget ? "(over)" : "(within)"}
                  </Text>
                </View>
              ) : null}
              <Text className="mt-1 text-[11px] text-ink-muted">{budgetQuery.data.assumptions[0]}</Text>
            </>
          ) : null}
          <Button label="View Full Budget" variant="secondary" onPress={() => router.push(`/travel/${tripId}/budget`)} className="mt-1" />
        </Card>

        <Card className="gap-2">
          <Text className="text-sm font-bold text-ink">Route alternatives</Text>
          {cachedRoutes && cachedRoutes.length > 0 ? (
            cachedRoutes.map((r) => (
              <View key={r.id} className="flex-row items-center justify-between border-b border-border/60 py-1.5 last:border-b-0">
                <Text className="flex-1 text-sm text-ink">{r.label}</Text>
                <Text className="text-xs text-ink-muted">{fmtKm(r.total_distance_km)}</Text>
              </View>
            ))
          ) : (
            <Text className="text-xs text-ink-muted">No route options generated yet for this trip.</Text>
          )}
          <Button label="Find / Compare Routes" onPress={() => router.push(`/travel/${tripId}/routes`)} className="mt-1" />
        </Card>

        <Card className="gap-3">
          <Text className="text-sm font-bold text-ink">Notes</Text>
          <TextInput
            className={`${inputClassName} min-h-[70px]`}
            multiline
            textAlignVertical="top"
            value={notesValue}
            onChangeText={setNotesDraft}
            placeholder="Add trip notes…"
          />
          <Button
            label="Save Notes"
            variant="secondary"
            icon={<Save size={15} color="#0E4429" />}
            loading={saveNotesMutation.isPending}
            disabled={notesDraft === null || notesDraft === (trip.notes ?? "")}
            onPress={() => notesDraft !== null && saveNotesMutation.mutate(notesDraft)}
          />
        </Card>

        <View className="gap-2">
          <NavRow icon={<RouteIcon size={16} color="#0E4429" />} label="Route options" sub="Compare and select" onPress={() => router.push(`/travel/${tripId}/routes`)} />
          <NavRow icon={<ListChecks size={16} color="#0E4429" />} label="Itinerary" sub="Day-by-day plan" onPress={() => router.push(`/travel/${tripId}/itinerary`)} />
          <NavRow icon={<Hotel size={16} color="#0E4429" />} label="Stays, food & attractions" sub="Real places along the route" onPress={() => router.push(`/travel/${tripId}/places`)} />
          <NavRow icon={<Navigation2 size={16} color="#0E4429" />} label="Route preview" sub="Not live navigation" onPress={() => router.push(`/travel/${tripId}/preview`)} />
          <NavRow icon={<MapPin size={16} color="#0E4429" />} label="Checkpoints" sub="Add, remove, reorder stops" onPress={() => router.push(`/travel/${tripId}/checkpoints`)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
