import { useState, useMemo } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit2,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react-native";

import {
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  ScreenHeader,
  StatusBadge,
  type StatusTone,
} from "../../../../components/ui";
import {
  deleteLocation,
  listLocations,
  LOCATION_TYPE_LABELS,
  type Location,
  type LocationType,
} from "../../../../lib/api/locations";

const FILTER_TYPES: { id: "all" | LocationType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "depot", label: "Depots" },
  { id: "stop", label: "Stops" },
  { id: "warehouse", label: "Warehouses" },
];

function getBadgeTone(type: LocationType): StatusTone {
  switch (type) {
    case "depot":
      return "success";
    case "warehouse":
      return "info";
    case "stop":
    default:
      return "neutral";
  }
}

export default function SavedPlacesListScreen() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | LocationType>("all");
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["locations"],
    queryFn: ({ signal }) => listLocations({ limit: 100, signal }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      setLocationToDelete(null);
    },
    onError: () => {
      setLocationToDelete(null);
    },
  });

  const filteredLocations = useMemo(() => {
    if (!data?.items) return [];
    let items = data.items;

    if (selectedType !== "all") {
      items = items.filter((loc) => loc.type === selectedType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(
        (loc) =>
          loc.name.toLowerCase().includes(q) ||
          (loc.address && loc.address.toLowerCase().includes(q)) ||
          (loc.zone && loc.zone.toLowerCase().includes(q))
      );
    }

    return items;
  }, [data, selectedType, searchQuery]);

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title="Saved Places"
        subtitle="Manage hubs, depots, stops & warehouses"
        showBack
        right={
          <Pressable
            onPress={() => router.push("/profile/places/new")}
            accessibilityRole="button"
            accessibilityLabel="Add new place"
            hitSlop={8}
            className="flex-row items-center gap-1 rounded-pill bg-brand-green px-3 py-2 active:bg-brand-green-light"
          >
            <Plus size={16} color="#FFFFFF" />
            <Text className="text-xs font-semibold text-white">Add</Text>
          </Pressable>
        }
      />

      {/* Search Bar & Type Filter Chips */}
      <View className="border-b border-border bg-surface px-4 py-3 gap-3">
        <View className="flex-row items-center rounded-pill border border-border bg-muted/30 px-3 py-2">
          <Search size={18} color="#5B6B60" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, address, or zone..."
            placeholderTextColor="#5B6B60"
            className="flex-1 ml-2 text-sm text-ink"
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <X size={16} color="#5B6B60" />
            </Pressable>
          ) : null}
        </View>

        {/* Filters */}
        <View className="flex-row gap-2">
          {FILTER_TYPES.map((f) => {
            const isSelected = selectedType === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setSelectedType(f.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={`rounded-pill border px-3 py-1.5 ${
                  isSelected
                    ? "border-brand-green bg-brand-green"
                    : "border-border bg-surface"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    isSelected ? "text-white" : "text-ink"
                  }`}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* List / Loading / Error / Empty Content */}
      {isLoading ? (
        <View className="p-4 gap-3">
          <LoadingSkeleton rows={4} variant="list" />
        </View>
      ) : isError ? (
        <ErrorState
          title="Could not load places"
          description="Failed to load saved locations. Please check your network and retry."
          onRetry={() => refetch()}
        />
      ) : filteredLocations.length === 0 ? (
        <EmptyState
          icon={<MapPin size={32} color="#5B6B60" />}
          title={searchQuery || selectedType !== "all" ? "No matches found" : "No saved places yet"}
          description={
            searchQuery || selectedType !== "all"
              ? "Try adjusting your search query or filter type."
              : "Save your depots, delivery stops, or warehouse coordinates for easy dispatch routing."
          }
          actionLabel={searchQuery || selectedType !== "all" ? "Clear Filters" : "Add Saved Place"}
          onAction={
            searchQuery || selectedType !== "all"
              ? () => {
                  setSearchQuery("");
                  setSelectedType("all");
                }
              : () => router.push("/profile/places/new")
          }
        />
      ) : (
        <FlatList
          data={filteredLocations}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 gap-3 pb-16"
          renderItem={({ item }) => (
            <Card className="gap-2.5">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-ink" numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.address ? (
                    <Text className="mt-0.5 text-xs text-ink-muted" numberOfLines={2}>
                      {item.address}
                    </Text>
                  ) : null}
                </View>
                <StatusBadge
                  label={LOCATION_TYPE_LABELS[item.type]}
                  tone={getBadgeTone(item.type)}
                />
              </View>

              {/* Coordinates and Zone */}
              <View className="flex-row flex-wrap items-center gap-3 pt-1 border-t border-border/60">
                <View className="flex-row items-center gap-1">
                  <MapPin size={13} color="#5B6B60" />
                  <Text className="text-xs text-ink-muted">
                    {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                  </Text>
                </View>

                {item.zone ? (
                  <View className="rounded-md bg-muted px-2 py-0.5">
                    <Text className="text-[11px] font-medium text-ink-muted">
                      Zone: {item.zone}
                    </Text>
                  </View>
                ) : null}
              </View>

              {item.notes ? (
                <Text className="text-xs italic text-ink-muted" numberOfLines={2}>
                  {item.notes}
                </Text>
              ) : null}

              {/* Action Buttons */}
              <View className="mt-1 flex-row justify-end gap-2 pt-2 border-t border-border/40">
                <Pressable
                  onPress={() => router.push(`/profile/places/${item.id}/edit`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}`}
                  hitSlop={6}
                  className="flex-row items-center gap-1 rounded-pill border border-border px-3 py-1.5 active:bg-muted"
                >
                  <Edit2 size={13} color="#0E1A14" />
                  <Text className="text-xs font-semibold text-ink">Edit</Text>
                </Pressable>

                <Pressable
                  onPress={() => setLocationToDelete(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                  hitSlop={6}
                  className="flex-row items-center gap-1 rounded-pill border border-danger/40 bg-danger/10 px-3 py-1.5 active:bg-danger/20"
                >
                  <Trash2 size={13} color="#B3261E" />
                  <Text className="text-xs font-semibold text-danger">Delete</Text>
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        visible={!!locationToDelete}
        title="Delete Saved Place"
        description={
          locationToDelete
            ? `Are you sure you want to delete "${locationToDelete.name}"? This location will no longer be available for dispatch planning.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (locationToDelete) {
            deleteMutation.mutate(locationToDelete.id);
          }
        }}
        onCancel={() => setLocationToDelete(null)}
      />
    </View>
  );
}
