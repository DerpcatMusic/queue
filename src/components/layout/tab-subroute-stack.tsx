import { Stack } from "expo-router";
import type { ReactNode } from "react";

export const TAB_SUBROUTE_SCREEN_OPTIONS = {
  headerShown: false,
  animation: "slide_from_right" as const,
};

type TabSubrouteStackProps = {
  children: ReactNode;
  initialRouteName?: string;
};

/**
 * Shared nested stack shell for routes pushed inside a role tab.
 * Keeping this centralized avoids transition drift between tabs.
 */
export function TabSubrouteStack({ children, initialRouteName }: TabSubrouteStackProps) {
  return (
    <Stack
      screenOptions={TAB_SUBROUTE_SCREEN_OPTIONS}
      {...(initialRouteName ? { initialRouteName } : {})}
    >
      {children}
    </Stack>
  );
}
