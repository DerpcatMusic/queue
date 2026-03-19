import { useMemo } from "react";
import type { ColorValue } from "react-native";

import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

const TRANSPARENT = "transparent";

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
    sheet: ColorValue;
    surface: ColorValue;
    surfaceSecondary: ColorValue;
    surfaceElevated: ColorValue;
    panel: ColorValue;
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
  const { resolvedScheme: scheme } = useThemePreference();
  const palette = useBrand();

  return useMemo<KitThemeTokens>(() => {
    const glassBackground = resolveColorValue(
      palette.surfaceElevated,
      palette.surface,
      palette.surface,
    );
    const panelBackground = resolveColorValue(
      palette.surfaceElevated,
      palette.surfaceAlt,
      palette.surface,
    );
    const highlightBorder = resolveColorValue(palette.borderStrong, palette.border, palette.border);
    const primaryLiftShadow = "none";
    const surfaceShadow = "none";
    const switchTrackOff = resolveColorValue(palette.borderStrong, palette.border, palette.border);
    const switchTrackOn = resolveColorValue(
      palette.primarySubtle,
      palette.primary,
      palette.primary,
    );

    return {
      scheme,
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
        sheet: palette.surface,
        surface: palette.surface,
        surfaceSecondary: palette.surfaceAlt,
        surfaceElevated: palette.surfaceElevated,
        panel: panelBackground,
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
        primary: resolveColorValue(palette.borderStrong, palette.border, palette.border),
        secondary: resolveColorValue(palette.border, palette.borderStrong, palette.border),
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
  }, [palette, scheme]);
}
