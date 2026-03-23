import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import { BrandRadius, BrandSpacing } from "@/constants/brand";
import type { KitFloatingBadgeProps } from "./types";

export function KitFloatingBadge({
  children,
  visible = true,
  size = BrandSpacing.xxl - 8,
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
      withSequence(withTiming(-BrandSpacing.xs - 1, { duration: 900 }), withTiming(0, { duration: 900 })),
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
      className="absolute items-center justify-center"
      style={[
        {
          top: -BrandSpacing.sm,
          left: -BrandSpacing.sm,
          width: size,
          height: size,
          borderRadius: BrandRadius.pill,
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
