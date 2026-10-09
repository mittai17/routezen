import { Text, View } from "react-native";

import { LogoMark } from "./LogoMark";
import { Wordmark } from "./Wordmark";

export type LogoProps = {
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  tone?: "dark" | "light";
  /** Show the "Smarter Routes. Greener Tomorrow." tagline under the wordmark. */
  tagline?: boolean;
  /** Stack mark above wordmark instead of side-by-side. @default true */
  stacked?: boolean;
};

const MARK_SIZE: Record<NonNullable<LogoProps["size"]>, number> = {
  sm: 32,
  md: 56,
  lg: 96,
};

/** Full RouteZen lockup: mark + wordmark, with an optional tagline. */
export function Logo({ size = "md", tone = "dark", tagline = false, stacked = true }: LogoProps) {
  return (
    <View className={stacked ? "items-center" : "flex-row items-center"}>
      <LogoMark size={MARK_SIZE[size]} />
      <View className={stacked ? "mt-3 items-center" : "ml-3"}>
        <Wordmark size={size} tone={tone} />
        {tagline ? (
          <Text
            className={`mt-1 text-center text-sm ${tone === "dark" ? "text-ink-muted" : "text-white/80"}`}
          >
            Smarter Routes. Greener Tomorrow.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
