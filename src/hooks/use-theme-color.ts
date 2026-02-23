import { useThemePreference } from "@/hooks/use-theme-preference";

/**
 * Hook to select a color based on the current theme mode.
 * 
 * NOTE: We avoid wrapping PlatformColor objects in plain JS objects as this 
 * breaks their internal "OpaqueColorValue" identity, causing native crashes.
 */
export function useThemeColor(
  props: { light?: any; dark?: any }
) {
  const { resolvedScheme } = useThemePreference();
  const theme = resolvedScheme ?? "light";
  return props[theme];
}
