import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router, useLocalSearchParams } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Button,
  Card,
  ErrorState,
  FormField,
  LoadingSkeleton,
  ScreenHeader,
} from "../../../../../components/ui";
import {
  getLocation,
  updateLocation,
  LOCATION_TYPE_LABELS,
  type LocationInput,
  type LocationType,
} from "../../../../../lib/api/locations";

const locationTypes: LocationType[] = ["depot", "stop", "warehouse"];

const locationFormSchema = z.object({
  name: z.string().trim().min(1, "Place name is required").max(200, "Max 200 characters"),
  address: z.string().trim().max(500, "Max 500 characters"),
  latitude: z
    .string()
    .trim()
    .min(1, "Latitude is required")
    .refine(
      (val) => {
        const num = Number(val);
        return !Number.isNaN(num) && num >= -90 && num <= 90;
      },
      { message: "Must be a valid latitude between -90 and 90" }
    ),
  longitude: z
    .string()
    .trim()
    .min(1, "Longitude is required")
    .refine(
      (val) => {
        const num = Number(val);
        return !Number.isNaN(num) && num >= -180 && num <= 180;
      },
      { message: "Must be a valid longitude between -180 and 180" }
    ),
  type: z.enum(["depot", "stop", "warehouse"]),
  zone: z.string().trim().max(100, "Max 100 characters"),
  notes: z.string().trim().max(1000, "Max 1000 characters"),
});

type LocationFormData = z.infer<typeof locationFormSchema>;

export default function EditSavedPlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: location,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["locations", id],
    queryFn: ({ signal }) => (id ? getLocation(id, signal) : Promise.reject(new Error("Missing ID"))),
    enabled: !!id,
  });

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<LocationFormData>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: "",
      address: "",
      latitude: "",
      longitude: "",
      type: "stop",
      zone: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (location) {
      reset({
        name: location.name,
        address: location.address ?? "",
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        type: location.type,
        zone: location.zone ?? "",
        notes: location.notes ?? "",
      });
    }
  }, [location, reset]);

  const selectedType = useWatch({ control, name: "type" });

  const mutation = useMutation({
    mutationFn: (data: LocationFormData) => {
      const input: LocationInput = {
        name: data.name.trim(),
        address: data.address.trim() || null,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        type: data.type,
        zone: data.zone.trim() || null,
        notes: data.notes.trim() || null,
      };
      return updateLocation(id!, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations", id] });
      router.back();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to update location";
      setErrorMessage(message);
    },
  });

  const onSubmit = (data: LocationFormData) => {
    setErrorMessage(null);
    mutation.mutate(data);
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title="Edit Place"
        subtitle={location ? location.name : "Modify place details"}
        showBack
      />

      {isLoading ? (
        <View className="p-4 gap-4">
          <LoadingSkeleton rows={4} variant="list" />
        </View>
      ) : isError || !location ? (
        <ErrorState
          title="Could not load place"
          description="Failed to load location details. Please verify your connection."
          onRetry={() => refetch()}
        />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            className="flex-1"
            contentContainerClassName="p-4 gap-4 pb-12"
            keyboardShouldPersistTaps="handled"
          >
            {errorMessage ? (
              <Card className="border-danger/30 bg-danger/10">
                <Text className="text-sm font-semibold text-danger">
                  {errorMessage}
                </Text>
              </Card>
            ) : null}

            {/* Place Type Picker */}
            <View className="gap-2">
              <Text className="text-sm font-medium text-ink">Place Type *</Text>
              <View className="flex-row gap-2">
                {locationTypes.map((t) => {
                  const isSelected = selectedType === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setValue("type", t)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      className={`flex-1 items-center justify-center rounded-pill border py-2.5 px-3 ${
                        isSelected
                          ? "border-brand-green bg-brand-green"
                          : "border-border bg-surface"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold capitalize ${
                          isSelected ? "text-white" : "text-ink"
                        }`}
                      >
                        {LOCATION_TYPE_LABELS[t]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Name Field */}
            <FormField
              label="Place Name"
              required
              error={errors.name?.message}
              helperText="A descriptive title for this location"
            >
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Central Distribution Hub"
                    placeholderTextColor="#5B6B60"
                    className="min-h-[48px] rounded-card border border-border bg-surface px-3.5 text-base text-ink"
                  />
                )}
              />
            </FormField>

            {/* Address Field */}
            <FormField
              label="Street Address"
              error={errors.address?.message}
              helperText="Physical street address or delivery instructions"
            >
              <Controller
                control={control}
                name="address"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. 42 Industrial Park Way"
                    placeholderTextColor="#5B6B60"
                    multiline
                    numberOfLines={2}
                    className="min-h-[64px] rounded-card border border-border bg-surface p-3 text-base text-ink"
                  />
                )}
              />
            </FormField>

            {/* Coordinate Fields */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField
                  label="Latitude"
                  required
                  error={errors.latitude?.message}
                  helperText="-90.0 to 90.0"
                >
                  <Controller
                    control={control}
                    name="latitude"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="e.g. 13.0827"
                        placeholderTextColor="#5B6B60"
                        keyboardType="numeric"
                        className="min-h-[48px] rounded-card border border-border bg-surface px-3.5 text-base text-ink"
                      />
                    )}
                  />
                </FormField>
              </View>
              <View className="flex-1">
                <FormField
                  label="Longitude"
                  required
                  error={errors.longitude?.message}
                  helperText="-180.0 to 180.0"
                >
                  <Controller
                    control={control}
                    name="longitude"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="e.g. 80.2707"
                        placeholderTextColor="#5B6B60"
                        keyboardType="numeric"
                        className="min-h-[48px] rounded-card border border-border bg-surface px-3.5 text-base text-ink"
                      />
                    )}
                  />
                </FormField>
              </View>
            </View>

            {/* Zone Field */}
            <FormField
              label="Dispatch Zone"
              error={errors.zone?.message}
              helperText="Optional partition or territory (e.g. North, Zone-A)"
            >
              <Controller
                control={control}
                name="zone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. North Zone"
                    placeholderTextColor="#5B6B60"
                    className="min-h-[48px] rounded-card border border-border bg-surface px-3.5 text-base text-ink"
                  />
                )}
              />
            </FormField>

            {/* Notes Field */}
            <FormField
              label="Operational Notes"
              error={errors.notes?.message}
              helperText="Dock hours, access codes, forklift requirements"
            >
              <Controller
                control={control}
                name="notes"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Loading dock 3 is accessible 24/7"
                    placeholderTextColor="#5B6B60"
                    multiline
                    numberOfLines={3}
                    className="min-h-[80px] rounded-card border border-border bg-surface p-3 text-base text-ink"
                  />
                )}
              />
            </FormField>

            {/* Action Buttons */}
            <View className="mt-4 flex-row gap-3">
              <View className="flex-1">
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => router.back()}
                  disabled={mutation.isPending}
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Save Changes"
                  variant="primary"
                  loading={mutation.isPending}
                  onPress={handleSubmit(onSubmit)}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
