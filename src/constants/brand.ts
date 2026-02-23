import { Color } from "expo-router";
import { Platform, PlatformColor } from "react-native";

import type { ThemeStylePreference } from "@/lib/theme-preference";

export type ResolvedBrandScheme = "light" | "dark";

// Native-first semantic color palette.
// On iOS this uses system adaptive colors.
// On Android this uses Material 3 dynamic colors.
// On web/fallback this uses static values.
const NativeBrand = {
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
    ios: PlatformColor("systemTeal"),
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
  }),
  successSubtle: Platform.select({
    ios: PlatformColor("systemMint"),
    android: Color.android.attr.colorSuccessContainer,
    default: "#d4f0e2",
  }),
  danger: Platform.select({
    ios: Color.ios.systemRed,
    android: Color.android.dynamic.error,
    default: "#c5333e",
  }),
  dangerSubtle: Platform.select({
    ios: PlatformColor("systemPink"),
    android: Color.android.dynamic.errorContainer,
    default: "#fce8ea",
  }),
  warning: Platform.select({
    ios: Color.ios.systemOrange,
    android: Color.android.attr.colorWarning,
    default: "#996b00",
  }),
  warningSubtle: Platform.select({
    ios: PlatformColor("systemYellow"),
    android: Color.android.attr.colorWarningContainer,
    default: "#fff3cc",
  }),
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
    }),
    accentSubtle: Platform.select({
      ios: PlatformColor("systemPink"),
      android: Color.android.dynamic.tertiaryContainer,
      default: "#fce8ea",
    }),
    eventSwatches: [
      {
        background: Platform.select({
          ios: Color.ios.systemTeal,
          android: Color.android.dynamic.primaryContainer,
          default: "#dcecff",
        }),
        title: Platform.select({
          ios: Color.ios.systemBlue,
          android: Color.android.dynamic.onPrimaryContainer,
          default: "#0d1219",
        }),
      },
      {
        background: Platform.select({
          ios: Color.ios.systemMint,
          android: Color.android.attr.colorSuccessContainer,
          default: "#d4f0e2",
        }),
        title: Platform.select({
          ios: Color.ios.systemGreen,
          android: Color.android.attr.colorSuccess,
          default: "#168a4a",
        }),
      },
      {
        background: Platform.select({
          ios: Color.ios.systemYellow,
          android: Color.android.attr.colorWarningContainer,
          default: "#fff3cc",
        }),
        title: Platform.select({
          ios: Color.ios.systemOrange,
          android: Color.android.attr.colorWarning,
          default: "#996b00",
        }),
      },
      {
        background: Platform.select({
          ios: Color.ios.systemPink,
          android: Color.android.dynamic.errorContainer,
          default: "#fce8ea",
        }),
        title: Platform.select({
          ios: Color.ios.systemRed,
          android: Color.android.dynamic.onErrorContainer,
          default: "#c5333e",
        }),
      },
    ],
  },
} as const;

const CustomBrand = {
  light: {
    appBg: "#f4f6f8",
    surface: "#ffffff",
    surfaceAlt: "#eef2f5",
    surfaceElevated: "#ffffff",
    border: "#d6dde5",
    borderStrong: "#bcc8d6",
    text: "#0f141b",
    textMuted: "#5d6a79",
    textMicro: "#7f8c9b",
    primary: "#00c2e8",
    primaryPressed: "#00a6c7",
    primarySubtle: "#daf7fd",
    onPrimary: "#032029",
    success: "#1d8d56",
    successSubtle: "#dbf2e6",
    danger: "#ca3b53",
    dangerSubtle: "#fbe6ea",
    warning: "#9e6a00",
    warningSubtle: "#fff1c9",
    focusRing: "#58ccf0",
    tabBar: "#ffffff",
    tabBarBorder: "#dbe3ec",
    calendar: {
      accent: "#05afd1",
      accentSubtle: "#dcf7fd",
      eventSwatches: [
        { background: "#def7fd", title: "#066478" },
        { background: "#def1e8", title: "#1a7a4d" },
        { background: "#fff4d7", title: "#8f6200" },
        { background: "#fde6ea", title: "#a73143" },
      ],
    },
  },
  dark: {
    appBg: "#0c1015",
    surface: "#131922",
    surfaceAlt: "#1a2230",
    surfaceElevated: "#1b2432",
    border: "#2a3444",
    borderStrong: "#34455a",
    text: "#f1f5fb",
    textMuted: "#9aabbe",
    textMicro: "#7f92a8",
    primary: "#38d4ef",
    primaryPressed: "#1fbad6",
    primarySubtle: "#143b4c",
    onPrimary: "#04212a",
    success: "#38c97f",
    successSubtle: "#1d3e2e",
    danger: "#ff7082",
    dangerSubtle: "#4f2530",
    warning: "#ffc866",
    warningSubtle: "#453717",
    focusRing: "#64ddf5",
    tabBar: "#101722",
    tabBarBorder: "#223044",
    calendar: {
      accent: "#3ed8f1",
      accentSubtle: "#1f4654",
      eventSwatches: [
        { background: "#1b4450", title: "#99ecfa" },
        { background: "#1e4732", title: "#9fefc5" },
        { background: "#4a3c1d", title: "#ffe09e" },
        { background: "#4b2630", title: "#ffb4c1" },
      ],
    },
  },
} as const;

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
) {
  return stylePreference === "custom" ? CustomBrand[scheme] : NativeBrand;
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

export const BrandRadius = {
  card: 20,
  button: 14,
  input: 12,
  pill: 999,
} as const;

export const BrandShadow = {
  raised: "0 1px 1px rgba(2, 7, 20, 0.22), 0 8px 24px rgba(2, 12, 31, 0.2)",
  soft: "0 1px 1px rgba(6, 18, 37, 0.15), 0 4px 14px rgba(6, 18, 37, 0.12)",
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

export type BrandPalette = typeof NativeBrand;
