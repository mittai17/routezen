import { Stack } from "expo-router";

/**
 * Nested stack for the Logistics tab. Each screen renders its own
 * header/ScreenHeader matching the rest of the app's convention of
 * `headerShown: false` on the navigator.
 */
export default function LogisticsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F4F6F3" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="packages/index" />
      <Stack.Screen name="packages/new" />
      <Stack.Screen name="packages/[id]/index" />
      <Stack.Screen name="packages/[id]/edit" />
      <Stack.Screen name="packages/[id]/recommend" />
      <Stack.Screen name="vehicles/index" />
      <Stack.Screen name="scenarios/index" />
      <Stack.Screen name="scenarios/new" />
      <Stack.Screen name="scenarios/[id]/index" />
      <Stack.Screen name="scenarios/compare" />
    </Stack>
  );
}
