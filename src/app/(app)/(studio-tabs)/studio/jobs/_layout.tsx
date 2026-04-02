import { Stack } from "expo-router";

export default function StudioJobsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="instructors/[instructorId]" options={{ headerShown: false }} />
    </Stack>
  );
}
