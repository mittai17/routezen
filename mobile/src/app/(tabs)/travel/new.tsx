import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDown, ArrowUp, MapPin, Plus, Trash2 } from "lucide-react-native";
import {
  ApiError,
  createTrip,
  loadTripDraft,
  saveTripDraft,
  clearTripDraft,
  TRAVEL_MODES,
  type CreateTripInput,
} from "../../../lib/api/travel";
import { Button, Card, ErrorState, FormField, ScreenHeader } from "../../../components/ui";
import { TRAVEL_MODE_META, inputClassName } from "./_shared";

// ── Popular-place lookup (client-side convenience only, same approach as the
// web planner's POPULAR_CITIES table — there is no geocoding endpoint on the
// backend, so coordinates must come from a lookup or manual entry). Never
// presented as live geocoding. ──────────────────────────────────────────
const POPULAR_PLACES: Record<string, { lat: number; lng: number; full: string }> = {
  chennai: { lat: 13.0827, lng: 80.2707, full: "Chennai, Tamil Nadu" },
  bengaluru: { lat: 12.9716, lng: 77.5946, full: "Bengaluru, Karnataka" },
  bangalore: { lat: 12.9716, lng: 77.5946, full: "Bengaluru, Karnataka" },
  goa: { lat: 15.2993, lng: 74.124, full: "Goa" },
  mumbai: { lat: 19.076, lng: 72.8777, full: "Mumbai, Maharashtra" },
  pune: { lat: 18.5204, lng: 73.8567, full: "Pune, Maharashtra" },
  delhi: { lat: 28.6139, lng: 77.209, full: "Delhi, NCR" },
  hyderabad: { lat: 17.385, lng: 78.4867, full: "Hyderabad, Telangana" },
  jaipur: { lat: 26.9124, lng: 75.7873, full: "Jaipur, Rajasthan" },
  kochi: { lat: 9.9312, lng: 76.2673, full: "Kochi, Kerala" },
  coimbatore: { lat: 11.0168, lng: 76.9558, full: "Coimbatore, Tamil Nadu" },
  mysuru: { lat: 12.2958, lng: 76.6394, full: "Mysuru, Karnataka" },
  pondicherry: { lat: 11.9416, lng: 79.8083, full: "Pondicherry, Puducherry" },
  vijayawada: { lat: 16.5062, lng: 80.648, full: "Vijayawada, Andhra Pradesh" },
  manali: { lat: 32.2396, lng: 77.1887, full: "Manali, Himachal Pradesh" },
};

function lookupPlace(text: string) {
  const norm = text.trim().toLowerCase();
  if (!norm) return [];
  return Object.entries(POPULAR_PLACES)
    .filter(([k]) => k.includes(norm))
    .slice(0, 5)
    .map(([, v]) => v);
}

const OBJECTIVES = [
  { id: "balanced", label: "Balanced" },
  { id: "fastest", label: "Fastest" },
  { id: "cheapest", label: "Cheapest" },
  { id: "shortest", label: "Shortest" },
  { id: "lowest_emissions", label: "Lowest Emissions" },
] as const;

function numField(label: string, min?: number, max?: number) {
  return z
    .string()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Number(v)), { message: `${label} must be a number` })
    .refine((v) => min === undefined || Number(v) >= min, { message: `${label} must be ≥ ${min}` })
    .refine((v) => max === undefined || Number(v) <= max, { message: `${label} must be ≤ ${max}` });
}

const checkpointSchema = z.object({
  name: z.string().min(1, "Stop name is required"),
  lat: numField("Latitude", -90, 90),
  lng: numField("Longitude", -180, 180),
  is_mandatory: z.boolean(),
  stay_overnight: z.boolean(),
  notes: z.string().optional(),
});

const plannerSchema = z.object({
  name: z.string().min(1, "Trip name is required"),
  originName: z.string().min(1, "Starting location is required"),
  originLat: numField("Origin latitude", -90, 90),
  originLng: numField("Origin longitude", -180, 180),
  destName: z.string().min(1, "Destination is required"),
  destLat: numField("Destination latitude", -90, 90),
  destLng: numField("Destination longitude", -180, 180),
  checkpoints: z.array(checkpointSchema),
  departureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
  departureTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h HH:MM")
    .optional()
    .or(z.literal("")),
  adults: numField("Adults", 1),
  children: numField("Children", 0),
  olderTravellers: numField("Senior travellers", 0),
  budgetInr: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), { message: "Budget must be a number" }),
  travelMode: z.enum(TRAVEL_MODES),
  objective: z.enum(["balanced", "fastest", "cheapest", "shortest", "lowest_emissions"]),
  notes: z.string().optional(),
});

type PlannerFormValues = z.infer<typeof plannerSchema>;

const DEFAULT_VALUES: PlannerFormValues = {
  name: "",
  originName: "",
  originLat: "",
  originLng: "",
  destName: "",
  destLat: "",
  destLng: "",
  checkpoints: [],
  departureDate: "",
  departureTime: "",
  adults: "2",
  children: "0",
  olderTravellers: "0",
  budgetInr: "",
  travelMode: "car",
  objective: "balanced",
  notes: "",
};

function LocationInput({
  label,
  required,
  nameValue,
  onNameChange,
  latValue,
  onLatChange,
  lngValue,
  onLngChange,
  nameError,
  latError,
  lngError,
}: {
  label: string;
  required?: boolean;
  nameValue: string;
  onNameChange: (name: string, coords?: { lat: number; lng: number }) => void;
  latValue: string;
  onLatChange: (v: string) => void;
  lngValue: string;
  onLngChange: (v: string) => void;
  nameError?: string;
  latError?: string;
  lngError?: string;
}) {
  const suggestions = lookupPlace(nameValue);
  return (
    <View className="gap-1.5">
      <FormField label={label} required={required} error={nameError}>
        <TextInput
          className={inputClassName}
          placeholder="City or address"
          value={nameValue}
          onChangeText={(t) => onNameChange(t)}
        />
      </FormField>
      {suggestions.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <Pressable
              key={s.full}
              onPress={() => onNameChange(s.full, { lat: s.lat, lng: s.lng })}
              className="rounded-lg border border-border bg-muted px-2.5 py-1"
            >
              <Text className="text-xs text-ink">{s.full}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <FormField label="Latitude" error={latError}>
            <TextInput className={inputClassName} keyboardType="numbers-and-punctuation" value={latValue} onChangeText={onLatChange} placeholder="e.g. 13.0827" />
          </FormField>
        </View>
        <View className="flex-1">
          <FormField label="Longitude" error={lngError}>
            <TextInput className={inputClassName} keyboardType="numbers-and-punctuation" value={lngValue} onChangeText={onLngChange} placeholder="e.g. 80.2707" />
          </FormField>
        </View>
      </View>
      <Text className="text-[11px] text-ink-muted">
        Pick a suggestion or enter coordinates manually — there is no address geocoder on the backend yet.
      </Text>
    </View>
  );
}

export default function PlanTripScreen() {
  const queryClient = useQueryClient();
  const [draftAvailable, setDraftAvailable] = useState<{ savedAt: string; draft: PlannerFormValues } | null>(null);

  const {
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<PlannerFormValues>({
    resolver: zodResolver(plannerSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: "checkpoints" });

  useEffect(() => {
    loadTripDraft<PlannerFormValues>().then((d) => {
      if (d) setDraftAvailable(d);
    });
  }, []);

  const createMutation = useMutation({
    mutationFn: (input: CreateTripInput) => createTrip(input),
    onSuccess: async (trip) => {
      await clearTripDraft();
      queryClient.invalidateQueries({ queryKey: ["travel-trips"] });
      router.replace(`/travel/${trip.id}/routes?objective=${getValues("objective")}`);
    },
    onError: async () => {
      await saveTripDraft(getValues());
    },
  });

  async function onSubmit(values: PlannerFormValues) {
    const departurePart = values.departureDate || null;
    const originDeparture =
      values.departureDate && values.departureTime
        ? `${values.departureDate}T${values.departureTime}:00`
        : values.departureDate
        ? `${values.departureDate}T06:00:00`
        : null;

    const intermediate = values.checkpoints.map((cp) => ({
      name: cp.name,
      lat: Number(cp.lat),
      lng: Number(cp.lng),
      type: cp.is_mandatory ? "mandatory" : "optional",
      is_mandatory: cp.is_mandatory,
      stay_overnight: cp.stay_overnight,
      notes: cp.notes || null,
    }));

    const checkpoints: CreateTripInput["checkpoints"] = [
      {
        sequence: 0,
        name: values.originName,
        lat: Number(values.originLat),
        lng: Number(values.originLng),
        type: "origin",
        is_mandatory: true,
        stay_overnight: false,
        planned_departure: originDeparture,
      },
      ...intermediate.map((cp, i) => ({ ...cp, sequence: i + 1 })),
      {
        sequence: intermediate.length + 1,
        name: values.destName,
        lat: Number(values.destLat),
        lng: Number(values.destLng),
        type: "destination",
        is_mandatory: true,
        stay_overnight: false,
      },
    ];

    const input: CreateTripInput = {
      name: values.name,
      origin_name: values.originName,
      origin_lat: Number(values.originLat),
      origin_lng: Number(values.originLng),
      destination_name: values.destName,
      destination_lat: Number(values.destLat),
      destination_lng: Number(values.destLng),
      departure_date: departurePart,
      is_one_way: true,
      adults: Number(values.adults),
      children: Number(values.children),
      older_travellers: Number(values.olderTravellers),
      travel_mode: values.travelMode,
      notes: values.notes || null,
      checkpoints,
      preferences: values.budgetInr ? { total_budget_inr: Number(values.budgetInr) } : undefined,
    };

    createMutation.mutate(input);
  }

  function restoreDraft() {
    if (!draftAvailable) return;
    reset(draftAvailable.draft);
    setDraftAvailable(null);
  }

  async function discardDraft() {
    await clearTripDraft();
    setDraftAvailable(null);
  }

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["bottom"]}>
      <ScreenHeader title="Plan a Trip" showBack />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, paddingBottom: 48, gap: 16 }} keyboardShouldPersistTaps="handled">
          {draftAvailable ? (
            <Card className="gap-2 border-info/40 bg-info/5">
              <Text className="text-sm font-semibold text-ink">Unsaved trip plan found</Text>
              <Text className="text-xs text-ink-muted">
                Saved {new Date(draftAvailable.savedAt).toLocaleString()} after a failed submit. Restore it or start fresh.
              </Text>
              <View className="flex-row gap-2 pt-1">
                <Button label="Restore" size="md" onPress={restoreDraft} />
                <Button label="Discard" size="md" variant="secondary" onPress={discardDraft} />
              </View>
            </Card>
          ) : null}

          {createMutation.isError ? (
            <ErrorState
              title="Could not save trip"
              description={
                createMutation.error instanceof ApiError
                  ? createMutation.error.message
                  : "Check your connection and try again. Your inputs were saved on this device."
              }
            />
          ) : null}

          <Card className="gap-4">
            <Text className="text-base font-bold text-ink">Trip basics</Text>
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <FormField label="Trip name" required error={errors.name?.message}>
                  <TextInput className={inputClassName} placeholder="e.g. Chennai to Goa" value={field.value} onChangeText={field.onChange} />
                </FormField>
              )}
            />

            <Controller
              control={control}
              name="originName"
              render={({ field: nameField }) => (
                <Controller
                  control={control}
                  name="originLat"
                  render={({ field: latField }) => (
                    <Controller
                      control={control}
                      name="originLng"
                      render={({ field: lngField }) => (
                        <LocationInput
                          label="Starting location"
                          required
                          nameValue={nameField.value}
                          onNameChange={(name, coords) => {
                            nameField.onChange(name);
                            if (coords) {
                              latField.onChange(String(coords.lat));
                              lngField.onChange(String(coords.lng));
                            }
                          }}
                          latValue={latField.value}
                          onLatChange={latField.onChange}
                          lngValue={lngField.value}
                          onLngChange={lngField.onChange}
                          nameError={errors.originName?.message}
                          latError={errors.originLat?.message}
                          lngError={errors.originLng?.message}
                        />
                      )}
                    />
                  )}
                />
              )}
            />

            <Controller
              control={control}
              name="destName"
              render={({ field: nameField }) => (
                <Controller
                  control={control}
                  name="destLat"
                  render={({ field: latField }) => (
                    <Controller
                      control={control}
                      name="destLng"
                      render={({ field: lngField }) => (
                        <LocationInput
                          label="Destination"
                          required
                          nameValue={nameField.value}
                          onNameChange={(name, coords) => {
                            nameField.onChange(name);
                            if (coords) {
                              latField.onChange(String(coords.lat));
                              lngField.onChange(String(coords.lng));
                            }
                          }}
                          latValue={latField.value}
                          onLatChange={latField.onChange}
                          lngValue={lngField.value}
                          onLngChange={lngField.onChange}
                          nameError={errors.destName?.message}
                          latError={errors.destLat?.message}
                          lngError={errors.destLng?.message}
                        />
                      )}
                    />
                  )}
                />
              )}
            />
          </Card>

          <Card className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-ink">Intermediate checkpoints</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add checkpoint"
                onPress={() => append({ name: "", lat: "", lng: "", is_mandatory: true, stay_overnight: false, notes: "" })}
                className="flex-row items-center gap-1 rounded-lg bg-brand-green px-3 py-2"
              >
                <Plus size={14} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">Add Stop</Text>
              </Pressable>
            </View>
            {fields.length === 0 ? (
              <Text className="text-xs text-ink-muted">No intermediate stops yet — your route will go straight from origin to destination.</Text>
            ) : null}
            {fields.map((field, index) => (
              <View key={field.id} className="gap-2 rounded-xl border border-border bg-muted p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase text-ink-muted">Stop {index + 1}</Text>
                  <View className="flex-row items-center gap-1">
                    <Pressable disabled={index === 0} onPress={() => move(index, index - 1)} className="h-8 w-8 items-center justify-center rounded-lg active:bg-border disabled:opacity-30">
                      <ArrowUp size={16} color="#5B6B60" />
                    </Pressable>
                    <Pressable disabled={index === fields.length - 1} onPress={() => move(index, index + 1)} className="h-8 w-8 items-center justify-center rounded-lg active:bg-border disabled:opacity-30">
                      <ArrowDown size={16} color="#5B6B60" />
                    </Pressable>
                    <Pressable onPress={() => remove(index)} className="h-8 w-8 items-center justify-center rounded-lg active:bg-danger/10">
                      <Trash2 size={16} color="#B3261E" />
                    </Pressable>
                  </View>
                </View>
                <Controller
                  control={control}
                  name={`checkpoints.${index}.name`}
                  render={({ field: f }) => (
                    <FormField label="Name" error={errors.checkpoints?.[index]?.name?.message}>
                      <TextInput className={inputClassName} placeholder="e.g. Hyderabad" value={f.value} onChangeText={f.onChange} />
                    </FormField>
                  )}
                />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Controller
                      control={control}
                      name={`checkpoints.${index}.lat`}
                      render={({ field: f }) => (
                        <FormField label="Latitude" error={errors.checkpoints?.[index]?.lat?.message}>
                          <TextInput className={inputClassName} keyboardType="numbers-and-punctuation" value={f.value} onChangeText={f.onChange} />
                        </FormField>
                      )}
                    />
                  </View>
                  <View className="flex-1">
                    <Controller
                      control={control}
                      name={`checkpoints.${index}.lng`}
                      render={({ field: f }) => (
                        <FormField label="Longitude" error={errors.checkpoints?.[index]?.lng?.message}>
                          <TextInput className={inputClassName} keyboardType="numbers-and-punctuation" value={f.value} onChangeText={f.onChange} />
                        </FormField>
                      )}
                    />
                  </View>
                </View>
                <View className="flex-row gap-4">
                  <Controller
                    control={control}
                    name={`checkpoints.${index}.is_mandatory`}
                    render={({ field: f }) => (
                      <Pressable onPress={() => f.onChange(!f.value)} className="flex-row items-center gap-2">
                        <View className={`h-5 w-5 items-center justify-center rounded border ${f.value ? "border-brand-green bg-brand-green" : "border-border"}`}>
                          {f.value ? <Text className="text-[10px] font-bold text-white">✓</Text> : null}
                        </View>
                        <Text className="text-xs text-ink">Mandatory</Text>
                      </Pressable>
                    )}
                  />
                  <Controller
                    control={control}
                    name={`checkpoints.${index}.stay_overnight`}
                    render={({ field: f }) => (
                      <Pressable onPress={() => f.onChange(!f.value)} className="flex-row items-center gap-2">
                        <View className={`h-5 w-5 items-center justify-center rounded border ${f.value ? "border-brand-green bg-brand-green" : "border-border"}`}>
                          {f.value ? <Text className="text-[10px] font-bold text-white">✓</Text> : null}
                        </View>
                        <Text className="text-xs text-ink">Overnight stay</Text>
                      </Pressable>
                    )}
                  />
                </View>
                <Controller
                  control={control}
                  name={`checkpoints.${index}.notes`}
                  render={({ field: f }) => (
                    <FormField label="Notes" helperText="Optional">
                      <TextInput className={inputClassName} placeholder="e.g. Visit the fort" value={f.value} onChangeText={f.onChange} />
                    </FormField>
                  )}
                />
              </View>
            ))}
          </Card>

          <Card className="gap-4">
            <Text className="text-base font-bold text-ink">Dates & travellers</Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="departureDate"
                  render={({ field }) => (
                    <FormField label="Departure date" error={errors.departureDate?.message} helperText="YYYY-MM-DD">
                      <TextInput className={inputClassName} placeholder="2026-02-14" value={field.value} onChangeText={field.onChange} />
                    </FormField>
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="departureTime"
                  render={({ field }) => (
                    <FormField label="Departure time" error={errors.departureTime?.message} helperText="24h HH:MM">
                      <TextInput className={inputClassName} placeholder="06:00" value={field.value} onChangeText={field.onChange} />
                    </FormField>
                  )}
                />
              </View>
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="adults"
                  render={({ field }) => (
                    <FormField label="Adults" required error={errors.adults?.message}>
                      <TextInput className={inputClassName} keyboardType="number-pad" value={field.value} onChangeText={field.onChange} />
                    </FormField>
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="children"
                  render={({ field }) => (
                    <FormField label="Children" error={errors.children?.message}>
                      <TextInput className={inputClassName} keyboardType="number-pad" value={field.value} onChangeText={field.onChange} />
                    </FormField>
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="olderTravellers"
                  render={({ field }) => (
                    <FormField label="Seniors" error={errors.olderTravellers?.message}>
                      <TextInput className={inputClassName} keyboardType="number-pad" value={field.value} onChangeText={field.onChange} />
                    </FormField>
                  )}
                />
              </View>
            </View>

            <Controller
              control={control}
              name="budgetInr"
              render={({ field }) => (
                <FormField label="Budget (optional)" error={errors.budgetInr?.message} helperText="Total trip budget in INR">
                  <TextInput className={inputClassName} keyboardType="number-pad" placeholder="e.g. 50000" value={field.value} onChangeText={field.onChange} />
                </FormField>
              )}
            />
          </Card>

          <Card className="gap-3">
            <Text className="text-base font-bold text-ink">Travel mode</Text>
            <Controller
              control={control}
              name="travelMode"
              render={({ field }) => (
                <View className="flex-row flex-wrap gap-2">
                  {TRAVEL_MODES.map((mode) => {
                    const meta = TRAVEL_MODE_META[mode];
                    const active = field.value === mode;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => field.onChange(mode)}
                        className={`flex-row items-center gap-2 rounded-xl border px-4 py-2.5 ${active ? "border-brand-green bg-brand-green/10" : "border-border bg-surface"}`}
                      >
                        <meta.Icon size={16} color={active ? "#0E4429" : "#5B6B60"} />
                        <Text className={`text-sm font-medium ${active ? "text-brand-green" : "text-ink"}`}>{meta.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />
            <Text className="text-[11px] text-ink-muted">
              Only modes the backend can cost correctly are shown — fuel/time math is only differentiated for car, motorcycle and EV.
            </Text>
          </Card>

          <Card className="gap-3">
            <Text className="text-base font-bold text-ink">Route priority</Text>
            <Text className="text-[11px] text-ink-muted">
              The backend always computes the same 3 route alternatives (Recommended / Fastest / Scenic); this just controls how we
              sort and highlight them for you on the next screen.
            </Text>
            <Controller
              control={control}
              name="objective"
              render={({ field }) => (
                <View className="flex-row flex-wrap gap-2">
                  {OBJECTIVES.map((o) => {
                    const active = field.value === o.id;
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => field.onChange(o.id)}
                        className={`rounded-pill border px-3.5 py-2 ${active ? "border-brand-green bg-brand-green" : "border-border bg-surface"}`}
                      >
                        <Text className={`text-xs font-semibold ${active ? "text-white" : "text-ink"}`}>{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />
          </Card>

          <Card className="gap-3">
            <Text className="text-base font-bold text-ink">Notes</Text>
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <TextInput
                  className={`${inputClassName} min-h-[80px]`}
                  placeholder="Anything else worth remembering about this trip"
                  value={field.value}
                  onChangeText={field.onChange}
                  multiline
                  textAlignVertical="top"
                />
              )}
            />
          </Card>

          <Button
            label="Find Best Routes"
            size="lg"
            icon={<MapPin size={18} color="#FFFFFF" />}
            loading={createMutation.isPending}
            onPress={handleSubmit(onSubmit)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
