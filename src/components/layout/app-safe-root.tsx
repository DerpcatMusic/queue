import type { PropsWithChildren } from "react";
import type { ColorValue } from "react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function AppSafeRoot({
  children,
  topInsetBackgroundColor,
}: PropsWithChildren<{ topInsetBackgroundColor: ColorValue }>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      {/* Status bar background - always on top with zIndex */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          height: insets.top,
          backgroundColor: topInsetBackgroundColor,
        }}
      />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
