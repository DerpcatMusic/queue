import { useThemePreference } from "@/hooks/use-theme-preference";
import { getTheme } from "@/theme/theme";

export function useTheme() {
  const { resolvedScheme } = useThemePreference();
  return getTheme(resolvedScheme);
}
