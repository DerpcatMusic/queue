import { type PropsWithChildren, useEffect } from "react";
import type { ColorValue, StyleProp, ViewProps, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { useKitTheme } from "@/components/ui/kit";
import { BrandRadius } from "@/constants/brand";
import { useSystemUi } from "@/contexts/system-ui-context";

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
  const { background } = useKitTheme();
  const { setTopInsetTone, setTopInsetBackgroundColor } = useSystemUi();
  const resolvedBackground = backgroundColor ?? background.sheet;
  const resolvedInsetColor = topInsetColor ?? resolvedBackground;

  useEffect(() => {
    setTopInsetTone("sheet");
    setTopInsetBackgroundColor(resolvedInsetColor);
    return () => {
      setTopInsetTone("app");
      setTopInsetBackgroundColor(null);
    };
  }, [resolvedInsetColor, setTopInsetBackgroundColor, setTopInsetTone]);

  return (
    <Animated.View
      pointerEvents={pointerEvents}
      style={[
        {
          borderBottomLeftRadius: BrandRadius.card + 4,
          borderBottomRightRadius: BrandRadius.card + 4,
          borderCurve: "continuous",
          overflow: "hidden",
          backgroundColor: resolvedBackground,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
