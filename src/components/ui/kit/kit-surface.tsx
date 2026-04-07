import type { ComponentType, ReactNode } from "react";
import { memo } from "react";
import { View, type ViewProps } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

export type KitSurfaceTone = "base" | "elevated" | "glass" | "sheet" | "sunken";

export type KitSurfaceProps = ViewProps & {
  tone?: KitSurfaceTone;
  padding?: number;
  gap?: number;
  children?: ReactNode;
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

const styles = StyleSheet.create((theme) => ({
  base: {
    borderRadius: BrandRadius.card,
    borderCurve: "continuous" as const,
    overflow: "hidden" as const,
  },
  tone_base: {
    backgroundColor: theme.color.surfaceAlt,
  },
  tone_elevated: {
    backgroundColor: theme.color.surfaceElevated,
  },
  tone_glass: {
    backgroundColor: theme.color.surface,
  },
  tone_sheet: {
    backgroundColor: theme.color.surface,
  },
  tone_sunken: {
    backgroundColor: theme.color.surfaceAlt,
  },
}));

const KitSurface = memo(function KitSurface({
  tone = "base",
  padding = BrandSpacing.lg,
  gap = BrandSpacing.stackTight,
  children,
  style,
  ...rest
}: KitSurfaceProps) {
  const { resolvedScheme: scheme } = useThemePreference();
  const isGlass = tone === "glass";
  const allowNativeGlass = process.env.EXPO_OS === "ios";
  const glassModule = allowNativeGlass ? getGlassModule() : null;

  if (isGlass && glassModule && glassModule.isLiquidGlassAvailable()) {
    const GlassView = glassModule.GlassView;
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={scheme === "dark" ? "dark" : "light"}
        style={[styles.base, styles[`tone_${tone}`], { padding, gap }, style]}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[styles.base, styles[`tone_${tone}`], { padding, gap }, style]} {...rest}>
      {children}
    </View>
  );
});

export { KitSurface };
