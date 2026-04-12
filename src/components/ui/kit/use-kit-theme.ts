import type { ColorValue } from "react-native";

import { useTheme } from "@/hooks/use-theme";

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
    contrast: ColorValue;
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
    contrast: ColorValue;
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
  const theme = useTheme();

  return {
    scheme: theme.scheme,
    color: {
      primary: theme.color.primary,
      primaryPressed: theme.color.primaryPressed,
      secondary: theme.color.secondary,
      danger: theme.color.danger,
      warning: theme.color.warning,
      success: theme.color.success,
    },
    background: {
      app: theme.color.appBg,
      sheet: theme.color.surface,
      surface: theme.color.surface,
      surfaceSecondary: theme.color.surfaceMuted,
      surfaceElevated: theme.color.surfaceElevated,
      panel: theme.color.surface,
      glass: theme.color.surface,
      primary: theme.color.primary,
      primarySubtle: theme.color.primarySubtle,
      dangerSubtle: theme.color.dangerSubtle,
      contrast: theme.color.surface,
    },
    foreground: {
      primary: theme.color.onPrimary,
      secondary: theme.color.text,
      muted: theme.color.textMuted,
      micro: theme.color.textMicro,
      danger: theme.color.danger,
    },
    border: {
      primary: theme.color.borderStrong,
      secondary: theme.color.border,
      highlight: theme.color.borderStrong,
      contrast: theme.color.border,
    },
    shadow: {
      primaryLift: "none",
      surface: "none",
    },
    interaction: {
      ripple: theme.color.primarySubtle,
      switchTrackOn: theme.color.primary,
      switchTrackOff: theme.color.border,
      switchThumbOn: theme.color.onPrimary,
      switchThumbOff: theme.color.surface,
    },
    symbol: {
      defaultTint: theme.color.primary,
    },
  } satisfies KitThemeTokens;
}
