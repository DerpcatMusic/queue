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

function resolveShadowColor(base: unknown, alpha: number, fallback: unknown) {
  const resolved = resolveAlphaColor(base, alpha, fallback);
  return typeof resolved === "string" ? resolved : TRANSPARENT;
}

function resolveStringColor(...colors: unknown[]) {
  for (const color of colors) {
    if (typeof color === "string") return color;
  }
  return undefined;
}

export function useKitTheme() {
  const { resolvedScheme: scheme, stylePreference } = useThemePreference();
  const palette = useBrand();

  return useMemo(() => {
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
    const primaryLiftShadow = `0 1px 1px ${resolveShadowColor(
      palette.text as unknown,
      0.26,
      palette.borderStrong as unknown,
    )}, 0 8px 22px ${resolveShadowColor(
      palette.primary as unknown,
      isCustomStyle ? 0.3 : 0.2,
      palette.borderStrong as unknown,
    )}`;
    const surfaceShadow = `0 1px 1px ${resolveShadowColor(
      palette.text as unknown,
      0.2,
      palette.borderStrong as unknown,
    )}, 0 8px 20px ${resolveShadowColor(
      palette.borderStrong as unknown,
      0.28,
      palette.border as unknown,
    )}`;

    return {
      palette,
      scheme,
      stylePreference,
      isCustomStyle,
      transparent: TRANSPARENT,
      glassBackground,
      highlightBorder,
      primaryLiftShadow,
      surfaceShadow,
      switchTrackOff: resolveAlphaColor(
        palette.borderStrong as unknown,
        0.5,
        palette.border as unknown,
      ),
      switchTrackOn: resolveAlphaColor(
        palette.primary as unknown,
        0.56,
        palette.primarySubtle as unknown,
      ),
      symbolTint: resolveStringColor(palette.primary, palette.text, palette.onPrimary),
    };
  }, [palette, scheme, stylePreference]);
}
