import { type PropsWithChildren, useLayoutEffect } from "react";
import type { ColorValue } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Box } from "@/primitives";

export function AppSafeRoot({
  children,
  topInsetBackgroundColor,
}: PropsWithChildren<{ topInsetBackgroundColor: ColorValue }>) {
  const insets = useSafeAreaInsets();
  const animatedInsetColor = useSharedValue(String(topInsetBackgroundColor));

  useLayoutEffect(() => {
    animatedInsetColor.value = String(topInsetBackgroundColor);
  }, [animatedInsetColor, topInsetBackgroundColor]);

  const animatedInsetStyle = useAnimatedStyle(() => ({
    backgroundColor: animatedInsetColor.value,
  }));

  return (
    <Box style={{ flex: 1 }}>
      {/* Status bar background - always on top with zIndex */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            height: insets.top,
          },
          animatedInsetStyle,
        ]}
      />
      <Box style={{ flex: 1 }}>{children}</Box>
    </Box>
  );
}
