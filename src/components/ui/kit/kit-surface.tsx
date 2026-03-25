import type { ComponentType } from "react";
import { View, type ViewProps } from "react-native";

import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";

export type KitSurfaceTone = "base" | "elevated" | "glass" | "sheet" | "sunken";

export type KitSurfaceProps = ViewProps & {
  tone?: KitSurfaceTone;
  padding?: number;
  gap?: number;
};

type GlassModule = {
  GlassView: ComponentType<
    ViewProps & {
      glassEffectStyle?: "regular" | "clear" | "prominent";
      colorScheme?: "light" | "dark";
    }
  >;
  isLiquidGlassAvailable: () => boolean;
};

let cachedGlassModule: GlassModule | null | undefined;

function getGlassModule(): GlassModule | null {
  if (cachedGlassModule !== undefined) {
    return cachedGlassModule;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedGlassModule = require("expo-glass-effect") as GlassModule;
  } catch {
    cachedGlassModule = null;
  }
  return cachedGlassModule;
}

export function KitSurface({
  tone = "base",
  padding = BrandSpacing.lg,
  gap = BrandSpacing.stackTight,
  children,
  style,
  ...rest
}: KitSurfaceProps) {
  const { color } = useTheme();
  const { resolvedScheme: scheme } = useThemePreference();
  const isGlass = tone === "glass";
  const allowNativeGlass = process.env.EXPO_OS === "ios";
  const glassModule = allowNativeGlass ? getGlassModule() : null;
  const backgroundColor =
    tone === "elevated"
      ? color.surfaceElevated
      : tone === "glass" || tone === "sheet"
        ? color.surface
        : color.surfaceAlt;

  const baseStyle = [
    {
      borderRadius: BrandRadius.card,
      borderCurve: "continuous" as const,
      padding,
      gap,
      backgroundColor,
      overflow: "hidden" as const,
    },
    style,
  ];

  if (isGlass && glassModule && glassModule.isLiquidGlassAvailable()) {
    const GlassView = glassModule.GlassView;
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
