import type { ComponentType } from "react";
import { View, type ViewProps } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
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
  padding = 16,
  gap = 10,
  children,
  style,
  ...rest
}: KitSurfaceProps) {
  const palette = useBrand();
  const { resolvedScheme: scheme } = useThemePreference();
  const isGlass = tone === "glass";
  const allowNativeGlass = process.env.EXPO_OS === "ios";
  const glassModule = allowNativeGlass ? getGlassModule() : null;

  const baseStyle = [
    {
      borderRadius: BrandRadius.card,
      borderCurve: "continuous" as const,
      padding,
      gap,
      ...(tone === "elevated"
        ? {
            backgroundColor: palette.surfaceElevated as string,
          }
        : tone === "sheet"
          ? {
              backgroundColor: palette.surface as string,
            }
          : tone === "sunken"
            ? { backgroundColor: palette.surfaceAlt as string }
            : isGlass
              ? { backgroundColor: palette.surface as string }
              : { backgroundColor: palette.surfaceAlt as string }),
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
