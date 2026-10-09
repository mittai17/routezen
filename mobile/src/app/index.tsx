import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Logo } from "../components/brand";
import { Button } from "../components/ui";

/**
 * Persisted once onboarding finishes (or is skipped) so returning users land
 * straight on the tab shell instead of seeing onboarding again. Duplicated
 * (not shared) in `onboarding.tsx` to keep this change set scoped to the
 * files this agent owns — see `mobile/src/app/onboarding.tsx`.
 */
const ONBOARDING_COMPLETE_KEY = "routezen.onboarding.completed";
/** Minimum time to hold the loading state so the splash never just flashes. */
const MIN_SPLASH_MS = 500;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export default function Splash() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<"checking" | "ready">("checking");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const [completed] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY).catch(() => null),
        wait(MIN_SPLASH_MS),
      ]);

      if (cancelled) return;

      if (completed === "true") {
        router.replace("/home");
        return;
      }

      setStatus("ready");
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View
      className="flex-1 items-center justify-between bg-muted"
      style={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }}
      accessible={false}
    >
      <View className="flex-1 items-center justify-center px-8">
        <Logo size="lg" tagline tone="dark" />
      </View>

      <View className="w-full px-8">
        {status === "checking" ? (
          <View className="items-center gap-3 pb-2" accessibilityLabel="Loading RouteZen" accessibilityRole="progressbar">
            <ActivityIndicator size="small" color="#0E4429" />
          </View>
        ) : (
          <>
            <Button
              label="Get Started"
              variant="primary"
              size="lg"
              onPress={() => router.replace("/onboarding")}
              accessibilityHint="Continue to the RouteZen introduction"
            />
            <Text className="mt-4 text-center text-xs text-ink-muted">
              Plan Travel{"  ·  "}Optimize Logistics
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
