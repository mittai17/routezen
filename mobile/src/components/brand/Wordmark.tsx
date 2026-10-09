import { Text, View } from "react-native";

export type WordmarkProps = {
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** Text color for light-on-dark surfaces vs dark-on-light surfaces. @default "dark" */
  tone?: "dark" | "light";
};

const SIZE_CLASSES: Record<NonNullable<WordmarkProps["size"]>, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
};

/**
 * "RouteZen" wordmark. Split into two spans so the brand yellow accent on
 * "Zen" reads consistently regardless of surface tone.
 */
export function Wordmark({ size = "md", tone = "dark" }: WordmarkProps) {
  const base = SIZE_CLASSES[size];
  const routeColor = tone === "dark" ? "text-brand-green" : "text-white";

  return (
    <View
      className="flex-row items-baseline"
      accessible
      accessibilityRole="header"
      accessibilityLabel="RouteZen"
    >
      <Text className={`${base} font-bold ${routeColor}`}>Route</Text>
      <Text className={`${base} font-bold text-brand-yellow-dark`}>Zen</Text>
    </View>
  );
}
