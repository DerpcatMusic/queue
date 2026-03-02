import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import Animated, {
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type { KitFloatingBadgeProps } from "./types";

export function KitFloatingBadge({
  children,
  visible = true,
  size = 24,
  backgroundColor,
  borderColor,
  motion = "float",
  style,
}: KitFloatingBadgeProps) {
  const floatOffset = useSharedValue(0);

  useEffect(() => {
    if (!visible || motion !== "float") {
      floatOffset.value = 0;
      return;
    }

    floatOffset.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 900 }),
        withTiming(0, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [floatOffset, motion, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatOffset.value }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      entering={ZoomIn.springify().damping(15).stiffness(180)}
      style={[
        {
          position: "absolute",
          top: -8,
          left: -8,
          width: size,
          height: size,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor,
          borderWidth: borderColor ? 1 : 0,
          borderColor,
        } satisfies ViewStyle,
        animatedStyle,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
