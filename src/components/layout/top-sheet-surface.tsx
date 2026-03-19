import { type PropsWithChildren, useEffect } from "react";
import type { ColorValue, StyleProp, ViewProps, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { BrandRadius } from "@/constants/brand";
import { useSystemUi } from "@/contexts/system-ui-context";
import { useBrand } from "@/hooks/use-brand";

type TopSheetSurfaceProps = PropsWithChildren<{
  backgroundColor?: ColorValue;
  topInsetColor?: ColorValue;
  pointerEvents?: ViewProps["pointerEvents"];
  style?: StyleProp<ViewStyle>;
}>;

export function TopSheetSurface({
  children,
  backgroundColor,
  topInsetColor,
  pointerEvents,
  style,
}: TopSheetSurfaceProps) {
  const palette = useBrand();
  const { setTopInsetTone, setTopInsetBackgroundColor } = useSystemUi();
  const resolvedBackground = backgroundColor ?? palette.surface;
  const resolvedInsetColor = topInsetColor ?? resolvedBackground;
  const animatedBackground = useSharedValue(String(resolvedBackground));

  useEffect(() => {
    animatedBackground.value = withTiming(String(resolvedBackground), {
      duration: 220,
    });
  }, [animatedBackground, resolvedBackground]);

  useEffect(() => {
    setTopInsetTone("sheet");
    setTopInsetBackgroundColor(resolvedInsetColor);
    return () => {
      setTopInsetTone("app");
      setTopInsetBackgroundColor(null);
    };
  }, [resolvedInsetColor, setTopInsetBackgroundColor, setTopInsetTone]);

  const animatedBackgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: animatedBackground.value,
  }));

  return (
    <Animated.View
      pointerEvents={pointerEvents}
      style={[
        {
          // No marginTop — sheet extends behind the status bar overlay (zIndex 9999)
          // The AppSafeRoot overlay paints the same color on top — seamless
          borderBottomLeftRadius: BrandRadius.card + 4,
          borderBottomRightRadius: BrandRadius.card + 4,
          borderCurve: "continuous",
          overflow: "hidden",
        },
        animatedBackgroundStyle,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
