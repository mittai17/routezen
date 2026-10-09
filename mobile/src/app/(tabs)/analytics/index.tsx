/**
 * Analytics tab — built entirely from GET /analytics/* (backend/app/api/v1/analytics.py),
 * per docs/MOBILE.md's instruction to use those endpoints. See src/lib/api/analytics.ts
 * for the full list of fields the task's spec implies (trips completed, total distance,
 * vehicle utilization %, energy consumption in L/kWh, emissions saved vs. a baseline,
 * date filters) that this API genuinely does not provide. Those are omitted here rather
 * than invented, with an explicit "not available" section so the gap is visible in the
 * UI itself, not just in this comment.
 */
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Boxes, Fuel, Gauge, Leaf, ListChecks, Wallet } from "lucide-react-native";

import { Card, EmptyState, ErrorState, MetricCard, ScreenHeader } from "../../../components/ui";
import { getAnalyticsBundle } from "../../../lib/api/analytics";
import { ApiError } from "../../../lib/api/client";

function money(v: string | null): string {
  if (v === null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—";
}
function num(v: number | null, suffix = ""): string {
  return v === null ? "—" : `${v.toLocaleString("en-IN", { maximumFractionDigits: 1 })}${suffix}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <Text className="mb-2 text-sm font-semibold text-ink">{title}</Text>
      {children}
    </Card>
  );
}

export default function AnalyticsTab() {
  const query = useQuery({
    queryKey: ["analytics", "bundle"],
    queryFn: getAnalyticsBundle,
    staleTime: 20_000,
  });

  const errorMessage = query.isError ? (query.error instanceof ApiError ? query.error.message : "Could not load analytics.") : null;
  const b = query.data;
  const delivered = b?.summary.packages_by_status["delivered"] ?? null;

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4 pb-10"
      refreshControl={<RefreshControl refreshing={query.isFetching && !query.isLoading} onRefresh={() => query.refetch()} />}
    >
      <ScreenHeader title="Analytics" subtitle="Live figures from /analytics/*" right={<BarChart3 size={20} color="#1B6B3F" />} withTopInset={false} />

      {query.isLoading ? (
        <View className="items-center py-16">
          <ActivityIndicator color="#0E4429" />
        </View>
      ) : errorMessage ? (
        <ErrorState description={errorMessage} onRetry={() => query.refetch()} />
      ) : !b ? null : b.summary.plans === 0 && b.summary.packages === 0 ? (
        <EmptyState
          icon={<ListChecks size={28} color="#5B6B60" />}
          title="No data yet"
          description="No delivery plans or packages yet — analytics will populate once there's data."
        />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-3">
            <MetricCard
              icon={<ListChecks size={16} color="#1B6B3F" />}
              label="Delivery plans"
              value={String(b.summary.plans)}
              trend={Object.entries(b.summary.plans_by_status).map(([k, v]) => `${k}: ${v}`).join(", ") || undefined}
              trendTone="success"
              className="basis-[47%]"
            />
            <MetricCard
              icon={<Boxes size={16} color="#1B6B3F" />}
              label="Deliveries completed"
              value={delivered !== null ? String(delivered) : "n/a"}
              trend={delivered === null ? "no 'delivered' status yet" : `of ${b.summary.packages} packages`}
              trendTone="success"
              className="basis-[47%]"
            />
            <MetricCard
              icon={<Wallet size={16} color="#1B6B3F" />}
              label="Estimated cost"
              value={money(b.cost.total_cost)}
              trend={b.cost.cost_per_delivery ? `${money(b.cost.cost_per_delivery)} / delivery` : undefined}
              trendTone="success"
              className="basis-[47%]"
            />
            <MetricCard
              icon={<Leaf size={16} color="#1B6B3F" />}
              label="Estimated emissions"
              value={num(b.energy.total_planned_emissions_g / 1000, " kg")}
              trend="planned, from emissions_g_per_km"
              trendTone="success"
              className="basis-[47%]"
            />
          </View>

          <Section title="Plans by cost">
            {b.cost.by_plan.length === 0 ? (
              <Text className="text-xs text-ink-muted">No plans with recorded cost yet.</Text>
            ) : (
              b.cost.by_plan.slice(0, 8).map((p) => (
                <View key={p.plan_id} className="flex-row items-center justify-between border-b border-border/60 py-1.5">
                  <Text className="flex-1 text-xs text-ink" numberOfLines={1}>{p.name}</Text>
                  <Text className="text-xs text-ink-muted">{p.status}</Text>
                  <Text className="w-20 text-right text-xs text-ink">{money(p.total_cost)}</Text>
                </View>
              ))
            )}
          </Section>

          <Section title="Vehicles">
            <Text className="mb-2 text-[11px] text-ink-muted">
              /analytics/vehicles reports assigned-package counts per vehicle, not a capacity-utilization percentage (payload/volume used vs.
              available isn&apos;t computed by this endpoint) — shown as a count, not invented as a %.
            </Text>
            {b.vehicles.length === 0 ? (
              <Text className="text-xs text-ink-muted">No vehicles yet.</Text>
            ) : (
              b.vehicles.map((v) => (
                <View key={v.vehicle_id} className="flex-row items-center justify-between border-b border-border/60 py-1.5">
                  <Text className="flex-1 text-xs text-ink" numberOfLines={1}>{v.name}</Text>
                  <Text className="text-xs text-ink-muted">{v.energy_type}</Text>
                  <Text className="w-28 text-right text-xs text-ink">{v.assigned_packages} assigned pkgs</Text>
                </View>
              ))
            )}
          </Section>

          <Section title="Vehicles by energy type">
            <View className="flex-row items-center gap-1.5">
              <Fuel size={14} color="#1B6B3F" />
              <Text className="text-xs text-ink-muted">Count of vehicles per energy_type (not a consumption figure in L/kWh — not provided by this endpoint)</Text>
            </View>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {Object.entries(b.energy.vehicles_by_energy_type).map(([type, count]) => (
                <View key={type} className="rounded-pill bg-muted px-3 py-1">
                  <Text className="text-xs text-ink">{type}: {count}</Text>
                </View>
              ))}
            </View>
          </Section>

          <Section title="Optimization runs">
            <View className="flex-row items-center gap-1.5">
              <Gauge size={14} color="#1B6B3F" />
              <Text className="text-xs text-ink-muted">{b.optimization.total_runs} total runs · avg runtime {b.optimization.avg_runtime_ms !== null ? `${Math.round(b.optimization.avg_runtime_ms)} ms` : "n/a"}</Text>
            </View>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {b.optimization.by_kind_status.map((row) => (
                <View key={`${row.kind}-${row.status}`} className="rounded-pill bg-muted px-3 py-1">
                  <Text className="text-xs text-ink">{row.kind} · {row.status}: {row.count}</Text>
                </View>
              ))}
            </View>
          </Section>

          <View className="rounded-card border border-warning/40 bg-warning/10 p-4">
            <Text className="mb-1 text-sm font-semibold text-ink">Not available from /analytics/*</Text>
            <Text className="text-xs leading-5 text-ink-muted">
              {"•"} Trips completed — this router has no &ldquo;trips&rdquo; concept; that belongs to the separate /travel/* domain.{"\n"}
              {"•"} Total distance — not aggregated anywhere under /analytics/*.{"\n"}
              {"•"} Vehicle utilization % — only an assigned-package count is returned, not capacity usage.{"\n"}
              {"•"} Energy consumption in liters/kWh — only a per-vehicle energy_type count.{"\n"}
              {"•"} Emissions saved vs. a baseline — no baseline figure exists in this API.{"\n"}
              {"•"} Date-range filters — no date query params, and /analytics/cost&apos;s by_plan rows carry no dates to filter by client-side.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}
