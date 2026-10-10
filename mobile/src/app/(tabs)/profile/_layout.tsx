import { Stack } from "expo-router";

/**
 * Nested stack for the Profile tab. Each screen renders its own
 * header/ScreenHeader matching the rest of the app's convention of
 * `headerShown: false` on the navigator.
 */
export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F4F6F3" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="places/index" />
      <Stack.Screen name="places/new" />
      <Stack.Screen name="places/[id]/edit" />
      <Stack.Screen name="reports/index" />
    </Stack>
  );
}
