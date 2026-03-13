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
    primary: "#6F7A58", // Muted olive
    background: "#F6F1E8", // Warm cream
    neutral: "#E8DED0", // Soft beige neutral
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
    accent: "#556B7B", // Restrained slate accent
  },
  dark: {
    primary: "#98A57E", // Muted sage
    background: "#171410", // Warm charcoal
    neutral: "#26211B", // Warm dark neutral
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    accent: "#8EA0AD", // Soft steel
  },
};

const StaticCustomBrand: Record<ResolvedBrandScheme, BrandPalette> = {
  light: {
    appBg: "#F7F1E8",
    surface: "#FFFDF9",
    surfaceAlt: "#EFE5D7",
    surfaceElevated: "#FFFFFF",
    border: "#D9CCBA",
    borderStrong: "#C8B8A2",
    text: "#231F1A",
    textMuted: "#73695D",
    textMicro: "#9A8F82",
    primary: "#6F7A58",
    primaryPressed: "#616B4C",
    primarySubtle: "#E2E6D8",
    onPrimary: "#FBFAF7",
    success: "#16A34A",
    successSubtle: "#DCFCE7",
    danger: "#DC2626",
    dangerSubtle: "#FEE2E2",
    warning: "#D97706",
    warningSubtle: "#FEF3C7",
    focusRing: "#7B8761",
    tabBar: "#F9F4EB",
    tabBarBorder: "#D9CCBA",
    calendar: {
      accent: "#6F7A58",
      accentSubtle: "#E2E6D8",
      eventSwatches: [
        { background: "#E2E6D8", title: "#556242" },
        { background: "#E8F2E8", title: "#25633B" },
        { background: "#F8E8C8", title: "#9A650B" },
        { background: "#F4DFDF", title: "#A43737" },
      ],
    },
  },
  dark: {
    appBg: "#181410",
    surface: "#201B16",
    surfaceAlt: "#2A241E",
    surfaceElevated: "#241F19",
    border: "#3A3025",
    borderStrong: "#504335",
    text: "#F5F0E7",
    textMuted: "#C1B4A6",
    textMicro: "#8E8174",
    primary: "#98A57E",
    primaryPressed: "#889472",
    primarySubtle: "#33402B",
    onPrimary: "#13110E",
    success: "#22C55E",
    successSubtle: "#052E16",
    danger: "#EF4444",
    dangerSubtle: "#450A0A",
    warning: "#F59E0B",
    warningSubtle: "#451A03",
    focusRing: "#A5B38A",
    tabBar: "#191511",
    tabBarBorder: "#3A3025",
    calendar: {
      accent: "#98A57E",
      accentSubtle: "#33402B",
      eventSwatches: [
        { background: "#33402B", title: "#D5DEC1" },
        { background: "#10311D", title: "#61D38D" },
        { background: "#50330E", title: "#F6C45F" },
        { background: "#4D1818", title: "#F29090" },
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
          console.warn(
            `[theme] legacy token \`${prop}\` used; prefer \`${mapped}\``,
          );
        }
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

const NativeMapBrandPalette = {
  light: {
    styleBackground: "#f1ebe2",
    zoneOutline: "#817561",
    zoneOutlineOpacity: 0.6,
    previewFill: "#dfe5d1",
    previewFillOpacity: 0.26,
    previewOutline: "#7b8761",
    previewOutlineOpacity: 0.68,
    selectedOutline: "#69744f",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#efe5d7",
    primary: "#6f7a58",
    text: "#231f1a",
  },
  dark: {
    styleBackground: "#1c1813",
    zoneOutline: "#887a66",
    zoneOutlineOpacity: 0.72,
    previewFill: "#394430",
    previewFillOpacity: 0.3,
    previewOutline: "#a5b38a",
    previewOutlineOpacity: 0.8,
    selectedOutline: "#c3d1a5",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#2a241e",
    primary: "#98a57e",
    text: "#f5f0e7",
  },
} as const;

export function getBrandPalette(scheme: ResolvedBrandScheme): BrandPalette {
  let custom: BrandPalette;
  try {
    custom = buildGeneratedCustomBrand(scheme);
  } catch {
    custom = StaticCustomBrand[scheme];
  }

  return maybeWrapDeprecatedTokenWarnings(custom);
}

export function getMapBrandPalette(scheme: ResolvedBrandScheme) {
  return NativeMapBrandPalette[scheme];
}

export const Brand = getBrandPalette("light");
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
    fontFamily: "Rubik_700Bold",
    fontSize: 42,
    fontWeight: "700" as const,
    letterSpacing: -0.8,
    lineHeight: 46,
  },
  heading: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 28,
    fontWeight: "600" as const,
    letterSpacing: -0.45,
    lineHeight: 34,
  },
  title: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 20,
    fontWeight: "600" as const,
    letterSpacing: -0.24,
    lineHeight: 26,
  },
  body: {
    fontFamily: "Rubik_400Regular",
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: "Rubik_500Medium",
    fontSize: 16,
    fontWeight: "500" as const,
    lineHeight: 22,
  },
  bodyStrong: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 22,
  },
  caption: {
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 19,
  },
  micro: {
    fontFamily: "Rubik_500Medium",
    fontSize: 12,
    fontWeight: "500" as const,
    letterSpacing: 0.2,
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
    display: "Rubik_700Bold",
    heading: "Rubik_600SemiBold",
    body: "Rubik_400Regular",
    bodyMedium: "Rubik_500Medium",
    bodyStrong: "Rubik_600SemiBold",
    mono: "ui-monospace",
  },
  default: {
    display: "Rubik_700Bold",
    heading: "Rubik_600SemiBold",
    body: "Rubik_400Regular",
    bodyMedium: "Rubik_500Medium",
    bodyStrong: "Rubik_600SemiBold",
    mono: "monospace",
  },
  web: {
    display: "Rubik_700Bold",
    heading: "Rubik_600SemiBold",
    body: "Rubik_400Regular",
    bodyMedium: "Rubik_500Medium",
    bodyStrong: "Rubik_600SemiBold",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
