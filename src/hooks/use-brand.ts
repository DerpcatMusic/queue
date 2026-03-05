import { useMemo } from "react";
import { getBrandPalette } from "@/constants/brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

/**
 * Hook to access the Brand palette.
 *
 * NOTE: We previously tried to inject a `__theme` property into PlatformColor objects
 * on Android to break React Native's `deepDiffer` cache. However, this destroys
 * the "OpaqueColorValue" branding, which crashes native components like NativeTabs.
 *
 * We keep PlatformColor values intact and only switch between pre-defined palette
 * sets at the hook level.
 */
export function useBrand() {
  const { resolvedScheme, stylePreference } = useThemePreference();
  return useMemo(
    () => getBrandPalette(stylePreference, resolvedScheme),
    [resolvedScheme, stylePreference],
  );
}
