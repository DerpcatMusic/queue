import { Stack } from "expo-router";

/**
 * Profile section uses a nested Stack navigator so sub-screens
 * (sports, location, calendar settings) push on top of the main
 * profile settings list while the tab bar remains visible.
 */
export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
