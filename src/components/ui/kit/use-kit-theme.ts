import { useMemo } from "react";
import type { ColorValue } from "react-native";

import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { alphaColor } from "./color-utils";

const TRANSPARENT = "transparent";

function resolveAlphaColor(base: unknown, alpha: number, fallback: unknown): ColorValue {
  const fromBase = alphaColor(base, alpha, TRANSPARENT);
  if (fromBase !== TRANSPARENT) return fromBase;
  const fromFallback = alphaColor(fallback, alpha, TRANSPARENT);
  if (fromFallback !== TRANSPARENT) return fromFallback;
  if (typeof fallback === "string") return fallback;
  if (typeof base === "string") return base;
  return TRANSPARENT;
}



function resolveStringColor(...colors: unknown[]) {
  for (const color of colors) {
    if (typeof color === "string") return color;
  }
  return undefined;
}

function resolveColorValue(primary: unknown, fallback: unknown, final: ColorValue): ColorValue {
  if (primary !== undefined && primary !== null) return primary as ColorValue;
  if (fallback !== undefined && fallback !== null) return fallback as ColorValue;
  return final;
}

export type KitThemeTokens = {
  scheme: "light" | "dark";
  stylePreference: "native" | "custom";
  isCustomStyle: boolean;
  color: {
    primary: ColorValue;
    primaryPressed: ColorValue;
    secondary: ColorValue;
    danger: ColorValue;
    warning: ColorValue;
    success: ColorValue;
  };
  background: {
    app: ColorValue;
    surface: ColorValue;
    surfaceSecondary: ColorValue;
    surfaceElevated: ColorValue;
    glass: ColorValue;
    primary: ColorValue;
    primarySubtle: ColorValue;
    dangerSubtle: ColorValue;
    transparent: ColorValue;
  };
  foreground: {
    primary: ColorValue;
    secondary: ColorValue;
    muted: ColorValue;
    micro: ColorValue;
    danger: ColorValue;
  };
  border: {
    primary: ColorValue;
    secondary: ColorValue;
    highlight: ColorValue;
    transparent: ColorValue;
  };
  shadow: {
    primaryLift: string;
    surface: string;
  };
  interaction: {
    ripple: ColorValue;
    switchTrackOn: ColorValue;
    switchTrackOff: ColorValue;
    switchThumbOn: ColorValue;
    switchThumbOff: ColorValue;
  };
  symbol: {
    defaultTint: string | undefined;
  };
};

export function useKitTheme() {
  const { resolvedScheme: scheme, stylePreference } = useThemePreference();
  const palette = useBrand();

  return useMemo<KitThemeTokens>(() => {
    const isCustomStyle = stylePreference === "custom";
    const glassBackground = resolveAlphaColor(
      palette.surface as unknown,
      isCustomStyle ? 0.9 : 0.84,
      palette.surfaceElevated as unknown,
    );
    const highlightBorder = resolveAlphaColor(
      palette.onPrimary as unknown,
      scheme === "dark" ? 0.24 : 0.36,
      palette.border as unknown,
    );
    const primaryLiftShadow = "none";
    const surfaceShadow = "none";
    const switchTrackOff = resolveAlphaColor(
      palette.borderStrong as unknown,
      0.5,
      palette.border as unknown,
    );
    const switchTrackOn = resolveAlphaColor(
      palette.primary as unknown,
      0.56,
      palette.primarySubtle as unknown,
    );

    return {
      scheme,
      stylePreference,
      isCustomStyle,
      color: {
        primary: palette.primary,
        primaryPressed: palette.primaryPressed,
        secondary: palette.text,
        danger: palette.danger,
        warning: resolveColorValue(palette.warning, palette.primary, palette.text),
        success: resolveColorValue(palette.success, palette.primary, palette.text),
      },
      background: {
        app: palette.appBg,
        surface: palette.surface,
        surfaceSecondary: palette.surfaceAlt,
        surfaceElevated: palette.surfaceElevated,
        glass: glassBackground,
        primary: palette.primary,
        primarySubtle: palette.primarySubtle,
        dangerSubtle: palette.dangerSubtle,
        transparent: TRANSPARENT,
      },
      foreground: {
        primary: palette.onPrimary,
        secondary: palette.text,
        muted: palette.textMuted,
        micro: palette.textMicro,
        danger: palette.danger,
      },
      border: {
        primary: palette.border,
        secondary: palette.borderStrong,
        highlight: highlightBorder,
        transparent: TRANSPARENT,
      },
      shadow: {
        primaryLift: primaryLiftShadow,
        surface: surfaceShadow,
      },
      interaction: {
        ripple: palette.primarySubtle,
        switchTrackOn,
        switchTrackOff,
        switchThumbOn: palette.primary,
        switchThumbOff: palette.surface,
      },
      symbol: {
        defaultTint: resolveStringColor(palette.primary, palette.text, palette.onPrimary),
      },
    };
  }, [palette, scheme, stylePreference]);
}
