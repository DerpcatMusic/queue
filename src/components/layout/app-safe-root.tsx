import { type PropsWithChildren, useEffect } from "react";
import type { ColorValue } from "react-native";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function AppSafeRoot({
  children,
  topInsetBackgroundColor,
}: PropsWithChildren<{ topInsetBackgroundColor: ColorValue }>) {
  const insets = useSafeAreaInsets();
  const animatedInsetColor = useSharedValue(String(topInsetBackgroundColor));

  useEffect(() => {
    animatedInsetColor.value = withTiming(String(topInsetBackgroundColor), {
      duration: 220,
    });
  }, [animatedInsetColor, topInsetBackgroundColor]);

  const animatedInsetStyle = useAnimatedStyle(() => ({
    backgroundColor: animatedInsetColor.value,
  }));

  return (
    <View style={{ flex: 1 }}>
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
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
