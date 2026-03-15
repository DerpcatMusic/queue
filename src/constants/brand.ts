import { Color } from "expo-router";
import type { ColorValue } from "react-native";
import { Platform } from "react-native";
import { generateThemeTokens, type ThemeSeed } from "@/constants/theme-generation";

export type ResolvedBrandScheme = "light" | "dark";

export type BrandPalette = {
  // Surfaces
  appBg: ColorValue;
  surface: ColorValue;
  surfaceAlt: ColorValue;
  surfaceElevated: ColorValue;
  // Borders
  border: ColorValue;
  borderStrong: ColorValue;
  // Text
  text: ColorValue;
  textMuted: ColorValue;
  // Brand
  primary: ColorValue;
  primarySubtle: ColorValue;
  secondary: ColorValue;
  onPrimary: ColorValue;
  // Semantic
  success: string;
  successSubtle: string;
  danger: ColorValue;
  dangerSubtle: ColorValue;
  warning: string;
  warningSubtle: string;
  // Calendar (computed, not a seed)
  calendar: {
    accent: string;
    accentSubtle: string;
    eventSwatches: Array<{ background: string; title: string }>;
  };
};

// ─── Seeds ────────────────────────────────────────────────────────────────────

const CustomSeed: Record<ResolvedBrandScheme, ThemeSeed> = {
  light: {
    primary: "#8B5CF6", // Vibrant violet/purple
    background: "#F7F4FC",
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
  },
  dark: {
    primary: "#A78BFA", // Lighter vibrant purple for dark mode
    background: "#110E16",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
};

// ─── Native platform palette ─────────────────────────────────────────────────

export const NativeBrand: BrandPalette = {
  appBg: Platform.select({
    ios: Color.ios.systemGroupedBackground,
    android: Color.android.dynamic.background,
    default: "#F7F4FC",
  }),
  surface: Platform.select({
    ios: Color.ios.secondarySystemGroupedBackground,
    android: Color.android.dynamic.surface,
    default: "#FFFFFF",
  }),
  surfaceAlt: Platform.select({
    ios: Color.ios.tertiarySystemGroupedBackground,
    android: Color.android.dynamic.surfaceVariant,
    default: "#EFEAF6",
  }),
  surfaceElevated: Platform.select({
    ios: Color.ios.systemBackground,
    android: Color.android.dynamic.surface,
    default: "#FFFFFF",
  }),
  border: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    default: "#D6CCE4",
  }),
  borderStrong: Platform.select({
    ios: Color.ios.opaqueSeparator,
    android: Color.android.dynamic.outline,
    default: "#B8AAC8",
  }),
  text: Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onBackground,
    default: "#1A1524",
  }),
  textMuted: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: "#6B5F7A",
  }),
  primary: Platform.select({
    ios: Color.ios.systemPurple,
    android: Color.android.dynamic.primary,
    default: "#9B72CF",
  }),
  primarySubtle: Platform.select({
    ios: Color.ios.systemPurple,
    android: Color.android.dynamic.primaryContainer,
    default: "#EDE0F7",
  }),
  secondary: Platform.select({
    ios: Color.ios.systemIndigo,
    android: Color.android.dynamic.secondary,
    default: "#7B8ACF",
  }),
  onPrimary: Platform.select({
    ios: "#FFFFFF",
    android: Color.android.dynamic.onPrimary,
    default: "#FFFFFF",
  }),
  success: Platform.select({
    ios: Color.ios.systemGreen,
    android: Color.android.attr.colorSuccess,
    default: "#16A34A",
  }) as string,
  successSubtle: Platform.select({
    ios: Color.ios.systemMint,
    android: Color.android.attr.colorSuccessContainer,
    default: "#DCFCE7",
  }) as string,
  danger: Platform.select({
    ios: Color.ios.systemRed,
    android: Color.android.dynamic.error,
    default: "#DC2626",
  }),
  dangerSubtle: Platform.select({
    ios: Color.ios.systemPink,
    android: Color.android.dynamic.errorContainer,
    default: "#FEE2E2",
  }),
  warning: Platform.select({
    ios: Color.ios.systemOrange,
    android: Color.android.attr.colorWarning,
    default: "#D97706",
  }) as string,
  warningSubtle: Platform.select({
    ios: Color.ios.systemYellow,
    android: Color.android.attr.colorWarningContainer,
    default: "#FEF3C7",
  }) as string,
  calendar: {
    accent: Platform.select({
      ios: Color.ios.systemPurple,
      android: Color.android.dynamic.tertiary,
      default: "#9B72CF",
    }) as string,
    accentSubtle: Platform.select({
      ios: Color.ios.systemPurple,
      android: Color.android.dynamic.tertiaryContainer,
      default: "#EDE0F7",
    }) as string,
    eventSwatches: [
      { background: "#EDE0F7", title: "#7B50A8" },
      { background: "#DCFCE7", title: "#16A34A" },
      { background: "#FEF3C7", title: "#D97706" },
      { background: "#FEE2E2", title: "#DC2626" },
    ],
  },
};

// ─── Auto-generated palette (always derived from seeds) ──────────────────────

function buildGeneratedCustomBrand(scheme: ResolvedBrandScheme): BrandPalette {
  const g = generateThemeTokens(CustomSeed[scheme], scheme);

  return {
    appBg: g.surface.app,
    surface: g.surface.base,
    surfaceAlt: g.surface.alt,
    surfaceElevated: g.surface.elevated,
    border: g.border.subtle,
    borderStrong: g.border.strong,
    text: g.text.primary,
    textMuted: g.text.secondary,
    primary: g.brand.primary,
    primarySubtle: g.brand.subtle,
    secondary: g.brand.secondary,
    onPrimary: g.brand.onPrimary,
    success: g.semantic.success.base,
    successSubtle: g.semantic.success.subtle,
    danger: g.semantic.danger.base,
    dangerSubtle: g.semantic.danger.subtle,
    warning: g.semantic.warning.base,
    warningSubtle: g.semantic.warning.subtle,
    calendar: {
      accent: g.brand.primary,
      accentSubtle: g.brand.subtle,
      eventSwatches: [
        { background: g.brand.subtle as string, title: g.brand.primary as string },
        {
          background: g.semantic.success.subtle as string,
          title: g.semantic.success.base as string,
        },
        {
          background: g.semantic.warning.subtle as string,
          title: g.semantic.warning.base as string,
        },
        { background: g.semantic.danger.subtle as string, title: g.semantic.danger.base as string },
      ],
    },
  };
}

// ─── Map palette (for native map component) ──────────────────────────────────

const NativeMapBrandPalette = {
  light: {
    styleBackground: "#F2EDF8",
    zoneOutline: "#8B7A9E",
    zoneOutlineOpacity: 0.6,
    previewFill: "#E8DDF2",
    previewFillOpacity: 0.26,
    previewOutline: "#8A60BF",
    previewOutlineOpacity: 0.68,
    selectedOutline: "#7B50A8",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#EFEAF6",
    primary: "#7C3AED", // Vibrant purple
    text: "#1A1524",
  },
  dark: {
    styleBackground: "#110E16",
    zoneOutline: "#8B7A9E",
    zoneOutlineOpacity: 0.72,
    previewFill: "#2A2040",
    previewFillOpacity: 0.3,
    previewOutline: "#C4A8F0",
    previewOutlineOpacity: 0.8,
    selectedOutline: "#D4C0F0",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#1E1828",
    primary: "#A78BFA", // Vibrant light purple
    text: "#F5F0FA",
  },
} as const;

// ─── Public API ──────────────────────────────────────────────────────────────

export function getBrandPalette(scheme: ResolvedBrandScheme): BrandPalette {
  return buildGeneratedCustomBrand(scheme);
}

export function getMapBrandPalette(scheme: ResolvedBrandScheme) {
  return NativeMapBrandPalette[scheme];
}

export const Brand = getBrandPalette("light");
export const MapBrandPalette = NativeMapBrandPalette;

// ─── Spacing & Radius ────────────────────────────────────────────────────────

export const BrandRadius = {
  card: 24,
  button: 20,
  input: 20,
  pill: 999,
} as const;

export const BrandSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const BrandType = {
  display: {
    fontFamily: "Rubik_700Bold",
    fontSize: 42,
    fontWeight: "700" as const,
    letterSpacing: -0.8,
    lineHeight: 46,
  },
  hero: {
    fontFamily: "BarlowCondensed_800ExtraBold",
    fontSize: 38,
    fontWeight: "800" as const,
    letterSpacing: -0.9,
    lineHeight: 36,
  },
  heroSmall: {
    fontFamily: "BarlowCondensed_800ExtraBold",
    fontSize: 30,
    fontWeight: "800" as const,
    letterSpacing: -0.8,
    lineHeight: 28,
  },
  heroCompact: {
    fontFamily: "BarlowCondensed_800ExtraBold",
    fontSize: 24,
    fontWeight: "800" as const,
    letterSpacing: -0.6,
    lineHeight: 22,
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

export const BrandFonts = Platform.select({
  ios: {
    display: "Rubik_700Bold",
    hero: "BarlowCondensed_800ExtraBold",
    heading: "Rubik_600SemiBold",
    body: "Rubik_400Regular",
    bodyMedium: "Rubik_500Medium",
    bodyStrong: "Rubik_600SemiBold",
    mono: "ui-monospace",
  },
  default: {
    display: "Rubik_700Bold",
    hero: "BarlowCondensed_800ExtraBold",
    heading: "Rubik_600SemiBold",
    body: "Rubik_400Regular",
    bodyMedium: "Rubik_500Medium",
    bodyStrong: "Rubik_600SemiBold",
    mono: "monospace",
  },
  web: {
    display: "Rubik_700Bold",
    hero: "BarlowCondensed_800ExtraBold",
    heading: "Rubik_600SemiBold",
    body: "Rubik_400Regular",
    bodyMedium: "Rubik_500Medium",
    bodyStrong: "Rubik_600SemiBold",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
