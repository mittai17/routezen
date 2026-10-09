import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { ArrowLeft, Package as PackageIcon, Plus, Search, X } from "lucide-react-native";

import {
  isDelayed,
  listPackages,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Package,
  type PackagePriority,
  type PackageStatus,
} from "../../../../lib/api/packages";
import { ApiError } from "../../../../lib/api/client";
import { Badge, EmptyState, ErrorState, fmtKg, LoadingSkeleton } from "../../home/_components/ui";

const STATUS_FILTERS: (PackageStatus | "all")[] = ["all", "pending", "assigned", "in_transit", "delivered", "failed", "cancelled"];
const STATUS_TONE: Record<PackageStatus, "success" | "warning" | "danger" | "info" | "muted"> = {
  pending: "muted",
  assigned: "info",
  in_transit: "warning",
  delivered: "success",
  failed: "danger",
  cancelled: "danger",
};

export default function PackagesListScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? "");
  const [status, setStatus] = useState<PackageStatus | "all">("all");
  const [priority, setPriority] = useState<PackagePriority | "all">("all");

  const listQuery = useQuery({
    queryKey: ["packages", { query, status, priority }],
    queryFn: ({ signal }) =>
      listPackages({
        q: query.trim() || undefined,
        status: status === "all" ? undefined : status,
        priority: priority === "all" ? undefined : priority,
        limit: 100,
        signal,
      }),
  });

  const items = listQuery.data?.items ?? [];

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#0E1A14" />
        </Pressable>
        <Text className="text-lg font-bold text-ink">Packages</Text>
        <View className="flex-1" />
        <Pressable onPress={() => router.push("/logistics/packages/new")} className="flex-row items-center gap-1 rounded-pill bg-brand-yellow px-3 py-2">
          <Plus size={16} color="#0E1A14" />
          <Text className="text-xs font-bold text-ink">Add</Text>
        </Pressable>
      </View>

      <View className="gap-3 bg-white px-4 pb-3 pt-3">
        <View className="flex-row items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2">
          <Search size={16} color="#5B6B60" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by reference, recipient, address"
            placeholderTextColor="#9AA79F"
            className="flex-1 text-sm text-ink"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <X size={16} color="#5B6B60" />
            </Pressable>
          ) : null}
        </View>

        <FilterRow
          label="Status"
          value={status}
          onChange={setStatus}
          options={STATUS_FILTERS.map((s) => ({ value: s, label: s === "all" ? "All" : STATUS_LABELS[s] }))}
        />
        <FilterRow
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={(["all", "low", "medium", "high"] as const).map((p) => ({ value: p, label: p === "all" ? "All" : PRIORITY_LABELS[p] }))}
        />
      </View>

      {listQuery.isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : listQuery.isError ? (
        <ErrorState
          message={listQuery.error instanceof ApiError ? listQuery.error.message : "Could not load packages."}
          onRetry={() => listQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={query || status !== "all" || priority !== "all" ? "No packages match these filters" : "No packages yet"}
          message={query || status !== "all" || priority !== "all" ? "Try adjusting your search or filters." : "Add your first package to start planning deliveries."}
          icon={<PackageIcon size={36} color="#5B6B60" />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => <PackageRow pkg={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function PackageRow({ pkg }: { pkg: Package }) {
  return (
    <Pressable onPress={() => router.push(`/logistics/packages/${pkg.id}`)} className="rounded-card border border-border bg-white p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-sm font-bold text-ink">{pkg.reference}</Text>
          <Text className="mt-0.5 text-xs text-ink-muted" numberOfLines={1}>
            {pkg.address ?? "No address"}
          </Text>
        </View>
        <Badge label={STATUS_LABELS[pkg.status]} tone={STATUS_TONE[pkg.status]} />
      </View>
      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        <Text className="text-xs text-ink-muted">{fmtKg(pkg.weight_kg)}</Text>
        <Text className="text-xs text-ink-muted">·</Text>
        <Text className="text-xs text-ink-muted">{PRIORITY_LABELS[pkg.priority]}</Text>
        {isDelayed(pkg) ? <Badge label="Delayed" tone="danger" /> : null}
      </View>
    </Pressable>
  );
}

function FilterRow<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="w-14 text-xs font-medium text-ink-muted">{label}</Text>
      <View className="flex-1 flex-row flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              className={`rounded-pill border px-2.5 py-1 ${active ? "border-brand-green bg-brand-green" : "border-border bg-white"}`}
            >
              <Text className={`text-[11px] font-semibold ${active ? "text-white" : "text-ink"}`}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
