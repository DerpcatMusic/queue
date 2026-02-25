import { FEATURE_FLAGS } from "@/constants/feature-flags";
import {
  generateThemeTokens,
  getTokenAliasMap,
  mapLegacyTokenPath,
  type GeneratedThemeTokens,
  type ThemeSeed,
} from "@/constants/theme-generation";
import { Color } from "expo-router";
import { Platform } from "react-native";
import type { ColorValue } from "react-native";

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
const NativeBrand: BrandPalette = {
  appBg: Platform.select({
    ios: Color.ios.systemGroupedBackground,
    android: Color.android.dynamic.background,
    default: "#f4f7fb",
  }),
  surface: Platform.select({
    ios: Color.ios.secondarySystemGroupedBackground,
    android: Color.android.dynamic.surface,
    default: "#ffffff",
  }),
  surfaceAlt: Platform.select({
    ios: Color.ios.tertiarySystemGroupedBackground,
    android: Color.android.dynamic.surfaceVariant,
    default: "#edf3fb",
  }),
  surfaceElevated: Platform.select({
    ios: Color.ios.systemBackground,
    android: Color.android.dynamic.surface,
    default: "#f8fbff",
  }),
  border: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    default: "#d5deea",
  }),
  borderStrong: Platform.select({
    ios: Color.ios.opaqueSeparator,
    android: Color.android.dynamic.outline,
    default: "#bcc9da",
  }),
  text: Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onBackground,
    default: "#0d1219",
  }),
  textMuted: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: "#55657a",
  }),
  textMicro: Platform.select({
    ios: Color.ios.tertiaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: "#8a96a8",
  }),
  primary: Platform.select({
    ios: Color.ios.systemBlue,
    android: Color.android.dynamic.primary,
    default: "#0a84ff",
  }),
  primaryPressed: Platform.select({
    ios: Color.ios.systemBlue,
    android: Color.android.dynamic.primary,
    default: "#006edf",
  }),
  primarySubtle: Platform.select({
    ios: Color.ios.systemTeal,
    android: Color.android.dynamic.primaryContainer,
    default: "#dcecff",
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
    ios: Color.ios.systemBlue,
    android: Color.android.dynamic.primary,
    default: "#69aefc",
  }),
  tabBar: Platform.select({
    ios: "transparent",
    android: Color.android.dynamic.surfaceContainer,
    default: "#ffffff",
  }),
  tabBarBorder: Platform.select({
    ios: "transparent",
    android: Color.android.dynamic.outlineVariant,
    default: "#ccd8e8",
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
          ios: Color.ios.systemTeal,
          android: Color.android.dynamic.primaryContainer,
          default: "#dcecff",
        }) as string,
        title: Platform.select({
          ios: Color.ios.systemBlue,
          android: Color.android.dynamic.onPrimaryContainer,
          default: "#0d1219",
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
    primary: "#ff5500",
    background: "#f4f5f7",
    neutral: "#e2e8f0",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    accent: "#ff5500",
  },
  dark: {
    primary: "#ff5500",
    background: "#111318",
    neutral: "#2a2e35",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    accent: "#ff5500",
  },
};

const StaticCustomBrand: Record<ResolvedBrandScheme, BrandPalette> = {
  light: {
    appBg: "#F4F5F7",
    surface: "#FFFFFF",
    surfaceAlt: "#EAECEE",
    surfaceElevated: "#FFFFFF",
    border: "#D1D5DB",
    borderStrong: "#9CA3AF",
    text: "#111827",
    textMuted: "#6B7280",
    textMicro: "#9CA3AF",
    primary: "#FF5500",
    primaryPressed: "#CC4400",
    primarySubtle: "#FFE5D9",
    onPrimary: "#FFFFFF",
    success: "#10B981",
    successSubtle: "#D1FAE5",
    danger: "#EF4444",
    dangerSubtle: "#FEE2E2",
    warning: "#F59E0B",
    warningSubtle: "#FEF3C7",
    focusRing: "#FF884D",
    tabBar: "#FFFFFF",
    tabBarBorder: "#E5E7EB",
    calendar: {
      accent: "#FF5500",
      accentSubtle: "#FFE5D9",
      eventSwatches: [
        { background: "#FFE5D9", title: "#CC4400" },
        { background: "#D1FAE5", title: "#047857" },
        { background: "#FEF3C7", title: "#B45309" },
        { background: "#FEE2E2", title: "#B91C1C" },
      ],
    },
  },
  dark: {
    appBg: "#111318",
    surface: "#1A1D24",
    surfaceAlt: "#22252B",
    surfaceElevated: "#1A1D24",
    border: "#2A2E35",
    borderStrong: "#343A40",
    text: "#F8F9FA",
    textMuted: "#A0AAB5",
    textMicro: "#6B7280",
    primary: "#FF5500",
    primaryPressed: "#E64C00",
    primarySubtle: "#331100",
    onPrimary: "#FFFFFF",
    success: "#10B981",
    successSubtle: "#064E3B",
    danger: "#EF4444",
    dangerSubtle: "#7F1D1D",
    warning: "#F59E0B",
    warningSubtle: "#78350F",
    focusRing: "#FF884D",
    tabBar: "#111318",
    tabBarBorder: "#2A2E35",
    calendar: {
      accent: "#FF5500",
      accentSubtle: "#331100",
      eventSwatches: [
        { background: "#331100", title: "#FF884D" },
        { background: "#064E3B", title: "#34D399" },
        { background: "#78350F", title: "#FBBF24" },
        { background: "#7F1D1D", title: "#F87171" },
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
      if (typeof prop === "string" && DEPRECATED_TOKEN_KEYS.has(prop) && !warnedDeprecatedTokenKeys.has(prop)) {
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
    styleBackground: "#f2f3f4",
    zoneOutline: "#5a7a96",
    zoneOutlineOpacity: 0.6,
    previewFill: "#5ac8fa",
    previewFillOpacity: 0.2,
    previewOutline: "#007aff",
    previewOutlineOpacity: 0.65,
    selectedOutline: "#007aff",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#edf3fb",
    primary: "#0a84ff",
    text: "#0d1219",
  },
  dark: {
    styleBackground: "#1a1c22",
    zoneOutline: "#4a6a8a",
    zoneOutlineOpacity: 0.7,
    previewFill: "#2a5a8a",
    previewFillOpacity: 0.28,
    previewOutline: "#4f9eff",
    previewOutlineOpacity: 0.75,
    selectedOutline: "#5ac8fa",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#141c27",
    primary: "#2f8cff",
    text: "#f2f6ff",
  },
} as const;

const CustomMapBrandPalette = {
  light: {
    styleBackground: "#f3f6f9",
    zoneOutline: "#57748d",
    zoneOutlineOpacity: 0.62,
    previewFill: "#72d9f2",
    previewFillOpacity: 0.2,
    previewOutline: "#00b8de",
    previewOutlineOpacity: 0.68,
    selectedOutline: "#00c2e8",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#ecf1f6",
    primary: "#00c2e8",
    text: "#0f141b",
  },
  dark: {
    styleBackground: "#10161e",
    zoneOutline: "#4e6a86",
    zoneOutlineOpacity: 0.72,
    previewFill: "#276082",
    previewFillOpacity: 0.28,
    previewOutline: "#33cde8",
    previewOutlineOpacity: 0.78,
    selectedOutline: "#4edbf1",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#1a2230",
    primary: "#38d4ef",
    text: "#f1f5fb",
  },
} as const;

export function getBrandPalette(
  stylePreference: ThemeStylePreference,
  scheme: ResolvedBrandScheme,
): BrandPalette {
  if (stylePreference !== "custom") {
    return NativeBrand;
  }

  const custom = FEATURE_FLAGS.generatedThemeEnabled
    ? buildGeneratedCustomBrand(scheme)
    : StaticCustomBrand[scheme];

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

export const Brand = NativeBrand;
export const MapBrandPalette = NativeMapBrandPalette;

export function getThemeTokenAliasMap() {
  return getTokenAliasMap();
}

export const BrandRadius = {
  card: 20,
  button: 14,
  input: 12,
  pill: 999,
} as const;

export const BrandShadow = {
  raised: "none",
  soft: "none",
} as const;

export const BrandType = {
  display: {
    fontSize: 48,
    fontWeight: "800" as const,
    letterSpacing: -1,
    lineHeight: 52,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: -0.4,
    lineHeight: 34,
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    letterSpacing: -0.2,
    lineHeight: 26,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
  },
  bodyStrong: {
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    fontWeight: "500" as const,
    lineHeight: 18,
  },
  micro: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.4,
    lineHeight: 14,
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
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
