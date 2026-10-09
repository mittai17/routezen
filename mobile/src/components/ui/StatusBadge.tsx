import { Text, View } from "react-native";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
  neutral: "bg-muted text-ink-muted",
};

/** Small status pill, e.g. package status ("In Transit", "Delivered", "Pending"). */
export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  const [bgClass, textClass] = TONE_CLASSES[tone].split(" ");

  return (
    <View
      className={`self-start rounded-pill px-3 py-1 ${bgClass}`}
      accessible
      accessibilityLabel={`Status: ${label}`}
    >
      <Text className={`text-xs font-semibold ${textClass}`}>{label}</Text>
    </View>
  );
}
