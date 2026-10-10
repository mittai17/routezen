/**
 * Shared create/edit form for a Package, used by logistics/packages/new.tsx and
 * logistics/packages/[id]/edit.tsx. react-hook-form + zod, matching
 * backend/app/schemas/resources.py::PackageIn field-for-field (see src/lib/api/packages.ts).
 *
 * Offline-safe: on a network/timeout error from the save mutation, the in-progress form is
 * persisted to AsyncStorage (via savePackageDraft) so the user never loses typed data; a banner
 * offers to restore it next time this form opens with the same draft key.
 */
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, MapPin, X } from "lucide-react-native";

import { apiRequest, ApiError } from "../../lib/api/client";
import {
  HANDLING_PRESETS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  computeVolumeM3,
  createPackage,
  loadPackageDraft,
  savePackageDraft,
  clearPackageDraft,
  updatePackage,
  type Package,
  type PackageInput,
  type PackageKind,
  type PackagePriority,
  type PackageStatus,
} from "../../lib/api/packages";
import { Badge, Button } from "../home/ui";

interface LocationOption {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  type: "depot" | "stop" | "warehouse";
}

interface FormValues {
  reference: string;
  recipient: string;
  kind: PackageKind;
  priority: PackagePriority;
  status: PackageStatus;
  locationId: string;
  address: string;
  latitude: string;
  longitude: string;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  volumeM3: string;
  deadline: string;
  windowStart: string;
  windowEnd: string;
  serviceMinutes: string;
  handling: string[];
  notes: string;
}

function parseDateTimeInput(raw: string): Date | null {
  const v = raw.trim();
  if (!v) return null;
  const normalized = v.replace(" ", "T");
  const withSeconds = /T\d{2}:\d{2}$/.test(normalized) ? `${normalized}:00` : normalized;
  const d = new Date(withSeconds);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(raw: string): string | null {
  const d = parseDateTimeInput(raw);
  return d ? d.toISOString() : null;
}

function isoToInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toFormValues(p?: Package | null): FormValues {
  return {
    reference: p?.reference ?? "",
    recipient: p?.recipient ?? "",
    kind: p?.kind ?? "delivery",
    priority: p?.priority ?? "medium",
    status: p?.status ?? "pending",
    locationId: p?.location_id ?? "",
    address: p?.address ?? "",
    latitude: p?.latitude != null ? String(p.latitude) : "",
    longitude: p?.longitude != null ? String(p.longitude) : "",
    weightKg: p?.weight_kg != null ? String(p.weight_kg) : "",
    lengthCm: p?.length_cm != null ? String(p.length_cm) : "",
    widthCm: p?.width_cm != null ? String(p.width_cm) : "",
    heightCm: p?.height_cm != null ? String(p.height_cm) : "",
    volumeM3: p?.volume_m3 != null ? String(p.volume_m3) : "",
    deadline: isoToInput(p?.deadline),
    windowStart: isoToInput(p?.window_start),
    windowEnd: isoToInput(p?.window_end),
    serviceMinutes: p?.service_minutes != null ? String(p.service_minutes) : "5",
    handling: p?.handling ?? [],
    notes: p?.notes ?? "",
  };
}

function toPackageInput(v: FormValues): PackageInput {
  const dims = [v.lengthCm, v.widthCm, v.heightCm];
  const hasAllDims = dims.every((d) => d.trim() !== "");
  const lengthCm = hasAllDims ? Number(v.lengthCm) : null;
  const widthCm = hasAllDims ? Number(v.widthCm) : null;
  const heightCm = hasAllDims ? Number(v.heightCm) : null;
  const volumeFromDims = hasAllDims ? computeVolumeM3(lengthCm!, widthCm!, heightCm!) : null;
  return {
    reference: v.reference.trim(),
    recipient: v.recipient.trim() || null,
    location_id: v.locationId || null,
    address: v.address.trim() || null,
    latitude: v.latitude.trim() !== "" ? Number(v.latitude) : null,
    longitude: v.longitude.trim() !== "" ? Number(v.longitude) : null,
    weight_kg: Number(v.weightKg),
    length_cm: lengthCm,
    width_cm: widthCm,
    height_cm: heightCm,
    volume_m3: volumeFromDims ?? (v.volumeM3.trim() !== "" ? Number(v.volumeM3) : null),
    priority: v.priority,
    handling: v.handling,
    window_start: toIso(v.windowStart),
    window_end: toIso(v.windowEnd),
    deadline: toIso(v.deadline),
    service_minutes: Number(v.serviceMinutes),
    kind: v.kind,
    status: v.status,
    notes: v.notes.trim() || null,
  };
}

const numericField = (label: string, opts: { required?: boolean; min?: number } = {}) =>
  z.string().trim().superRefine((v, ctx) => {
    if (v === "") {
      if (opts.required) ctx.addIssue({ code: "custom", message: `${label} is required` });
      return;
    }
    const n = Number(v);
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: `${label} must be a number` });
      return;
    }
    if (opts.min !== undefined && n < opts.min) ctx.addIssue({ code: "custom", message: `${label} must be at least ${opts.min}` });
  });

const dateTimeField = z.string().trim().refine((v) => v === "" || parseDateTimeInput(v) !== null, "Use format YYYY-MM-DD HH:mm");

const schema = z
  .object({
    reference: z.string().trim().min(1, "Reference is required").max(200, "Max 200 characters"),
    recipient: z.string().trim().max(200, "Max 200 characters"),
    kind: z.enum(["delivery", "pickup"]),
    priority: z.enum(["low", "medium", "high"]),
    status: z.enum(["pending", "assigned", "in_transit", "delivered", "failed", "cancelled"]),
    locationId: z.string(),
    address: z.string().trim().max(500, "Max 500 characters"),
    latitude: numericField("Latitude", { min: -90 }),
    longitude: numericField("Longitude", { min: -180 }),
    weightKg: numericField("Weight", { required: true, min: 0 }),
    lengthCm: numericField("Length", { min: 0.0001 }),
    widthCm: numericField("Width", { min: 0.0001 }),
    heightCm: numericField("Height", { min: 0.0001 }),
    volumeM3: numericField("Volume", { min: 0 }),
    deadline: dateTimeField,
    windowStart: dateTimeField,
    windowEnd: dateTimeField,
    serviceMinutes: numericField("Service time", { required: true, min: 0 }),
    handling: z.array(z.string()),
    notes: z.string().trim().max(2000, "Max 2000 characters"),
  })
  .superRefine((v, ctx) => {
    if ((v.latitude.trim() === "") !== (v.longitude.trim() === "")) {
      ctx.addIssue({ code: "custom", path: ["longitude"], message: "Latitude and longitude must be provided together" });
    }
    const dims = [v.lengthCm, v.widthCm, v.heightCm];
    const any = dims.some((d) => d.trim() !== "");
    const all = dims.every((d) => d.trim() !== "");
    if (any && !all) ctx.addIssue({ code: "custom", path: ["heightCm"], message: "Length, width and height must all be provided together" });
    const start = parseDateTimeInput(v.windowStart);
    const end = parseDateTimeInput(v.windowEnd);
    if (start && end && end < start) {
      ctx.addIssue({ code: "custom", path: ["windowEnd"], message: "Window end must not be before window start" });
    }
  });

export interface PackageFormProps {
  mode: "create" | "edit";
  packageId?: string;
  initial?: Package | null;
  onSaved: (pkg: Package) => void;
  onCancel: () => void;
}

export function PackageForm({ mode, packageId, initial, onSaved, onCancel }: PackageFormProps) {
  const draftKey = mode === "edit" && packageId ? packageId : "new";
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftBanner, setDraftBanner] = useState<{ savedAt: string; data: Record<string, unknown> } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toFormValues(initial) });

  useEffect(() => {
    loadPackageDraft(draftKey).then((d) => {
      if (d) setDraftBanner(d);
    });
    // Only check once per mount — re-checking on every keystroke would be pointless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [lengthCm, widthCm, heightCm] = useWatch({ control, name: ["lengthCm", "widthCm", "heightCm"] });
  useEffect(() => {
    if (lengthCm && widthCm && heightCm) {
      const l = Number(lengthCm), w = Number(widthCm), h = Number(heightCm);
      if (!Number.isNaN(l) && !Number.isNaN(w) && !Number.isNaN(h) && l > 0 && w > 0 && h > 0) {
        setValue("volumeM3", String(computeVolumeM3(l, w, h)));
      }
    }
  }, [lengthCm, widthCm, heightCm, setValue]);

  const locationsQuery = useQuery({
    queryKey: ["locations-picker"],
    queryFn: ({ signal }) => apiRequest<{ items: LocationOption[]; total: number }>("/locations", { query: { limit: 100, sort: "name", order: "asc" }, signal }),
    staleTime: 60_000,
  });

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    setSubmitting(true);
    const input = toPackageInput(values);
    try {
      const saved = mode === "create" ? await createPackage(input) : await updatePackage(packageId!, input);
      await clearPackageDraft(draftKey);
      onSaved(saved);
    } catch (e) {
      const isOffline = e instanceof ApiError && (e.code === "network" || e.code === "timeout");
      if (isOffline) {
        await savePackageDraft(draftKey, values as unknown as Record<string, unknown>);
        setSubmitError("No connection — this package was saved on your device and hasn't been sent yet. Try again when you're back online.");
      } else {
        setSubmitError(e instanceof ApiError ? e.message : "Could not save this package. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function restoreDraft() {
    if (!draftBanner) return;
    reset(draftBanner.data as unknown as FormValues);
    setDraftBanner(null);
  }

  async function discardDraft() {
    await clearPackageDraft(draftKey);
    setDraftBanner(null);
  }

  const watchedLocationId = useWatch({ control, name: "locationId" });
  const locations = useMemo(() => locationsQuery.data?.items ?? [], [locationsQuery.data]);
  const selectedLocation = useMemo(() => locations.find((l) => l.id === watchedLocationId), [locations, watchedLocationId]);

  return (
    <ScrollView className="flex-1 bg-muted" contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      {draftBanner ? (
        <View className="mb-4 rounded-card border border-warning/30 bg-warning/10 p-3">
          <Text className="text-sm font-semibold text-ink">Unsaved draft found</Text>
          <Text className="mt-0.5 text-xs text-ink-muted">Saved {new Date(draftBanner.savedAt).toLocaleString("en-IN")} while offline.</Text>
          <View className="mt-2 flex-row gap-2">
            <Button label="Restore" variant="secondary" onPress={restoreDraft} className="flex-1" />
            <Button label="Discard" variant="outline" onPress={discardDraft} className="flex-1" />
          </View>
        </View>
      ) : null}

      <FormSection title="Package">
        <LabeledInput label="Reference *" control={control} name="reference" error={errors.reference?.message} placeholder="e.g. PKG-105" />
        <LabeledInput label="Recipient" control={control} name="recipient" error={errors.recipient?.message} placeholder="Recipient name" />
        <SegmentedField label="Type" control={control} name="kind" options={[{ value: "delivery", label: "Delivery" }, { value: "pickup", label: "Pickup" }]} />
        <SegmentedField label="Priority" control={control} name="priority" options={(["low", "medium", "high"] as const).map((v) => ({ value: v, label: PRIORITY_LABELS[v] }))} />
        {mode === "edit" ? (
          <SegmentedField
            label="Status"
            control={control}
            name="status"
            options={(Object.keys(STATUS_LABELS) as PackageStatus[]).map((v) => ({ value: v, label: STATUS_LABELS[v] }))}
            wrap
          />
        ) : null}
      </FormSection>

      <FormSection title="Location">
        <Pressable
          onPress={() => setLocationPickerOpen(true)}
          className="flex-row items-center justify-between rounded-xl border border-border bg-white px-3 py-3"
        >
          <View className="flex-row items-center gap-2">
            <MapPin size={16} color="#5B6B60" />
            <Text className="text-sm text-ink">{selectedLocation ? selectedLocation.name : "Pick a saved location (optional)"}</Text>
          </View>
          <ChevronDown size={16} color="#5B6B60" />
        </Pressable>
        <LabeledInput label="Address" control={control} name="address" error={errors.address?.message} placeholder="Street, area, city" />
        <View className="flex-row gap-3">
          <LabeledInput label="Latitude" control={control} name="latitude" error={errors.latitude?.message} placeholder="13.0418" keyboardType="numeric" className="flex-1" />
          <LabeledInput label="Longitude" control={control} name="longitude" error={errors.longitude?.message} placeholder="80.2341" keyboardType="numeric" className="flex-1" />
        </View>
      </FormSection>

      <FormSection title="Weight, dimensions & volume">
        <LabeledInput label="Weight (kg) *" control={control} name="weightKg" error={errors.weightKg?.message} placeholder="e.g. 4.5" keyboardType="numeric" />
        <View className="flex-row gap-3">
          <LabeledInput label="Length (cm)" control={control} name="lengthCm" error={errors.lengthCm?.message} keyboardType="numeric" className="flex-1" />
          <LabeledInput label="Width (cm)" control={control} name="widthCm" error={errors.widthCm?.message} keyboardType="numeric" className="flex-1" />
          <LabeledInput label="Height (cm)" control={control} name="heightCm" error={errors.heightCm?.message} keyboardType="numeric" className="flex-1" />
        </View>
        <LabeledInput label="Volume (m³)" control={control} name="volumeM3" error={errors.volumeM3?.message} placeholder="Auto-filled from dimensions" keyboardType="numeric" />
      </FormSection>

      <FormSection title="Deadline & time window">
        <LabeledInput label="Deadline" control={control} name="deadline" error={errors.deadline?.message} placeholder="YYYY-MM-DD HH:mm" />
        <View className="flex-row gap-3">
          <LabeledInput label="Window start" control={control} name="windowStart" error={errors.windowStart?.message} placeholder="YYYY-MM-DD HH:mm" className="flex-1" />
          <LabeledInput label="Window end" control={control} name="windowEnd" error={errors.windowEnd?.message} placeholder="YYYY-MM-DD HH:mm" className="flex-1" />
        </View>
        <LabeledInput label="Service time (min)" control={control} name="serviceMinutes" error={errors.serviceMinutes?.message} keyboardType="numeric" />
      </FormSection>

      <FormSection title="Handling requirements">
        <Controller
          control={control}
          name="handling"
          render={({ field }) => (
            <View className="flex-row flex-wrap gap-2">
              {HANDLING_PRESETS.map((h) => {
                const active = field.value.includes(h);
                return (
                  <Pressable
                    key={h}
                    onPress={() => field.onChange(active ? field.value.filter((x) => x !== h) : [...field.value, h])}
                    className={`rounded-pill border px-3 py-1.5 ${active ? "border-brand-green bg-brand-green" : "border-border bg-white"}`}
                  >
                    <Text className={`text-xs font-medium ${active ? "text-white" : "text-ink"}`}>{h.replace(/_/g, " ")}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      </FormSection>

      <FormSection title="Notes">
        <LabeledInput label="" control={control} name="notes" error={errors.notes?.message} placeholder="Delivery instructions, gate codes, etc." multiline />
      </FormSection>

      {submitError ? (
        <View className="mb-3 rounded-card border border-danger/30 bg-danger/10 p-3">
          <Text className="text-sm text-danger">{submitError}</Text>
        </View>
      ) : null}

      <View className="flex-row gap-3">
        <Button label="Cancel" variant="outline" onPress={onCancel} className="flex-1" disabled={submitting} />
        <Button label={mode === "create" ? "Create package" : "Save changes"} onPress={handleSubmit(onSubmit)} className="flex-1" loading={submitting} />
      </View>

      <Modal visible={locationPickerOpen} animationType="slide" onRequestClose={() => setLocationPickerOpen(false)}>
        <View className="flex-1 bg-white pt-14">
          <View className="flex-row items-center justify-between border-b border-border px-5 pb-4">
            <Text className="text-lg font-bold text-ink">Pick a location</Text>
            <Pressable onPress={() => setLocationPickerOpen(false)} className="p-1">
              <X size={22} color="#0E1A14" />
            </Pressable>
          </View>
          {locationsQuery.isLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator />
            </View>
          ) : locations.length === 0 ? (
            <Text className="px-5 py-6 text-sm text-ink-muted">No saved locations yet. Enter an address and coordinates manually above.</Text>
          ) : (
            <ScrollView>
              {locations.map((loc) => (
                <Pressable
                  key={loc.id}
                  onPress={() => {
                    setValue("locationId", loc.id);
                    setValue("address", loc.address ?? "");
                    setValue("latitude", String(loc.latitude));
                    setValue("longitude", String(loc.longitude));
                    setLocationPickerOpen(false);
                  }}
                  className="flex-row items-center justify-between border-b border-border px-5 py-4"
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-semibold text-ink">{loc.name}</Text>
                    <Text className="text-xs text-ink-muted">{loc.address ?? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}</Text>
                  </View>
                  <Badge label={loc.type} tone={loc.type === "depot" ? "success" : "muted"} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5 gap-3 rounded-card border border-border bg-white p-4">
      <Text className="text-sm font-bold uppercase tracking-wide text-ink-muted">{title}</Text>
      {children}
    </View>
  );
}

function LabeledInput({
  label,
  control,
  name,
  error,
  placeholder,
  keyboardType,
  multiline,
  className = "",
}: {
  label: string;
  control: ReturnType<typeof useForm<FormValues>>["control"];
  name: keyof FormValues;
  error?: string;
  placeholder?: string;
  keyboardType?: "numeric" | "default";
  multiline?: boolean;
  className?: string;
}) {
  return (
    <View className={className}>
      {label ? <Text className="mb-1 text-xs font-medium text-ink-muted">{label}</Text> : null}
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={typeof value === "string" ? value : ""}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor="#9AA79F"
            keyboardType={keyboardType}
            multiline={multiline}
            numberOfLines={multiline ? 4 : 1}
            className={`rounded-xl border px-3 py-2.5 text-sm text-ink ${error ? "border-danger" : "border-border"} ${multiline ? "min-h-[90px]" : ""}`}
            style={multiline ? { textAlignVertical: "top" } : undefined}
          />
        )}
      />
      {error ? <Text className="mt-1 text-xs text-danger">{error}</Text> : null}
    </View>
  );
}

function SegmentedField<T extends string>({
  label,
  control,
  name,
  options,
  wrap,
}: {
  label: string;
  control: ReturnType<typeof useForm<FormValues>>["control"];
  name: keyof FormValues;
  options: { value: T; label: string }[];
  wrap?: boolean;
}) {
  return (
    <View>
      <Text className="mb-1 text-xs font-medium text-ink-muted">{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }) => (
          <View className={`flex-row ${wrap ? "flex-wrap" : ""} gap-2`}>
            {options.map((opt) => {
              const active = value === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => onChange(opt.value)}
                  className={`rounded-pill border px-3 py-1.5 ${active ? "border-brand-green bg-brand-green" : "border-border bg-white"}`}
                >
                  <Text className={`text-xs font-semibold ${active ? "text-white" : "text-ink"}`}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      />
    </View>
  );
}
