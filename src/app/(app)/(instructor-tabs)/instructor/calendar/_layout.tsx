import { Stack } from "expo-router";
import { TabSubrouteStack } from "@/components/layout/tab-subroute-stack";

export default function InstructorCalendarLayout() {
  return (
    <TabSubrouteStack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[jobId]" options={{ headerShown: false }} />
    </TabSubrouteStack>
  );
}
