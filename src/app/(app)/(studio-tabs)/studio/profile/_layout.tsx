import { Stack } from "expo-router";
import { useBrand } from "@/hooks/use-brand";

/**
 * Profile section uses a nested Stack navigator so sub-screens
 * (sports, location, calendar settings) push on top of the main
 * profile settings list while the tab bar remains visible.
 */
export default function ProfileLayout() {
  const palette = useBrand();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: palette.text as string,
        headerTitleStyle: { color: palette.text as string },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="payments" options={{ title: "Payments & payouts" }} />
    </Stack>
  );
}
