import { useEffect, useRef, useMemo } from "react";
import { useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { getThemeColors, type ThemeColors, type ThemeScheme } from "@/theme/theme";

// Color key type for ThemeColors
type ColorKey = keyof ThemeColors;

// Duration for theme color transitions (ms)
const THEME_TRANSITION_DURATION = 300;

/**
 * Returns animated theme colors that transition smoothly when scheme changes.
 *
 * How it works:
 * - Each color token has its own SharedValue<string> initialized to light colors
 * - When resolvedScheme changes, withTiming() animates all colors to new values
 * - Components read SharedValue.value in useAnimatedStyle for smooth native transitions
 *
 * Usage in a component:
 * ```ts
 * const animatedColors = useAnimatedThemeColors(resolvedScheme);
 *
 * const animatedStyle = useAnimatedStyle(() => ({
 *   backgroundColor: animatedColors.surface.value,
 *   color: animatedColors.text.value,
 * }));
 * ```
 */
export function useAnimatedThemeColors(
  resolvedScheme: ThemeScheme,
): Record<ColorKey, SharedValue<string>> {
  // Initialize all color SharedValues once (they persist across re-renders)
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svPrimary = useSharedValue(getThemeColors("light").primary as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svPrimarySubtle = useSharedValue(getThemeColors("light").primarySubtle as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svPrimaryPressed = useSharedValue(getThemeColors("light").primaryPressed as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svOnPrimary = useSharedValue(getThemeColors("light").onPrimary as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svSecondary = useSharedValue(getThemeColors("light").secondary as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svSecondarySubtle = useSharedValue(getThemeColors("light").secondarySubtle as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svOnSecondary = useSharedValue(getThemeColors("light").onSecondary as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svTertiary = useSharedValue(getThemeColors("light").tertiary as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svTertiarySubtle = useSharedValue(getThemeColors("light").tertiarySubtle as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svSuccess = useSharedValue(getThemeColors("light").success as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svSuccessSubtle = useSharedValue(getThemeColors("light").successSubtle as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svDanger = useSharedValue(getThemeColors("light").danger as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svDangerSubtle = useSharedValue(getThemeColors("light").dangerSubtle as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svWarning = useSharedValue(getThemeColors("light").warning as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svWarningSubtle = useSharedValue(getThemeColors("light").warningSubtle as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svAppBg = useSharedValue(getThemeColors("light").appBg as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svSurface = useSharedValue(getThemeColors("light").surface as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svSurfaceElevated = useSharedValue(getThemeColors("light").surfaceElevated as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svSurfaceMuted = useSharedValue(getThemeColors("light").surfaceMuted as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svBorder = useSharedValue(getThemeColors("light").border as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svBorderStrong = useSharedValue(getThemeColors("light").borderStrong as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svDivider = useSharedValue(getThemeColors("light").divider as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svText = useSharedValue(getThemeColors("light").text as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svTextMuted = useSharedValue(getThemeColors("light").textMuted as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svTextMicro = useSharedValue(getThemeColors("light").textMicro as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svOnSurface = useSharedValue(getThemeColors("light").onSurface as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svOverlay = useSharedValue(getThemeColors("light").overlay as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svShadow = useSharedValue(getThemeColors("light").shadow as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svJobsAccentHeat = useSharedValue(getThemeColors("light").jobsAccentHeat as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svJobsSignal = useSharedValue(getThemeColors("light").jobsSignal as string);
  // eslint-disable-next-line react-hooks/reanimated-thread-safe-usage
  const svJobsIdle = useSharedValue(getThemeColors("light").jobsIdle as string);

  // Build the color → SharedValue map (stable reference)
  const colorSvMap = useMemo<Record<ColorKey, SharedValue<string>>>(
    () => ({
      primary: svPrimary,
      primarySubtle: svPrimarySubtle,
      primaryPressed: svPrimaryPressed,
      onPrimary: svOnPrimary,
      secondary: svSecondary,
      secondarySubtle: svSecondarySubtle,
      onSecondary: svOnSecondary,
      tertiary: svTertiary,
      tertiarySubtle: svTertiarySubtle,
      success: svSuccess,
      successSubtle: svSuccessSubtle,
      danger: svDanger,
      dangerSubtle: svDangerSubtle,
      warning: svWarning,
      warningSubtle: svWarningSubtle,
      appBg: svAppBg,
      surface: svSurface,
      surfaceElevated: svSurfaceElevated,
      surfaceMuted: svSurfaceMuted,
      border: svBorder,
      borderStrong: svBorderStrong,
      divider: svDivider,
      text: svText,
      textMuted: svTextMuted,
      textMicro: svTextMicro,
      onSurface: svOnSurface,
      overlay: svOverlay,
      shadow: svShadow,
      jobsAccentHeat: svJobsAccentHeat,
      jobsSignal: svJobsSignal,
      jobsIdle: svJobsIdle,
    }),
    [
      svPrimary,
      svPrimarySubtle,
      svPrimaryPressed,
      svOnPrimary,
      svSecondary,
      svSecondarySubtle,
      svOnSecondary,
      svTertiary,
      svTertiarySubtle,
      svSuccess,
      svSuccessSubtle,
      svDanger,
      svDangerSubtle,
      svWarning,
      svWarningSubtle,
      svAppBg,
      svSurface,
      svSurfaceElevated,
      svSurfaceMuted,
      svBorder,
      svBorderStrong,
      svDivider,
      svText,
      svTextMuted,
      svTextMicro,
      svOnSurface,
      svOverlay,
      svShadow,
      svJobsAccentHeat,
      svJobsSignal,
      svJobsIdle,
    ],
  );

  // Track previous scheme for change detection (useRef to avoid stale closures)
  const previousSchemeRef = useRef<ThemeScheme>("light");

  // Animate colors when scheme changes
  useEffect(() => {
    const prev = previousSchemeRef.current;
    if (prev === resolvedScheme) {
      return;
    }

    const targetColors = getThemeColors(resolvedScheme);

    // Animate all colors to target values
    for (const key of Object.keys(targetColors) as ColorKey[]) {
      const sv = colorSvMap[key];
      sv.value = withTiming(targetColors[key] as string, {
        duration: THEME_TRANSITION_DURATION,
      });
    }

    previousSchemeRef.current = resolvedScheme;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previousSchemeRef is a useRef, always stable
  }, [resolvedScheme, colorSvMap]);

  return colorSvMap;
}

/**
 * Hook that returns the full ThemeColors object for a scheme.
 * Use for non-visual code that needs actual color string values.
 */
export function useThemeColors(scheme: ThemeScheme): ThemeColors {
  return getThemeColors(scheme);
}
