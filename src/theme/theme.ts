import { Appearance, StyleSheet as RNStyleSheet, type TextStyle } from "react-native";
import { createMMKV } from "react-native-mmkv";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

export type ThemeScheme = "light" | "dark";
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedBrandScheme = ThemeScheme;

const THEME_PREFERENCE_KEY = "app_theme_preference";
const storage = createMMKV({ id: "app-storage" });

export const Spacing = {
  xxs: 2,
  xs: 4,
  stackHair: 5,
  stackMicro: 6,
  sm: 8,
  stackDense: 10,
  md: 12,
  lg: 16,
  insetSoft: 18,
  insetComfort: 20,
  xl: 24,
  xxl: 32,
  component: 14,
  componentPadding: 14,
  control: 14,
  controlX: 14,
  controlY: 12,
  controlSm: 38,
  controlMd: 44,
  controlLg: 52,
  iconButtonSize: 54,
  listItemMinHeight: 56,
  successBurstBadge: 56,
  successBurstRing: 72,
  successBurstHeight: 112,
  section: 32,
  insetTight: 12,
  inset: 16,
  insetRoomy: 24,
  stackTight: 8,
  stack: 12,
  stackRoomy: 16,
  stackLoose: 24,
  iconContainer: 38,
  iconContainerLarge: 78,
  haloSize: 180,
  mapMinHeight: 300,
  mapCanvasMinHeight: 320,
  multilineInputMinHeight: 96,
  shellRail: 236,
  shellPanel: 320,
  shellCommandPanel: 360,
  statusDot: 6,
  statusDotBadge: 7,
  iconSm: 18,
  iconMd: 24,
  iconLg: 32,
  avatarSm: 38,
  avatarMd: 48,
  avatarLg: 78,
  avatarCard: 66,
  avatarXl: 68,
  progressPillInactive: 18,
  progressPillActive: 28,
  signalPulse: 20,
  // Badge dimensions
  badgeSize: 22,
  // Button minimum heights (xs=compact, sm=base, md=lg, lg=xl, xl=xxl)
  buttonMinHeightXs: 38,
  buttonMinHeightSm: 44,
  buttonMinHeightMd: 48,
  buttonMinHeightLg: 50,
  buttonMinHeightXl: 54,
} as const;

// Shadow tokens for text shadows (separate from Spacing since these are objects, not numbers)
export const Shadow = {
  text: {
    offset: { width: 0, height: 2 },
    radius: 4,
  },
} as const;

export const Radius = {
  sm: 4,
  md: 6,
  statusDot: 3,
  cardCompact: 6,
  lg: 8,
  xl: 12,
  hard: 4,
  medium: 8,
  soft: 12,
  card: 4,
  cardSubtle: 8,
  button: 4,
  buttonSubtle: 6,
  input: 4,
  pill: 4,
  full: 4,
  // Map-specific radii for overlays, markers, and highlights
  mapMarker: 12,
  mapOverlay: 8,
  mapHighlight: 4,
} as const;

export const BorderWidth = {
  hairline: RNStyleSheet.hairlineWidth,
  thin: 1,
  divider: 1, // For replacing height: 1 patterns with semantic token
  medium: 1.5,
  strong: 2,
  heavy: 3,
} as const;

export const Opacity = {
  disabled: 0.45,
  subtle: 0.72,
  muted: 0.6,
  overlay: 0.82,
  glow: 0.24,
} as const;

export const IconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  successBurst: 34,
  emptyState: 52,
} as const;

// Spring configurations for Reanimated
export const Spring = {
  // Standard spring - balanced damping for most UI
  standard: {
    damping: 20,
    stiffness: 200,
    mass: 1,
  },
  // Gentle spring - smoother, more overshoot
  gentle: {
    damping: 15,
    stiffness: 150,
    mass: 0.8,
  },
  // Bouncy spring - more playful, visible overshoot
  bouncy: {
    damping: 11,
    stiffness: 180,
    mass: 0.6,
  },
  // Snappy spring - fast response, minimal overshoot
  snappy: {
    damping: 24,
    stiffness: 300,
    mass: 0.8,
  },
} as const;

export const Motion = {
  instant: 0,
  fast: 140,
  normal: 220,
  slow: 320,
  emphasis: 420,
  // Stagger delay base (ms per item)
  staggerBase: 40,
  // Fade durations for content transitions
  skeletonFade: 200,
  contentReveal: 300,
} as const;

export const FontFamily = {
  display: "Lexend_700Bold",
  displayBold: "Lexend_800ExtraBold",
  displayBlack: "Lexend_800ExtraBold",
  heading: "Lexend_600SemiBold",
  title: "Lexend_500Medium",
  body: "Manrope_400Regular",
  bodyMedium: "Manrope_500Medium",
  bodyStrong: "Manrope_600SemiBold",
  label: "Manrope_500Medium",
  kanit: "Kanit_600SemiBold",
  kanitBold: "Kanit_700Bold",
  kanitExtraBold: "Kanit_800ExtraBold",
} as const;

export const FontSize = {
  display: 42,
  hero: 38,
  heroSmall: 30,
  heroCompact: 24,
  heading: 28,
  headingDisplay: 30,
  titleLarge: 22,
  title: 20,
  body: 16,
  caption: 14,
  micro: 12,
} as const;

export const LetterSpacing = {
  display: -0.8,
  hero: -0.9,
  heroSmall: -0.8,
  heroCompact: -0.6,
  heading: -0.45,
  initials: -0.3,
  title: -0.24,
  label: 0.2,
  trackingWide: 0.7,
  trackingRadar: 1.2,
} as const;

export const LineHeight = {
  display: 46,
  hero: 36,
  heroSmall: 28,
  heroCompact: 22,
  heading: 34,
  headingDisplay: 32,
  titleLarge: 26,
  title: 26,
  body: 22,
  caption: 19,
  micro: 16,
} as const;

export const Typography = {
  display: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.display,
    fontWeight: "700" as const,
    letterSpacing: LetterSpacing.display,
    lineHeight: LineHeight.display,
  } satisfies TextStyle,
  hero: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.hero,
    fontWeight: "700" as const,
    letterSpacing: LetterSpacing.hero,
    lineHeight: LineHeight.hero,
  } satisfies TextStyle,
  heroSmall: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.heroSmall,
    fontWeight: "700" as const,
    letterSpacing: LetterSpacing.heroSmall,
    lineHeight: LineHeight.heroSmall,
  } satisfies TextStyle,
  heroCompact: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.heroCompact,
    fontWeight: "700" as const,
    letterSpacing: LetterSpacing.heroCompact,
    lineHeight: LineHeight.heroCompact,
  } satisfies TextStyle,
  displayItalic: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.display,
    fontWeight: "900" as const,
    fontStyle: "italic",
    letterSpacing: LetterSpacing.display,
    lineHeight: LineHeight.display,
  } satisfies TextStyle,
  heroItalic: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.hero,
    fontWeight: "800" as const,
    fontStyle: "italic",
    letterSpacing: LetterSpacing.hero,
    lineHeight: LineHeight.hero,
  } satisfies TextStyle,
  headingItalic: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.heading,
    fontWeight: "700" as const,
    fontStyle: "italic",
    letterSpacing: LetterSpacing.heading,
    lineHeight: LineHeight.heading,
  } satisfies TextStyle,
  heading: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.heading,
    fontWeight: "600" as const,
    letterSpacing: LetterSpacing.heading,
    lineHeight: LineHeight.heading,
  } satisfies TextStyle,
  headingDisplay: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.headingDisplay,
    fontWeight: "600" as const,
    letterSpacing: LetterSpacing.heading,
    lineHeight: LineHeight.headingDisplay,
  } satisfies TextStyle,
  titleLarge: {
    fontFamily: FontFamily.title,
    fontSize: FontSize.titleLarge,
    fontWeight: "500" as const,
    letterSpacing: LetterSpacing.title,
    lineHeight: LineHeight.titleLarge,
  } satisfies TextStyle,
  title: {
    fontFamily: FontFamily.title,
    fontSize: FontSize.title,
    fontWeight: "500" as const,
    letterSpacing: LetterSpacing.title,
    lineHeight: LineHeight.title,
  } satisfies TextStyle,
  body: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: "400" as const,
    lineHeight: LineHeight.body,
  } satisfies TextStyle,
  bodyMedium: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.body,
    fontWeight: "500" as const,
    lineHeight: LineHeight.body,
  } satisfies TextStyle,
  bodyStrong: {
    fontFamily: FontFamily.bodyStrong,
    fontSize: FontSize.body,
    fontWeight: "600" as const,
    lineHeight: LineHeight.body,
  } satisfies TextStyle,
  caption: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    fontWeight: "400" as const,
    lineHeight: LineHeight.caption,
  } satisfies TextStyle,
  labelStrong: {
    fontFamily: FontFamily.bodyStrong,
    fontSize: FontSize.caption,
    fontWeight: "600" as const,
    lineHeight: LineHeight.caption,
  } satisfies TextStyle,
  micro: {
    fontFamily: FontFamily.label,
    fontSize: FontSize.micro,
    fontWeight: "500" as const,
    letterSpacing: LetterSpacing.label,
    lineHeight: LineHeight.micro,
  } satisfies TextStyle,
  microItalic: {
    fontFamily: FontFamily.label,
    fontSize: FontSize.micro,
    fontWeight: "700" as const,
    fontStyle: "italic",
    letterSpacing: 1.2,
    lineHeight: LineHeight.micro,
    textTransform: "uppercase",
  } satisfies TextStyle,
  radarLabel: {
    fontFamily: FontFamily.label,
    fontSize: FontSize.micro,
    fontWeight: "700" as const,
    letterSpacing: LetterSpacing.trackingRadar,
    lineHeight: LineHeight.micro,
    textTransform: "uppercase",
  } satisfies TextStyle,
} as const;

const lightColors = {
  // Brand — electric blue + burnt orange (complements blue, not clashes)
  primary: "#0044CC",
  primarySubtle: "#0044CC18",
  primaryPressed: "#0033AA",
  onPrimary: "#FFFFFF",
  secondary: "#CC4400",
  secondarySubtle: "#CC440015",
  onSecondary: "#FFFFFF",
  // Tertiary — slate for inactive/neutral states
  tertiary: "#4A5568",
  tertiarySubtle: "#4A556815",
  // Semantic — vibrant, not murky
  success: "#00AA55",
  successSubtle: "#00AA5518",
  danger: "#CC0000",
  dangerSubtle: "#CC000015",
  warning: "#CC6600",
  warningSubtle: "#CC660015",
  // Surfaces — 4 levels only
  appBg: "#F8F6F3",
  surface: "#FFFFFF",
  surfaceElevated: "#F5F3F0",
  surfaceMuted: "#E5E2DE",
  // Borders & dividers
  border: "#D4D0CB",
  borderStrong: "#A8A49D",
  divider: "#E0DDD8",
  // Text hierarchy
  text: "#0D0D0D",
  textMuted: "#5C5C5C",
  textMicro: "#8A8A8A",
  onSurface: "#0D0D0D",
  // Functional
  overlay: "#0D0D0DB3",
  shadow: "#0D0D0D20",
  // Jobs feature accents only — rest uses core tokens
  jobsAccentHeat: "#CC4400",
  jobsSignal: "#0044CC",
  jobsIdle: "#6B7280",
} as const;

const darkColors = {
  // Brand — vibrant saturated blue on dark, burnt orange complements
  primary: "#0055CC",
  primarySubtle: "#0055CC30",
  primaryPressed: "#0044AA",
  onPrimary: "#FFFFFF",
  secondary: "#CC5522",
  secondarySubtle: "#CC552220",
  onSecondary: "#FFFFFF",
  // Tertiary — slate for inactive/neutral states
  tertiary: "#8896A6",
  tertiarySubtle: "#8896A620",
  // Semantic — vibrant on dark
  success: "#00CC66",
  successSubtle: "#00CC6620",
  danger: "#FF3333",
  dangerSubtle: "#FF333325",
  warning: "#FF8833",
  warningSubtle: "#FF883320",
  // Surfaces — laddered elevation from true black
  appBg: "#0A0A0A",
  surface: "#141414",
  surfaceElevated: "#1C1C1C",
  surfaceMuted: "#242424",
  // Borders & dividers
  border: "#2A2A2A",
  borderStrong: "#3D3D3D",
  divider: "#1E1E1E",
  // Text hierarchy
  text: "#FFFFFF",
  textMuted: "#A0A0A0",
  textMicro: "#606060",
  onSurface: "#FFFFFF",
  // Functional
  overlay: "#000000CC",
  shadow: "#00000050",
  // Jobs feature accents only — rest uses core tokens
  jobsAccentHeat: "#CC5522",
  jobsSignal: "#66AAFF",
  jobsIdle: "#606060",
} as const;

export type ThemeColors = typeof lightColors | typeof darkColors;
export type SportsGenreTokens = {
  pilates: { surface: string; border: string; text: string };
  yoga: { surface: string; border: string; text: string };
  barre_flexibility: { surface: string; border: string; text: string };
  functional_strength: { surface: string; border: string; text: string };
  crossfit: { surface: string; border: string; text: string };
  performance: { surface: string; border: string; text: string };
  cycling: { surface: string; border: string; text: string };
  dance_fitness: { surface: string; border: string; text: string };
  combat_fitness: { surface: string; border: string; text: string };
  court_club: { surface: string; border: string; text: string };
};
export type SpaceToken = keyof typeof Spacing;
export type RadiusToken = keyof typeof Radius;
export type BorderWidthToken = keyof typeof BorderWidth;
export type TypographyToken = keyof typeof Typography;
export type IconSizeToken = keyof typeof IconSize;
export type MotionToken = keyof typeof Motion;
export type ColorToken = keyof ThemeColors;

export function getThemeColors(scheme: ThemeScheme): ThemeColors {
  return scheme === "dark" ? darkColors : lightColors;
}

const sportsGenreTokens = {
  pilates: { surface: "#F3BFD7", border: "#DF9FBD", text: "#8F4E69" },
  yoga: { surface: "#D4C9FF", border: "#B19EF0", text: "#6050A9" },
  barre_flexibility: { surface: "#FFD3A2", border: "#E8B273", text: "#935317" },
  functional_strength: { surface: "#CFE8B8", border: "#A9CB8D", text: "#486F31" },
  crossfit: { surface: "#FFE08A", border: "#E2C057", text: "#816100" },
  performance: { surface: "#BED7F4", border: "#8FB7E4", text: "#296184" },
  cycling: { surface: "#BFE8DE", border: "#89CDBD", text: "#256D63" },
  dance_fitness: { surface: "#F0B7D8", border: "#DA8CB8", text: "#924875" },
  combat_fitness: { surface: "#F2B3A9", border: "#DE8E82", text: "#943E36" },
  court_club: { surface: "#BEDFDC", border: "#86C8C1", text: "#23655E" },
} as const satisfies SportsGenreTokens;

export function createTheme(scheme: ThemeScheme) {
  const color = getThemeColors(scheme);
  return {
    scheme,
    color,
    spacing: Spacing,
    radius: Radius,
    borderWidth: BorderWidth,
    opacity: Opacity,
    iconSize: IconSize,
    motion: Motion,
    typography: Typography,
    fontFamily: FontFamily,
    jobs: {
      canvas: color.appBg,
      surface: color.surface,
      surfaceRaised: color.surfaceElevated,
      surfaceMuted: color.surfaceMuted,
      line: color.border,
      glow: color.primarySubtle,
      glowStrong: color.primarySubtle,
      heroTint: color.surfaceMuted,
      cardOverlay: color.surface,
      accentHeat: color.jobsAccentHeat,
      accentHeatSubtle: color.secondarySubtle,
      signal: color.jobsSignal,
      idle: color.jobsIdle,
    },
    sportsGenre: sportsGenreTokens,
    archive: {
      // Warm amber accent for archive-specific highlights and status
      accent: color.warning,
      accentSubtle: color.warningSubtle,
      // Golden-green for money/payment values — warm take on "success"
      pay: "#D4A012",
      paySubtle: "#D4A0121A",
      // Semantic statuses
      paid: color.success,
      paidSubtle: color.successSubtle,
      pending: color.warning,
      pendingSubtle: color.warningSubtle,
      cancelled: color.danger,
      cancelledSubtle: color.dangerSubtle,
      // Surfaces — use core surface tokens
      surface: color.surfaceMuted,
      surfaceElevated: color.surface,
      canvas: color.appBg,
    },
    shadow: {
      card: {
        shadowColor: color.shadow,
        shadowOpacity: 1, // opacity is baked into the color token
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 2,
      } as const,
      subtle: {
        shadowColor: color.shadow,
        shadowOpacity: 1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 1,
      } as const,
      hero: {
        shadowColor: color.shadow,
        shadowOpacity: 1,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 10 },
        elevation: 3,
      } as const,
    },
  } as const;
}

export type AppTheme = ReturnType<typeof createTheme>;

export type ArchiveTokens = {
  accent: string;
  accentSubtle: string;
  pay: string;
  paySubtle: string;
  paid: string;
  paidSubtle: string;
  pending: string;
  pendingSubtle: string;
  cancelled: string;
  cancelledSubtle: string;
  surface: string;
  surfaceElevated: string;
  canvas: string;
};

const themeCache: Record<ThemeScheme, AppTheme> = {
  light: createTheme("light"),
  dark: createTheme("dark"),
};

export const Breakpoints = {
  xs: 0,
  sm: 360,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export const AppThemes = {
  light: themeCache.light,
  dark: themeCache.dark,
} as const;

type AppBreakpoints = typeof Breakpoints;
type DeclaredThemes = typeof AppThemes;

declare module "react-native-unistyles" {
  export interface UnistylesThemes extends DeclaredThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

let isThemeConfigured = false;

function getInitialThemeName(): ThemeScheme {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

export function ensureThemeConfigured() {
  if (isThemeConfigured) {
    return;
  }

  try {
    StyleSheet.configure({
      settings: {
        initialTheme: getInitialThemeName(),
        CSSVars: false,
        nativeBreakpointsMode: "pixels",
      },
      breakpoints: Breakpoints,
      themes: AppThemes,
    });

    isThemeConfigured = true;
  } catch (error) {
    console.warn("[theme] Failed to configure Unistyles", error);
  }
}

ensureThemeConfigured();

export function getTheme(scheme: ThemeScheme): AppTheme {
  return themeCache[scheme];
}

export function resolveThemeScheme(
  preference: ThemePreference,
  systemScheme: ThemeScheme | null | undefined,
): ThemeScheme {
  return preference === "system" ? (systemScheme ?? "light") : preference;
}

function toThemePreference(value: string | null): ThemePreference | null {
  return value === "light" || value === "dark" || value === "system" ? value : null;
}

export function loadThemePreference(): ThemePreference | null {
  try {
    const stored = storage.getString(THEME_PREFERENCE_KEY);
    return toThemePreference(stored ?? null);
  } catch {
    return null;
  }
}

export function persistThemePreference(preference: ThemePreference): void {
  try {
    storage.set(THEME_PREFERENCE_KEY, preference);
  } catch {
    // Ignore persistence failures
  }
}

export function applyThemePreference(preference: ThemePreference): void {
  ensureThemeConfigured();

  const setColorScheme = (
    Appearance as {
      setColorScheme?: (scheme: "light" | "dark" | "unspecified" | null) => void;
    }
  ).setColorScheme;

  if (typeof setColorScheme === "function") {
    setColorScheme(preference === "system" ? "unspecified" : preference);
  }

  try {
    if (preference === "system") {
      UnistylesRuntime.setAdaptiveThemes(true);
      return;
    }

    UnistylesRuntime.setAdaptiveThemes(false);
    UnistylesRuntime.setTheme(preference);
    UnistylesRuntime.setRootViewBackgroundColor(getTheme(preference).color.appBg);
  } catch {
    if (preference !== "system") {
      try {
        UnistylesRuntime.setTheme(preference);
      } catch {
        // Ignore runtime setup failures until native config is active
      }
    }
  }
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  await persistThemePreference(preference);
  applyThemePreference(preference);
}

export type JobStatus = "open" | "filled" | "completed" | "cancelled";
export type ApplicationStatus = "pending" | "accepted" | "rejected";

export type StatusTokens = {
  fg: string | import("react-native").ColorValue;
  bg: string | import("react-native").ColorValue;
  border: string | import("react-native").ColorValue;
};

export function getJobStatusTokens(status: JobStatus, palette: ThemeColors): StatusTokens {
  switch (status) {
    case "open":
      return { fg: palette.primary, bg: palette.primarySubtle, border: palette.primary };
    case "filled":
    case "completed":
      return { fg: palette.success, bg: palette.successSubtle, border: palette.success };
    case "cancelled":
      return { fg: palette.danger, bg: palette.dangerSubtle, border: palette.danger };
    default:
      return { fg: palette.textMuted, bg: palette.surfaceMuted, border: palette.border };
  }
}

export function getApplicationStatusTokens(
  status: ApplicationStatus,
  palette: ThemeColors,
): StatusTokens {
  switch (status) {
    case "accepted":
      return { fg: palette.success, bg: palette.successSubtle, border: palette.success };
    case "rejected":
      return { fg: palette.danger, bg: palette.dangerSubtle, border: palette.danger };
    default:
      return { fg: palette.primary, bg: palette.primarySubtle, border: palette.primary };
  }
}

export const BrandSpacing = Spacing;
export const BrandRadius = Radius;
export const BrandType = Typography;

const NativeMapBrandPalette = {
  light: {
    // Base canvas — pearl
    styleBackground: "#F8F6F3",
    // Water — muted slate-blue
    waterFill: "#D2E5F5",
    waterLine: "#B6C9D8",
    // Landcover — pale mineral green
    landcover: "#D7DBC9",
    // Roads — soft clay neutrals
    roadPrimary: "#D7D0CA",
    roadSecondary: "#C9C1BA",
    roadTertiary: "#B8AEA7",
    // Buildings — darker clay to give urban structure
    buildingFill: "#AAA09A",
    buildingOpacity: 0.88,
    // Zone overlay — olive brand
    zoneOutline: "#747A60",
    zoneOutlineOpacity: 0.3,
    // Touch/hover preview
    previewFill: "#E3EBCF",
    previewFillOpacity: 0.2,
    previewOutline: "#93A55A",
    previewOutlineOpacity: 0.55,
    // Selected zone — brand green
    selectedOutline: "#506600",
    selectedOutlineOpacity: 1,
    surface: "#F8F6F3",
    primary: "#506600",
    markerAccent: "#5B6D7A",
    text: "#1E1B19",
    textHalo: "#F8F6F3",
  },
  dark: {
    // Base canvas — warm charcoal
    styleBackground: "#18181C",
    waterFill: "#1A3548",
    waterLine: "#244A65",
    landcover: "#232B22",
    // Roads — subtle warm gray
    roadPrimary: "#3A3835",
    roadSecondary: "#2E2B28",
    roadTertiary: "#262322",
    // Buildings — medium dark warm gray, dominant in dark mode
    buildingFill: "#2E2B28",
    buildingOpacity: 0.82,
    zoneOutline: "#5A6858",
    zoneOutlineOpacity: 0.42,
    previewFill: "#253025",
    previewFillOpacity: 0.22,
    previewOutline: "#7A9A6A",
    previewOutlineOpacity: 0.6,
    selectedOutline: "#9DD640",
    selectedOutlineOpacity: 1,
    surface: "#0A0A0A",
    primary: "#A5CF5A",
    markerAccent: "#4AAAE8",
    text: "#EDE9E4",
    textHalo: "#0A0A0A",
  },
} as const;

export function getMapBrandPalette(scheme: ResolvedBrandScheme) {
  return NativeMapBrandPalette[scheme];
}

export const MapBrandPalette = NativeMapBrandPalette;
