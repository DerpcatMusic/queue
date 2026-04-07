import { Stack } from "expo-router";
import { TabSubrouteStack } from "@/components/layout/tab-subroute-stack";

export default function InstructorJobsLayout() {
  return (
    <TabSubrouteStack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="studios/[studioId]" options={{ headerShown: true }} />
      <Stack.Screen
        name="studios/[studioId]/branches/[branchId]"
        options={{ headerShown: false }}
      />
    </TabSubrouteStack>
  );
}
