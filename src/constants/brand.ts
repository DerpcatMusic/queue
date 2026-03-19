import type { ColorValue } from "react-native";
import { Platform } from "react-native";

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
  textMicro: ColorValue;
  // Brand
  primary: ColorValue;
  primarySubtle: ColorValue;
  primaryPressed: ColorValue;
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

// ─── Explicit semantic palettes ──────────────────────────────────────────────

const ExplicitBrandPalette: Record<ResolvedBrandScheme, BrandPalette> = {
  light: {
    appBg: "#F6F4FB",
    surface: "#FFFFFF",
    surfaceAlt: "#F1ECF8",
    surfaceElevated: "#FFFFFF",
    border: "#DDD6EA",
    borderStrong: "#B8AFCB",
    text: "#181522",
    textMuted: "#6D6580",
    textMicro: "#8E86A0",
    primary: "#8B5CF6",
    primarySubtle: "#E8DDFF",
    primaryPressed: "#7443F0",
    secondary: "#5F73D8",
    onPrimary: "#FFFFFF",
    success: "#169C52",
    successSubtle: "#DDF7E6",
    danger: "#D43B4E",
    dangerSubtle: "#FFE3E8",
    warning: "#D68116",
    warningSubtle: "#FFF1D8",
    calendar: {
      accent: "#8B5CF6",
      accentSubtle: "#E8DDFF",
      eventSwatches: [
        { background: "#E8DDFF", title: "#6E46D8" },
        { background: "#DDF7E6", title: "#169C52" },
        { background: "#FFF1D8", title: "#D68116" },
        { background: "#FFE3E8", title: "#D43B4E" },
      ],
    },
  },
  dark: {
    appBg: "#0B0910",
    surface: "#18151F",
    surfaceAlt: "#262231",
    surfaceElevated: "#312C3D",
    border: "#433D51",
    borderStrong: "#5E566F",
    text: "#F7F4FE",
    textMuted: "#B8B0CA",
    textMicro: "#8C849E",
    primary: "#8F6AFB",
    primarySubtle: "#36285C",
    primaryPressed: "#7A55F3",
    secondary: "#9CACFF",
    onPrimary: "#FFFFFF",
    success: "#4CD789",
    successSubtle: "#183829",
    danger: "#FF6E81",
    dangerSubtle: "#411A24",
    warning: "#FFB84D",
    warningSubtle: "#43311A",
    calendar: {
      accent: "#8F6AFB",
      accentSubtle: "#36285C",
      eventSwatches: [
        { background: "#36285C", title: "#D1C2FF" },
        { background: "#183829", title: "#8AE4B1" },
        { background: "#43311A", title: "#FFD28A" },
        { background: "#411A24", title: "#FF9EAA" },
      ],
    },
  },
};

// ─── Map palette (for native map component) ──────────────────────────────────

const NativeMapBrandPalette = {
  light: {
    styleBackground: "#E8F0E7",
    waterFill: "#B9D7F2",
    waterLine: "#88B9E8",
    landcover: "#D5E8C8",
    roadLine: "#FFFFFF",
    buildingFill: "#E3DDD4",
    zoneOutline: "#8F9987",
    zoneOutlineOpacity: 0.28,
    previewFill: "#A8C8A0",
    previewFillOpacity: 0.14,
    previewOutline: "#7A8D74",
    previewOutlineOpacity: 0.42,
    selectedOutline: "#7C3AED",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#F7FBF4",
    primary: "#7C3AED", // Vibrant purple
    text: "#182018",
    textHalo: "#F7FBF4",
  },
  dark: {
    styleBackground: "#0E1412",
    waterFill: "#14344D",
    waterLine: "#22567D",
    landcover: "#18241B",
    roadLine: "#313942",
    buildingFill: "#22272B",
    zoneOutline: "#4C5A50",
    zoneOutlineOpacity: 0.38,
    previewFill: "#213126",
    previewFillOpacity: 0.16,
    previewOutline: "#657868",
    previewOutlineOpacity: 0.56,
    selectedOutline: "#A78BFA",
    selectedOutlineOpacity: 1.0,
    surfaceAlt: "#141C17",
    primary: "#A78BFA", // Vibrant light purple
    text: "#EEF3EA",
    textHalo: "#0E1412",
  },
} as const;

// ─── Public API ──────────────────────────────────────────────────────────────

export function getBrandPalette(scheme: ResolvedBrandScheme): BrandPalette {
  return ExplicitBrandPalette[scheme];
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
