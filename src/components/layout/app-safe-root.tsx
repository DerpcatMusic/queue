import type { PropsWithChildren } from "react";
import type { ColorValue } from "react-native";
import { View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export function AppSafeRoot({
  children,
  topInsetBackgroundColor,
}: PropsWithChildren<{ topInsetBackgroundColor: ColorValue }>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      {/* Status bar background - overlay on top */}
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
      {/* Children wrapped in SafeAreaView for proper inset handling */}
      <SafeAreaView style={{ flex: 1 }} edges={[]}>
        {children}
      </SafeAreaView>
    </View>
  );
}
