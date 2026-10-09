import { Stack } from "expo-router";

/**
 * Nested stack for the Smart Travel tab. Each screen renders its own
 * `ScreenHeader` (from `src/components/ui`) for full control over
 * back/title/right-slot content, matching the rest of the app's
 * convention of `headerShown: false` on the navigator.
 */
export default function TravelLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F4F6F3" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/checkpoints" />
      <Stack.Screen name="[id]/routes" />
      <Stack.Screen name="[id]/preview" />
      <Stack.Screen name="[id]/budget" />
      <Stack.Screen name="[id]/itinerary" />
      <Stack.Screen name="[id]/places" />
    </Stack>
  );
}
