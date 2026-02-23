import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { View, type ViewProps } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { useKitTheme } from "./use-kit-theme";

export type KitSurfaceTone = "base" | "elevated" | "glass" | "sunken";

export type KitSurfaceProps = ViewProps & {
  tone?: KitSurfaceTone;
  padding?: number;
  gap?: number;
};

export function KitSurface({
  tone = "base",
  padding = 16,
  gap = 10,
  children,
  style,
  ...rest
}: KitSurfaceProps) {
  const { palette, scheme, stylePreference, glassBackground, surfaceShadow } = useKitTheme();
  const isGlass = tone === "glass";
  const allowNativeGlass = stylePreference === "native" && process.env.EXPO_OS === "ios";

  const baseStyle = [
    {
      borderRadius: BrandRadius.card,
      borderCurve: "continuous" as const,
      borderWidth: 1,
      padding,
      gap,
      overflow: "hidden" as const,
      borderColor: tone === "sunken" ? palette.borderStrong : palette.border,
      backgroundColor:
        tone === "elevated"
          ? palette.surfaceElevated
          : tone === "sunken"
            ? palette.surfaceAlt
            : isGlass
              ? glassBackground
              : palette.surface,
      boxShadow: tone === "sunken" ? undefined : surfaceShadow,
    },
    style,
  ];

  if (isGlass && allowNativeGlass && isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={scheme === "dark" ? "dark" : "light"}
        style={baseStyle}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={baseStyle} {...rest}>
      {children}
    </View>
  );
}

