import { useMemo } from "react";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { getTheme } from "@/lib/design-system";

export function useTheme() {
  const { resolvedScheme } = useThemePreference();
  return useMemo(() => getTheme(resolvedScheme), [resolvedScheme]);
}
