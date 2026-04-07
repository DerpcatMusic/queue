import { Stack } from "expo-router";
import { TabSubrouteStack } from "@/components/layout/tab-subroute-stack";

export default function StudioJobsLayout() {
  return (
    <TabSubrouteStack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="instructors/[instructorId]" options={{ headerShown: false }} />
    </TabSubrouteStack>
  );
}
