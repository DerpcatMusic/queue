import type { ComponentType } from "react";
import { View, type ViewProps } from "react-native";

import { BrandRadius } from "@/constants/brand";

import { useKitTheme } from "./use-kit-theme";

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
  const { background, scheme } = useKitTheme();
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
            backgroundColor: background.surfaceElevated,
          }
        : tone === "sheet"
          ? {
              backgroundColor: background.sheet,
            }
          : tone === "sunken"
            ? { backgroundColor: background.panel }
            : isGlass
              ? { backgroundColor: background.glass }
              : { backgroundColor: background.panel }),
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
