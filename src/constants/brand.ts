import { Color } from "expo-router";
import type { ColorValue } from "react-native";
import { Platform } from "react-native";
import { FEATURE_FLAGS } from "@/constants/feature-flags";
import {
  type GeneratedThemeTokens,
  generateThemeTokens,
  getTokenAliasMap,
  mapLegacyTokenPath,
  type ThemeSeed,
} from "@/constants/theme-generation";

import type { ThemeStylePreference } from "@/lib/theme-preference";

export type ResolvedBrandScheme = "light" | "dark";

type CalendarSwatch = { background: string; title: string };

type BrandCalendar = {
  accent: string;
  accentSubtle: string;
  eventSwatches: CalendarSwatch[];
};

export type BrandPalette = {
  appBg: ColorValue;
  surface: ColorValue;
  surfaceAlt: ColorValue;
  surfaceElevated: ColorValue;
  border: ColorValue;
  borderStrong: ColorValue;
  text: ColorValue;
  textMuted: ColorValue;
  textMicro: ColorValue;
  primary: ColorValue;
  primaryPressed: ColorValue;
  primarySubtle: ColorValue;
  onPrimary: ColorValue;
  success: string;
  successSubtle: string;
  danger: ColorValue;
  dangerSubtle: ColorValue;
  warning: string;
  warningSubtle: string;
  focusRing: ColorValue;
  tabBar: ColorValue;
  tabBarBorder: ColorValue;
  calendar: BrandCalendar;
  generated?: GeneratedThemeTokens;
};

// Native-first semantic color palette.
// On iOS this uses system adaptive colors.
// On Android this uses Material 3 dynamic colors.
// On web/fallback this uses static values.
export const NativeBrand: BrandPalette = {
  appBg: Platform.select({
    ios: Color.ios.systemGroupedBackground,
    android: Color.android.dynamic.background,
    default: "#f2f5f2",
  }),
  surface: Platform.select({
    ios: Color.ios.secondarySystemGroupedBackground,
    android: Color.android.dynamic.surface,
    default: "#ffffff",
  }),
  surfaceAlt: Platform.select({
    ios: Color.ios.tertiarySystemGroupedBackground,
    android: Color.android.dynamic.surfaceVariant,
    default: "#ecf1ec",
  }),
  surfaceElevated: Platform.select({
    ios: Color.ios.systemBackground,
    android: Color.android.dynamic.surface,
    default: "#f7faf7",
  }),
  border: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    default: "#d3dbd3",
  }),
  borderStrong: Platform.select({
    ios: Color.ios.opaqueSeparator,
    android: Color.android.dynamic.outline,
    default: "#b6c3b6",
  }),
  text: Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onBackground,
    default: "#131913",
  }),
  textMuted: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: "#5b685b",
  }),
  textMicro: Platform.select({
    ios: Color.ios.tertiaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: "#879387",
  }),
  primary: Platform.select({
    ios: Color.ios.systemGreen,
    android: Color.android.dynamic.primary,
    default: "#9be12c",
  }),
  primaryPressed: Platform.select({
    ios: Color.ios.systemGreen,
    android: Color.android.dynamic.primary,
    default: "#84c120",
  }),
  primarySubtle: Platform.select({
    ios: Color.ios.systemMint,
    android: Color.android.dynamic.primaryContainer,
    default: "#e9f8d1",
  }),
  onPrimary: Platform.select({
    ios: "#ffffff",
    android: Color.android.dynamic.onPrimary,
    default: "#ffffff",
  }),
  success: Platform.select({
    ios: Color.ios.systemGreen,
    android: Color.android.attr.colorSuccess,
    default: "#168a4a",
  }) as string,
  successSubtle: Platform.select({
    ios: Color.ios.systemMint,
    android: Color.android.attr.colorSuccessContainer,
    default: "#d4f0e2",
  }) as string,
  danger: Platform.select({
    ios: Color.ios.systemRed,
    android: Color.android.dynamic.error,
    default: "#c5333e",
  }),
  dangerSubtle: Platform.select({
    ios: Color.ios.systemPink,
    android: Color.android.dynamic.errorContainer,
    default: "#fce8ea",
  }),
  warning: Platform.select({
    ios: Color.ios.systemOrange,
    android: Color.android.attr.colorWarning,
    default: "#996b00",
  }) as string,
  warningSubtle: Platform.select({
    ios: Color.ios.systemYellow,
    android: Color.android.attr.colorWarningContainer,
    default: "#fff3cc",
  }) as string,
  focusRing: Platform.select({
    ios: Color.ios.systemGreen,
    android: Color.android.dynamic.primary,
    default: "#96d92f",
  }),
  tabBar: Platform.select({
    ios: "transparent",
    android: Color.android.dynamic.surfaceContainer,
    default: "#ffffff",
  }),
  tabBarBorder: Platform.select({
    ios: "transparent",
    android: Color.android.dynamic.outlineVariant,
    default: "#c9d5c9",
  }),
  calendar: {
    accent: Platform.select({
      ios: Color.ios.systemPink,
      android: Color.android.dynamic.tertiary,
      default: "#f6118f",
    }) as string,
    accentSubtle: Platform.select({
      ios: Color.ios.systemPink,
      android: Color.android.dynamic.tertiaryContainer,
      default: "#fce8ea",
    }) as string,
    eventSwatches: [
      {
        background: Platform.select({
          ios: Color.ios.systemMint,
          android: Color.android.dynamic.primaryContainer,
          default: "#e9f8d1",
        }) as string,
        title: Platform.select({
          ios: Color.ios.systemGreen,
          android: Color.android.dynamic.onPrimaryContainer,
          default: "#4f6d12",
        }) as string,
      },
      {
        background: Platform.select({
          ios: Color.ios.systemMint,
          android: Color.android.attr.colorSuccessContainer,
          default: "#d4f0e2",
        }) as string,
        title: Platform.select({
          ios: Color.ios.systemGreen,
          android: Color.android.attr.colorSuccess,
          default: "#168a4a",
        }) as string,
      },
      {
        background: Platform.select({
          ios: Color.ios.systemYellow,
          android: Color.android.attr.colorWarningContainer,
          default: "#fff3cc",
        }) as string,
        title: Platform.select({
          ios: Color.ios.systemOrange,
          android: Color.android.attr.colorWarning,
          default: "#996b00",
        }) as string,
      },
      {
        background: Platform.select({
          ios: Color.ios.systemPink,
          android: Color.android.dynamic.errorContainer,
          default: "#fce8ea",
        }) as string,
        title: Platform.select({
          ios: Color.ios.systemRed,
          android: Color.android.dynamic.onErrorContainer,
          default: "#c5333e",
        }) as string,
      },
    ],
  },
};

const CustomSeed: Record<ResolvedBrandScheme, ThemeSeed> = {
  light: {
    primary: "#FF5A1F", // Kinetic orange
    background: "#FFF6EE", // Warm chalk
    neutral: "#F1E4D6", // Warm athletic neutral
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
    accent: "#0F7BFF", // Sport-tech blue
  },
  dark: {
    primary: "#FF6A2D", // Heated orange
    background: "#0C0A08", // Warm ink black
    neutral: "#18130F", // Warm dark neutral
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    accent: "#46A1FF", // Brighter electric blue
  },
};

const StaticCustomBrand: Record<ResolvedBrandScheme, BrandPalette> = {
  light: {
    appBg: "#FFFFFF",
    surface: "#FFFFFF",
    surfaceAlt: "#F5F5F5",
    surfaceElevated: "#FFFFFF",
    border: "#E5E5E5",
    borderStrong: "#D4D4D4",
    text: "#0A0A0A",
    textMuted: "#737373",
    textMicro: "#A3A3A3",
    primary: "#FF4D00",
    primaryPressed: "#E64500",
    primarySubtle: "#FFF0E5",
    onPrimary: "#FFFFFF",
    success: "#16A34A",
    successSubtle: "#DCFCE7",
    danger: "#DC2626",
    dangerSubtle: "#FEE2E2",
    warning: "#D97706",
    warningSubtle: "#FEF3C7",
    focusRing: "#FF6A21",
    tabBar: "#FFFFFF",
    tabBarBorder: "#E5E5E5",
    calendar: {
      accent: "#FF4D00",
      accentSubtle: "#FFF0E5",
      eventSwatches: [
        { background: "#FFF0E5", title: "#CC3D00" },
        { background: "#DCFCE7", title: "#047857" },
        { background: "#FEF3C7", title: "#B45309" },
        { background: "#FEE2E2", title: "#BE123C" },
      ],
    },
  },
  dark: {
    appBg: "#000000",
    surface: "#111111",
    surfaceAlt: "#1A1A1A",
    surfaceElevated: "#171717",
    border: "#262626",
    borderStrong: "#404040",
    text: "#FAFAFA",
    textMuted: "#A3A3A3",
    textMicro: "#737373",
    primary: "#FF5500",
    primaryPressed: "#FF6A21",
    primarySubtle: "#331100",
    onPrimary: "#FFFFFF",
    success: "#22C55E",
    successSubtle: "#052E16",
    danger: "#EF4444",
    dangerSubtle: "#450A0A",
    warning: "#F59E0B",
    warningSubtle: "#451A03",
    focusRing: "#FF5500",
    tabBar: "#000000",
    tabBarBorder: "#262626",
    calendar: {
      accent: "#FF5500",
      accentSubtle: "#331100",
      eventSwatches: [
        { background: "#331100", title: "#FF5500" },
        { background: "#052E16", title: "#4ADE80" },
        { background: "#451A03", title: "#FBBF24" },
        { background: "#450A0A", title: "#F87171" },
      ],
    },
  },
};

const DEPRECATED_TOKEN_KEYS = new Set<string>(["textMicro", "tabBarBorder"]);
const warnedDeprecatedTokenKeys = new Set<string>();

function buildGeneratedCustomBrand(scheme: ResolvedBrandScheme): BrandPalette {
  const generated = generateThemeTokens(CustomSeed[scheme], scheme);

  return {
    appBg: generated.surface.app,
    surface: generated.surface.base,
    surfaceAlt: generated.surface.alt,
    surfaceElevated: generated.surface.elevated,
    border: generated.border.subtle,
    borderStrong: generated.border.strong,
    text: generated.text.primary,
    textMuted: generated.text.secondary,
    textMicro: generated.text.micro,
    primary: generated.brand.primary,
    primaryPressed: generated.brand.pressed,
    primarySubtle: generated.brand.subtle,
    onPrimary: generated.brand.onPrimary,
    success: generated.semantic.success.base,
    successSubtle: generated.semantic.success.subtle,
    danger: generated.semantic.danger.base,
    dangerSubtle: generated.semantic.danger.subtle,
    warning: generated.semantic.warning.base,
    warningSubtle: generated.semantic.warning.subtle,
    focusRing: generated.border.focus,
    tabBar: generated.overlay.tabBar,
    tabBarBorder: generated.overlay.tabBarBorder,
    calendar: {
      accent: generated.brand.accent,
      accentSubtle: generated.brand.subtle,
      eventSwatches: [
        {
          background: generated.brand.subtle,
          title: generated.brand.primary,
        },
        {
          background: generated.semantic.success.subtle,
          title: generated.semantic.success.base,
        },
        {
          background: generated.semantic.warning.subtle,
          title: generated.semantic.warning.base,
        },
        {
          background: generated.semantic.danger.subtle,
          title: generated.semantic.danger.base,
        },
      ],
    },
    generated,
  };
}

function maybeWrapDeprecatedTokenWarnings(palette: BrandPalette): BrandPalette {
  if (!FEATURE_FLAGS.generatedThemeAliasStrictMode || Platform.OS === "web") {
    return palette;
  }

  return new Proxy(palette, {
    get(target, prop, receiver) {
      if (
        typeof prop === "string" &&
        DEPRECATED_TOKEN_KEYS.has(prop) &&
        !warnedDeprecatedTokenKeys.has(prop)
      ) {
        warnedDeprecatedTokenKeys.add(prop);
        const mapped = mapLegacyTokenPath(prop);
        if (mapped) {
          console.warn(`[theme] legacy token \`${prop}\` used; prefer \`${mapped}\``);
        }
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

const NativeMapBrandPalette = {
  light: {
    styleBackground: "#edf2ee",
    zoneOutline: "#5e7565",
    zoneOutlineOpacity: 0.6,
    previewFill: "#b4ea78",
    previewFillOpacity: 0.24,
    previewOutline: "#7abf2a",
    previewOutlineOpacity: 0.68,
    selectedOutline: "#6fa722",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#e8eee9",
    primary: "#98db2a",
    text: "#141a15",
  },
  dark: {
    styleBackground: "#171c18",
    zoneOutline: "#607562",
    zoneOutlineOpacity: 0.72,
    previewFill: "#395526",
    previewFillOpacity: 0.3,
    previewOutline: "#9ce63d",
    previewOutlineOpacity: 0.8,
    selectedOutline: "#b8ff4a",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#1f2721",
    primary: "#b8ff4a",
    text: "#f2f6f2",
  },
} as const;

const CustomMapBrandPalette = {
  light: {
    styleBackground: "#edf2ee",
    zoneOutline: "#5f7564",
    zoneOutlineOpacity: 0.64,
    previewFill: "#c9ef98",
    previewFillOpacity: 0.25,
    previewOutline: "#84be34",
    previewOutlineOpacity: 0.72,
    selectedOutline: "#6da826",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#e7eee8",
    primary: "#a7f20f",
    text: "#131915",
  },
  dark: {
    styleBackground: "#141915",
    zoneOutline: "#637864",
    zoneOutlineOpacity: 0.74,
    previewFill: "#385424",
    previewFillOpacity: 0.3,
    previewOutline: "#a7f20f",
    previewOutlineOpacity: 0.84,
    selectedOutline: "#c7ff39",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#202922",
    primary: "#c7ff39",
    text: "#f1f6f1",
  },
} as const;

export function getBrandPalette(
  stylePreference: ThemeStylePreference,
  scheme: ResolvedBrandScheme,
): BrandPalette {
  void stylePreference;
  let custom: BrandPalette;
  try {
    custom = buildGeneratedCustomBrand(scheme);
  } catch {
    custom = StaticCustomBrand[scheme];
  }

  return maybeWrapDeprecatedTokenWarnings(custom);
}

export function getMapBrandPalette(
  stylePreference: ThemeStylePreference,
  scheme: ResolvedBrandScheme,
) {
  return stylePreference === "custom"
    ? CustomMapBrandPalette[scheme]
    : NativeMapBrandPalette[scheme];
}

export const Brand = getBrandPalette("custom", "light");
export const MapBrandPalette = NativeMapBrandPalette;

export function getThemeTokenAliasMap() {
  return getTokenAliasMap();
}

export const BrandRadius = {
  card: 24,
  button: 20,
  input: 20,
  pill: 999,
} as const;

export const BrandShadow = {
  raised: "none",
  soft: "none",
} as const;

export const BrandType = {
  display: {
    fontFamily: "Sekuya-Regular",
    fontSize: 54,
    fontWeight: "400" as const,
    letterSpacing: -1.0,
    lineHeight: 58,
  },
  heading: {
    fontFamily: "BarlowCondensed_700Bold",
    fontSize: 34,
    fontWeight: "500" as const,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  title: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 21,
    fontWeight: "500" as const,
    letterSpacing: -0.3,
    lineHeight: 27,
  },
  body: {
    fontFamily: "Rubik_400Regular",
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 23,
  },
  bodyMedium: {
    fontFamily: "Rubik_500Medium",
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 23,
  },
  bodyStrong: {
    fontFamily: "Rubik_500Medium",
    fontSize: 16,
    fontWeight: "500" as const,
    lineHeight: 23,
  },
  caption: {
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 20,
  },
  micro: {
    fontFamily: "Rubik_500Medium",
    fontSize: 12,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    lineHeight: 16,
  },
} as const;

export const BrandSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const BrandFonts = Platform.select({
  ios: {
    display: "Sekuya-Regular",
    heading: "BarlowCondensed_700Bold",
    body: "Rubik_400Regular",
    bodyMedium: "Rubik_500Medium",
    bodyStrong: "Rubik_600SemiBold",
    mono: "ui-monospace",
  },
  default: {
    display: "Sekuya-Regular",
    heading: "BarlowCondensed_700Bold",
    body: "Rubik_400Regular",
    bodyMedium: "Rubik_500Medium",
    bodyStrong: "Rubik_600SemiBold",
    mono: "monospace",
  },
  web: {
    display: "Sekuya-Regular",
    heading: "BarlowCondensed_700Bold",
    body: "Rubik_400Regular",
    bodyMedium: "Rubik_500Medium",
    bodyStrong: "Rubik_600SemiBold",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
