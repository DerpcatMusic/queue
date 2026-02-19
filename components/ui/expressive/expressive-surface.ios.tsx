import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { StyleSheet, View } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { useExpressivePalette } from "./use-expressive-palette";
import type { ExpressiveSurfaceProps } from "./types";

export function ExpressiveSurface({
  tone = "default",
  padding = 16,
  gap = 10,
  style,
  children,
  ...rest
}: ExpressiveSurfaceProps) {
  const { palette, scheme, glassOverlay, shadowColor } = useExpressivePalette();

  const baseStyle = [
    styles.base,
    {
      padding,
      gap,
      borderColor: palette.border,
      shadowColor,
      backgroundColor:
        tone === "elevated" ? palette.surfaceElevated : palette.surface,
    },
    style,
  ];

  if (tone === "glass" && isGlassEffectAPIAvailable()) {
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
    <View
      style={[baseStyle, tone === "glass" ? { backgroundColor: glassOverlay } : null]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
});
