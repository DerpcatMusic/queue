import { type PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { useTheme } from "@/hooks/use-theme";

// Tab scene transition is now handled by TabTransitionVeil in role-tabs-layout.
// No more conflicting translateY/scale animations that fight the veil.
// This component is now a simple wrapper.
export function TabSceneTransition({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const theme = useTheme();

  return <View style={[{ flex: 1, backgroundColor: theme.color.appBg }, style]}>{children}</View>;
}
