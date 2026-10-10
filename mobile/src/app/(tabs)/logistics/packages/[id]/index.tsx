import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import {
  ArrowLeft,
  Box,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Pencil,
  Ruler,
  Sparkles,
  Trash2,
  Truck,
  Weight,
  XCircle,
} from "lucide-react-native";

import {
  deletePackage,
  fetchAssignmentForPackage,
  fetchPackageEvents,
  getPackage,
  isDelayed,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type PackageStatus,
} from "../../../../../lib/api/packages";
import { ApiError } from "../../../../../lib/api/client";
import { Badge, Button, Card, ErrorState, fmtDateTime, fmtKg, fmtMoney } from "../../../../../components/home/ui";
import { RouteZenMap } from "../../../../../components/ui";

const STATUS_TONE: Record<PackageStatus, "success" | "warning" | "danger" | "info" | "muted"> = {
  pending: "muted",
  assigned: "info",
  in_transit: "warning",
  delivered: "success",
  failed: "danger",
  cancelled: "danger",
};

const TIMELINE_STEPS: { status: PackageStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "assigned", label: "Assigned" },
  { status: "in_transit", label: "In transit" },
  { status: "delivered", label: "Delivered" },
];

export default function PackageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  const packageQuery = useQuery({ queryKey: ["package", id], queryFn: ({ signal }) => getPackage(id, signal), enabled: !!id });
  const assignmentQuery = useQuery({ queryKey: ["package-assignment", id], queryFn: () => fetchAssignmentForPackage(id), enabled: !!id });
  const eventsQuery = useQuery({ queryKey: ["package-events", id], queryFn: () => fetchPackageEvents(id), enabled: !!id });

  const pkg = packageQuery.data;

  function confirmDelete() {
    if (!pkg) return;
    Alert.alert("Delete package", `Delete "${pkg.reference}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deletePackage(pkg.id);
            queryClient.invalidateQueries({ queryKey: ["packages"] });
            queryClient.invalidateQueries({ queryKey: ["logistics-stats"] });
            router.replace("/logistics/packages");
          } catch (e) {
            Alert.alert("Could not delete", e instanceof ApiError ? e.message : "Please try again.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-border bg-white px-4 py-3">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft size={22} color="#0E1A14" />
          </Pressable>
          <Text className="text-lg font-bold text-ink" numberOfLines={1}>
            {pkg?.reference ?? "Package"}
          </Text>
        </View>
        {pkg ? (
          <View className="flex-row gap-3">
            <Pressable onPress={() => router.push(`/logistics/packages/${pkg.id}/edit`)} hitSlop={10}>
              <Pencil size={20} color="#0E1A14" />
            </Pressable>
            <Pressable onPress={confirmDelete} hitSlop={10} disabled={deleting}>
              <Trash2 size={20} color="#B3261E" />
            </Pressable>
          </View>
        ) : null}
      </View>

      {packageQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : packageQuery.isError || !pkg ? (
        <ErrorState
          message={packageQuery.error instanceof ApiError ? packageQuery.error.message : "Could not load this package."}
          onRetry={() => packageQuery.refetch()}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}>
          <View className="flex-row flex-wrap items-center gap-2">
            <Badge label={STATUS_LABELS[pkg.status]} tone={STATUS_TONE[pkg.status]} />
            <Badge label={`${PRIORITY_LABELS[pkg.priority]} priority`} tone={pkg.priority === "high" ? "danger" : "muted"} />
            <Badge label={pkg.kind === "pickup" ? "Pickup" : "Delivery"} tone="info" />
            {isDelayed(pkg) ? <Badge label="Delayed" tone="danger" /> : null}
          </View>

          <Card>
            <Text className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Status timeline</Text>
            <StatusTimeline status={pkg.status} />
            {eventsQuery.data && eventsQuery.data.length > 0 ? (
              <View className="mt-4 gap-2 border-t border-border pt-3">
                {eventsQuery.data.map((ev) => (
                  <View key={ev.id} className="flex-row items-start gap-2">
                    <Clock size={14} color="#5B6B60" style={{ marginTop: 2 }} />
                    <View className="flex-1">
                      <Text className="text-xs font-semibold text-ink">{ev.type}</Text>
                      {ev.message ? <Text className="text-xs text-ink-muted">{ev.message}</Text> : null}
                      <Text className="text-[11px] text-ink-muted">{fmtDateTime(ev.occurred_at)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>

          <Card>
            <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
              {pkg.kind === "pickup" ? "Pickup location" : "Delivery location"}
            </Text>
            <View className="flex-row items-start gap-2">
              <MapPin size={16} color="#5B6B60" style={{ marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-sm text-ink">{pkg.address ?? "No address on file"}</Text>
                {pkg.recipient ? <Text className="text-xs text-ink-muted">Recipient: {pkg.recipient}</Text> : null}
              </View>
            </View>
            {pkg.latitude != null && pkg.longitude != null ? (
              <View className="mt-3 h-40 w-full overflow-hidden rounded-xl border border-border">
                <RouteZenMap
                  style={{ flex: 1 }}
                  pointerEvents="none"
                  initialRegion={{ latitude: pkg.latitude, longitude: pkg.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
                  markers={[{ id: pkg.id, latitude: pkg.latitude, longitude: pkg.longitude, title: pkg.reference }]}
                />
              </View>
            ) : (
              <Text className="mt-3 text-xs text-ink-muted">No coordinates on file — add latitude/longitude to preview on the map.</Text>
            )}
          </Card>

          <Card>
            <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Weight & dimensions</Text>
            <View className="flex-row flex-wrap gap-4">
              <SpecRow icon={<Weight size={15} color="#5B6B60" />} label="Weight" value={fmtKg(pkg.weight_kg)} />
              <SpecRow
                icon={<Ruler size={15} color="#5B6B60" />}
                label="Dimensions"
                value={pkg.length_cm && pkg.width_cm && pkg.height_cm ? `${pkg.length_cm} × ${pkg.width_cm} × ${pkg.height_cm} cm` : "—"}
              />
              <SpecRow icon={<Box size={15} color="#5B6B60" />} label="Volume" value={pkg.volume_m3 != null ? `${pkg.volume_m3} m³` : "—"} />
            </View>
          </Card>

          <Card>
            <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Deadline & time window</Text>
            <View className="gap-2">
              <SpecRow icon={<Calendar size={15} color="#5B6B60" />} label="Deadline" value={fmtDateTime(pkg.deadline)} />
              <SpecRow
                icon={<Clock size={15} color="#5B6B60" />}
                label="Window"
                value={pkg.window_start || pkg.window_end ? `${fmtDateTime(pkg.window_start)} – ${fmtDateTime(pkg.window_end)}` : "—"}
              />
              <SpecRow icon={<Clock size={15} color="#5B6B60" />} label="Service time" value={`${pkg.service_minutes} min`} />
            </View>
          </Card>

          <Card>
            <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Handling requirements</Text>
            {pkg.handling.length === 0 ? (
              <Text className="text-sm text-ink-muted">None specified</Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {pkg.handling.map((h) => (
                  <Badge key={h} label={h.replace(/_/g, " ")} tone="warning" />
                ))}
              </View>
            )}
          </Card>

          <Card>
            <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Assigned vehicle & route</Text>
            {assignmentQuery.isLoading ? (
              <ActivityIndicator />
            ) : assignmentQuery.data ? (
              <View className="gap-1">
                <View className="flex-row items-center gap-2">
                  <Truck size={16} color="#1B6B3F" />
                  <Text className="text-sm font-semibold text-ink">{assignmentQuery.data.vehicle_name ?? assignmentQuery.data.vehicle_id}</Text>
                </View>
                <Text className="text-xs text-ink-muted">Plan: {assignmentQuery.data.plan_name}</Text>
                <Text className="text-xs text-ink-muted">Cost: {fmtMoney(assignmentQuery.data.cost)}</Text>
              </View>
            ) : (
              <Text className="text-sm text-ink-muted">Not yet assigned to a vehicle or route.</Text>
            )}
            <Button
              label="Recommend a vehicle"
              variant="secondary"
              icon={<Sparkles size={16} color="#FFFFFF" />}
              className="mt-3"
              onPress={() => router.push(`/logistics/packages/${pkg.id}/recommend`)}
            />
          </Card>

          {pkg.notes ? (
            <Card>
              <Text className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-muted">Notes</Text>
              <Text className="text-sm text-ink">{pkg.notes}</Text>
            </Card>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SpecRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View className="min-w-[45%] flex-1 flex-row items-center gap-2">
      {icon}
      <View>
        <Text className="text-[11px] text-ink-muted">{label}</Text>
        <Text className="text-sm font-medium text-ink">{value}</Text>
      </View>
    </View>
  );
}

function StatusTimeline({ status }: { status: PackageStatus }) {
  if (status === "failed" || status === "cancelled") {
    return (
      <View className="flex-row items-center gap-2">
        <XCircle size={18} color="#B3261E" />
        <Text className="text-sm font-semibold text-danger">{STATUS_LABELS[status]}</Text>
      </View>
    );
  }
  const activeIndex = TIMELINE_STEPS.findIndex((s) => s.status === status);
  return (
    <View className="flex-row items-center">
      {TIMELINE_STEPS.map((step, i) => {
        const done = i <= activeIndex;
        const isLast = i === TIMELINE_STEPS.length - 1;
        return (
          <View key={step.status} className="flex-1 flex-row items-center">
            <View className="items-center" style={{ width: 64 }}>
              {done ? <CheckCircle2 size={20} color="#1B6B3F" /> : <Circle size={20} color="#D1D9CD" />}
              <Text className={`mt-1 text-center text-[10px] ${done ? "font-semibold text-ink" : "text-ink-muted"}`}>{step.label}</Text>
            </View>
            {!isLast ? <View className={`h-0.5 flex-1 ${i < activeIndex ? "bg-brand-green" : "bg-border"}`} /> : null}
          </View>
        );
      })}
    </View>
  );
}
