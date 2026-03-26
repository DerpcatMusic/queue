import { useUnistyles as useBaseUnistyles } from "react-native-unistyles";

import type { AppTheme } from "@/theme/theme";

export function useUnistyles() {
  const { theme, rt } = useBaseUnistyles();

  return {
    theme: theme as AppTheme,
    rt,
    color: (theme as AppTheme).color,
    spacing: (theme as AppTheme).spacing,
    typography: (theme as AppTheme).typography,
  };
}
