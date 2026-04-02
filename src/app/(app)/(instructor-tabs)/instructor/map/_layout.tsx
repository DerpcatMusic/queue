import { Stack } from "expo-router";

export default function InstructorMapLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="studios/[studioId]" options={{ headerShown: false }} />
      <Stack.Screen
        name="studios/[studioId]/branches/[branchId]"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}
