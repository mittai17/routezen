import { Text, View } from "react-native";

import { Card } from "./Card";

export type MetricCardProps = {
  label: string;
  value: string;
  /** Optional delta, e.g. "+22%". Colored success/danger by sign unless `trendTone` overrides it. */
  trend?: string;
  trendTone?: "success" | "danger";
  icon?: React.ReactNode;
  className?: string;
};

/** Compact stat tile for dashboards/analytics (e.g. "Total Trips 18 +28%"). */
export function MetricCard({ label, value, trend, trendTone, icon, className = "" }: MetricCardProps) {
  const resolvedTrendTone = trendTone ?? (trend?.trim().startsWith("-") ? "danger" : "success");

  return (
    <Card
      className={`flex-1 ${className}`}
      accessibilityLabel={`${label}: ${value}${trend ? `, trend ${trend}` : ""}`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-ink-muted">{label}</Text>
        {icon}
      </View>
      <Text className="mt-2 text-2xl font-bold text-ink">{value}</Text>
      {trend ? (
        <Text className={`mt-1 text-xs font-medium ${resolvedTrendTone === "success" ? "text-success" : "text-danger"}`}>
          {trend}
        </Text>
      ) : null}
    </Card>
  );
}
