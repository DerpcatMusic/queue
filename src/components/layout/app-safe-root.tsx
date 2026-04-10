import { type PropsWithChildren, useLayoutEffect } from "react";
import type { ColorValue } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Box } from "@/primitives";

export function AppSafeRoot({
  children,
  topInsetBackgroundColor,
  rootBackgroundColor,
}: PropsWithChildren<{
  topInsetBackgroundColor: ColorValue;
  rootBackgroundColor: ColorValue;
}>) {
  const insets = useSafeAreaInsets();

  // Animate the status bar inset background
  const animatedInsetColor = useSharedValue(String(topInsetBackgroundColor));
  // Animate the root view background
  const animatedRootColor = useSharedValue(String(rootBackgroundColor));

  useLayoutEffect(() => {
    animatedInsetColor.value = withTiming(String(topInsetBackgroundColor), { duration: 300 });
  }, [animatedInsetColor, topInsetBackgroundColor]);

  useLayoutEffect(() => {
    animatedRootColor.value = withTiming(String(rootBackgroundColor), { duration: 300 });
  }, [animatedRootColor, rootBackgroundColor]);

  const animatedInsetStyle = useAnimatedStyle(() => ({
    backgroundColor: animatedInsetColor.value,
  }));

  const animatedRootStyle = useAnimatedStyle(() => ({
    backgroundColor: animatedRootColor.value,
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animatedRootStyle]}>
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
    </Animated.View>
  );
}
