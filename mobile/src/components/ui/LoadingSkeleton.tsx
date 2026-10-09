import { useEffect, useState } from "react";
import { Animated, Easing, View, type DimensionValue } from "react-native";

export type SkeletonLineProps = {
  width?: DimensionValue;
  height?: number;
  className?: string;
};

/** A single pulsing placeholder block. Building block for skeleton layouts. */
export function SkeletonLine({ width = "100%", height = 14, className = "" }: SkeletonLineProps) {
  // Lazily create one Animated.Value per instance, outside of a ref's `.current`
  // (the react-hooks/refs lint rule disallows reading `.current` during render).
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, easing: Easing.ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, opacity }}
      className={`rounded-md bg-border ${className}`}
    />
  );
}

export type LoadingSkeletonProps = {
  /** Preset shape, or "custom" to just render `children`. @default "card" */
  variant?: "card" | "list" | "text" | "custom";
  /** Number of repeated rows for "list". @default 3 */
  rows?: number;
  children?: React.ReactNode;
};

/** Reusable loading placeholder for cards/lists while data is in flight. */
export function LoadingSkeleton({ variant = "card", rows = 3, children }: LoadingSkeletonProps) {
  if (variant === "custom") {
    return (
      <View accessibilityLabel="Loading" accessibilityRole="progressbar">
        {children}
      </View>
    );
  }

  if (variant === "text") {
    return (
      <View accessibilityLabel="Loading" accessibilityRole="progressbar" className="gap-2">
        <SkeletonLine width="90%" />
        <SkeletonLine width="60%" />
      </View>
    );
  }

  if (variant === "list") {
    return (
      <View accessibilityLabel="Loading" accessibilityRole="progressbar" className="gap-3">
        {Array.from({ length: rows }).map((_, index) => (
          <View key={index} className="rounded-card border border-border bg-surface p-4">
            <SkeletonLine width="50%" height={12} />
            <SkeletonLine width="80%" className="mt-3" />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      className="rounded-card border border-border bg-surface p-4"
    >
      <SkeletonLine width="40%" height={12} />
      <SkeletonLine width="70%" className="mt-3" height={20} />
      <SkeletonLine width="55%" className="mt-2" />
    </View>
  );
}
