import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Moon, Plus, Trash2 } from "lucide-react-native";
import {
  ApiError,
  addCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  reorderCheckpoints,
  updateCheckpoint,
  type TravelCheckpoint,
} from "../../../../lib/api/travel";
import { Button, Card, ErrorState, LoadingSkeleton, ScreenHeader, StatusBadge } from "../../../../components/ui";
import { fmtKm, fmtMin, inputClassName } from "../../../../components/travel/shared";

export default function CheckpointsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = String(id);
  const queryClient = useQueryClient();
  const queryKey = ["travel-checkpoints", tripId];

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");
  const [newOvernight, setNewOvernight] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const checkpointsQuery = useQuery({ queryKey, queryFn: () => listCheckpoints(tripId) });
  const checkpoints = [...(checkpointsQuery.data ?? [])].sort((a, b) => a.sequence - b.sequence);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
  }

  const addMutation = useMutation({
    mutationFn: () =>
      addCheckpoint(tripId, {
        sequence: Math.max(0, checkpoints.length - 1),
        name: newName,
        lat: Number(newLat),
        lng: Number(newLng),
        type: "optional",
        is_mandatory: false,
        stay_overnight: newOvernight,
      }),
    onSuccess: () => {
      invalidate();
      setAdding(false);
      setNewName("");
      setNewLat("");
      setNewLng("");
      setNewOvernight(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ cid, patch }: { cid: string; patch: Partial<TravelCheckpoint> }) => updateCheckpoint(tripId, cid, patch),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (cid: string) => deleteCheckpoint(tripId, cid),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => reorderCheckpoints(tripId, ids),
    onSuccess: invalidate,
  });

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target <= 0 || target >= checkpoints.length - 1 || index <= 0 || index >= checkpoints.length - 1) return; // keep origin/destination pinned
    const ids = checkpoints.map((c) => c.id);
    const tmp = ids[index];
    ids[index] = ids[target];
    ids[target] = tmp;
    reorderMutation.mutate(ids);
  }

  function submitAdd() {
    setFormError(null);
    if (!newName.trim()) return setFormError("Stop name is required.");
    const lat = Number(newLat);
    const lng = Number(newLng);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) return setFormError("Latitude must be between -90 and 90.");
    if (Number.isNaN(lng) || lng < -180 || lng > 180) return setFormError("Longitude must be between -180 and 180.");
    addMutation.mutate();
  }

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["bottom"]}>
      <ScreenHeader title="Checkpoints" showBack />
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, paddingBottom: 48, gap: 10 }}>
        {checkpointsQuery.isLoading ? (
          <LoadingSkeleton variant="list" rows={3} />
        ) : checkpointsQuery.isError ? (
          <ErrorState
            description={checkpointsQuery.error instanceof ApiError ? checkpointsQuery.error.message : "Could not load checkpoints."}
            onRetry={() => checkpointsQuery.refetch()}
          />
        ) : (
          checkpoints.map((cp, idx) => {
            const isOrigin = idx === 0;
            const isDestination = idx === checkpoints.length - 1;
            return (
              <Card key={cp.id} className="gap-2">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 flex-row items-center gap-2">
                    <View
                      className={`h-7 w-7 items-center justify-center rounded-full ${
                        isOrigin ? "bg-success" : isDestination ? "bg-danger" : "bg-brand-green"
                      }`}
                    >
                      <Text className="text-[10px] font-bold text-white">{isOrigin ? "S" : isDestination ? "E" : idx}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                        {cp.name}
                      </Text>
                      {cp.distance_from_prev_km != null ? (
                        <Text className="text-[11px] text-ink-muted">
                          {fmtKm(cp.distance_from_prev_km)}
                          {cp.duration_from_prev_min != null ? ` · ${fmtMin(cp.duration_from_prev_min)} drive` : ""}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {!isOrigin && !isDestination ? (
                    <View className="flex-row items-center gap-1">
                      <Pressable disabled={idx <= 1} onPress={() => move(idx, -1)} className="h-8 w-8 items-center justify-center rounded-lg active:bg-muted disabled:opacity-30">
                        <ArrowUp size={16} color="#5B6B60" />
                      </Pressable>
                      <Pressable disabled={idx >= checkpoints.length - 2} onPress={() => move(idx, 1)} className="h-8 w-8 items-center justify-center rounded-lg active:bg-muted disabled:opacity-30">
                        <ArrowDown size={16} color="#5B6B60" />
                      </Pressable>
                      <Pressable onPress={() => deleteMutation.mutate(cp.id)} className="h-8 w-8 items-center justify-center rounded-lg active:bg-danger/10">
                        <Trash2 size={16} color="#B3261E" />
                      </Pressable>
                    </View>
                  ) : (
                    <StatusBadge label={isOrigin ? "Origin" : "Destination"} tone={isOrigin ? "success" : "danger"} />
                  )}
                </View>

                {!isOrigin && !isDestination ? (
                  <View className="flex-row items-center gap-4 border-t border-border/60 pt-2">
                    <Pressable
                      onPress={() => updateMutation.mutate({ cid: cp.id, patch: { is_mandatory: !cp.is_mandatory, type: !cp.is_mandatory ? "mandatory" : "optional" } })}
                      className="flex-row items-center gap-1.5"
                    >
                      <View className={`h-4 w-4 items-center justify-center rounded border ${cp.is_mandatory ? "border-brand-green bg-brand-green" : "border-border"}`}>
                        {cp.is_mandatory ? <Text className="text-[9px] font-bold text-white">✓</Text> : null}
                      </View>
                      <Text className="text-xs text-ink">Mandatory</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => updateMutation.mutate({ cid: cp.id, patch: { stay_overnight: !cp.stay_overnight } })}
                      className="flex-row items-center gap-1.5"
                    >
                      <View className={`h-4 w-4 items-center justify-center rounded border ${cp.stay_overnight ? "border-brand-green bg-brand-green" : "border-border"}`}>
                        {cp.stay_overnight ? <Moon size={10} color="#FFFFFF" /> : null}
                      </View>
                      <Text className="text-xs text-ink">Overnight</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            );
          })
        )}

        {adding ? (
          <Card className="gap-2">
            <Text className="text-sm font-bold text-ink">New checkpoint</Text>
            {formError ? <Text className="text-xs text-danger">{formError}</Text> : null}
            <TextInput className={inputClassName} placeholder="Name" value={newName} onChangeText={setNewName} />
            <View className="flex-row gap-2">
              <TextInput className={`${inputClassName} flex-1`} placeholder="Latitude" keyboardType="numbers-and-punctuation" value={newLat} onChangeText={setNewLat} />
              <TextInput className={`${inputClassName} flex-1`} placeholder="Longitude" keyboardType="numbers-and-punctuation" value={newLng} onChangeText={setNewLng} />
            </View>
            <Pressable onPress={() => setNewOvernight((v) => !v)} className="flex-row items-center gap-1.5">
              <View className={`h-4 w-4 items-center justify-center rounded border ${newOvernight ? "border-brand-green bg-brand-green" : "border-border"}`}>
                {newOvernight ? <Text className="text-[9px] font-bold text-white">✓</Text> : null}
              </View>
              <Text className="text-xs text-ink">Plan an overnight stay here</Text>
            </Pressable>
            <View className="flex-row gap-2">
              <Button label="Cancel" variant="secondary" className="flex-1" onPress={() => setAdding(false)} />
              <Button label="Add" className="flex-1" loading={addMutation.isPending} onPress={submitAdd} />
            </View>
          </Card>
        ) : (
          <Button label="Add Checkpoint" icon={<Plus size={16} color="#FFFFFF" />} onPress={() => setAdding(true)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
