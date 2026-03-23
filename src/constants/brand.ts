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
  onPrimaryShadowStrong: ColorValue;
  onPrimaryShadowSoft: ColorValue;
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
  // Accent tones (for "accent" mode in rows/cards)
  accentLight: string; // accent background light mode
  accentDark: string; // accent background dark mode
  accentTextLight: string; // accent text light mode
  accentTextDark: string; // accent text dark mode
  accentRowBgLight: string; // accent row background light mode
  accentRowBgDark: string; // accent row background dark mode
  // Calendar (computed, not a seed)
  calendar: {
    accent: string;
    accentSubtle: string;
    eventSwatches: Array<{ background: string; title: string }>;
  };
  // Payments (computed, not a seed)
  payments: {
    accent: string;
    accentSubtle: string;
  };
  // Didit (computed, not a seed)
  didit: {
    accent: string;
    accentSubtle: string;
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
    onPrimaryShadowStrong: "#00000052",
    onPrimaryShadowSoft: "#0000003D",
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
    accentLight: "#EEF5FF",
    accentDark: "#1B2D49",
    accentTextLight: "#5B6B8A",
    accentTextDark: "#AFC3E8",
    accentRowBgLight: "#F7FAFF",
    accentRowBgDark: "#141C2A",
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
    payments: {
      accent: "#10B981",
      accentSubtle: "#D1FAE5",
    },
    didit: {
      accent: "#2F80FF",
      accentSubtle: "#E5F0FF",
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
    onPrimaryShadowStrong: "#00000052",
    onPrimaryShadowSoft: "#0000003D",
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
    accentLight: "#EEF5FF",
    accentDark: "#1B2D49",
    accentTextLight: "#5B6B8A",
    accentTextDark: "#AFC3E8",
    accentRowBgLight: "#F7FAFF",
    accentRowBgDark: "#141C2A",
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
    payments: {
      accent: "#34D399",
      accentSubtle: "#064E3B",
    },
    didit: {
      accent: "#2F80FF",
      accentSubtle: "#1E3A5F",
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
  hard: 12,
  medium: 18,
  soft: 24,
  pill: 999,
  card: 24,
  cardSubtle: 18,
  button: 20,
  buttonSubtle: 14,
  input: 20,
  icon: 999,
  circle: 999,
} as const;

export const BrandSpacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  componentPadding: 14,
  iconContainer: 38,
  iconContainerLarge: 78,
  haloSize: 180,
  mapMinHeight: 300,
  mapCanvasMinHeight: 320,
  multilineInputMinHeight: 96,
  stackTight: 8,
  stack: 12,
  stackRoomy: 16,
  stackLoose: 24,
  insetTight: 12,
  inset: 16,
  insetRoomy: 24,
  section: 32,
  controlX: 14,
  controlY: 12,
  controlSm: 38,
  controlMd: 44,
  controlLg: 52,
  iconSm: 18,
  iconMd: 24,
  iconLg: 32,
  avatarSm: 38,
  avatarMd: 48,
  avatarLg: 78,
  shellRail: 236,
  shellPanel: 320,
  shellCommandPanel: 360,
  statusDot: 6,
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

// ─── Mesh Gradient Presets ────────────────────────────────────────────────────

export type MeshGradientPreset = "primary" | "primaryDark";

export const BrandMeshGradient = {
  light: {
    primary: {
      // Uses exact brand purple #8B5CF6 with lighter tints
      gradient: `radial-gradient(ellipse at 25% 25%, #E8DDFF 0%, transparent 55%),
                  radial-gradient(ellipse at 80% 20%, #A78BFA 0%, transparent 50%),
                  radial-gradient(ellipse at 70% 80%, #C4B5FD 0%, transparent 45%),
                  #8B5CF6`,
      grainOpacity: 0.05,
    },
    primaryDark: {
      // Slightly darker variant
      gradient: `radial-gradient(ellipse at 25% 25%, #DDD6FE 0%, transparent 55%),
                 radial-gradient(ellipse at 80% 20%, #C4B5FD 0%, transparent 50%),
                 radial-gradient(ellipse at 70% 80%, #A78BFA 0%, transparent 45%),
                 #8B5CF6`,
      grainOpacity: 0.06,
    },
  },
  dark: {
    primary: {
      // Uses exact brand purple #8F6AFB with lighter tints
      gradient: `radial-gradient(ellipse at 25% 25%, #E8DDFF 0%, transparent 55%),
                 radial-gradient(ellipse at 80% 20%, #C4B5FD 0%, transparent 50%),
                 radial-gradient(ellipse at 70% 80%, #DDD6FE 0%, transparent 45%),
                 #8F6AFB`,
      grainOpacity: 0.06,
    },
    primaryDark: {
      // Lighter variant for dark surfaces
      gradient: `radial-gradient(ellipse at 25% 25%, #F0EDFF 0%, transparent 55%),
                 radial-gradient(ellipse at 80% 20%, #E8DDFF 0%, transparent 50%),
                 radial-gradient(ellipse at 70% 80%, #DDD6FE 0%, transparent 45%),
                 #A78BFA`,
      grainOpacity: 0.08,
    },
  },
} as const satisfies Record<
  ResolvedBrandScheme,
  Record<MeshGradientPreset, { gradient: string; grainOpacity: number }>
>;
