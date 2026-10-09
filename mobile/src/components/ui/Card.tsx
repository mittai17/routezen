import { Pressable, View, type ViewProps } from "react-native";

export type CardProps = ViewProps & {
  /** Renders the card as a Pressable with an accessible button role. */
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
};

/**
 * Base surface for grouped content: white card, subtle border, rounded
 * `card` radius from the design tokens. Used as the building block for
 * `MetricCard` and any list-item style content.
 */
export function Card({ onPress, accessibilityLabel, padded = true, className = "", children, ...rest }: CardProps) {
  const base = `rounded-card border border-border bg-surface ${padded ? "p-4" : ""} ${className}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={4}
        className={`${base} active:opacity-70`}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={base} {...rest}>
      {children}
    </View>
  );
}
