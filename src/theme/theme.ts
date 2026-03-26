import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, StyleSheet as RNStyleSheet, type TextStyle } from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

export type ThemeScheme = "light" | "dark";
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedBrandScheme = ThemeScheme;

const THEME_PREFERENCE_KEY = "app_theme_preference";

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
  progressPillInactive: 18,
  progressPillActive: 28,
  signalPulse: 20,
} as const;

export const Radius = {
  sm: 4,
  md: 8,
  statusDot: 3,
  cardCompact: 10,
  lg: 12,
  xl: 16,
  hard: 12,
  medium: 18,
  soft: 24,
  card: 12,
  cardSubtle: 18,
  button: 8,
  buttonSubtle: 14,
  input: 8,
  pill: 999,
  full: 999,
} as const;

export const BorderWidth = {
  hairline: RNStyleSheet.hairlineWidth,
  thin: 1,
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

export const Motion = {
  instant: 0,
  fast: 140,
  normal: 220,
  slow: 320,
  emphasis: 420,
} as const;

export const FontFamily = {
  display: "Lexend_700Bold",
  displayBold: "Lexend_800ExtraBold",
  displayBlack: "Lexend_900Black",
  heading: "Lexend_600SemiBold",
  title: "Lexend_500Medium",
  body: "Manrope_400Regular",
  bodyMedium: "Manrope_500Medium",
  bodyStrong: "Manrope_600SemiBold",
  label: "Manrope_500Medium",
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
  primary: "#CCFF00",
  primarySubtle: "#CCFF001A",
  primaryPressed: "#B8E600",
  onPrimary: "#000000",
  secondary: "#FF5E00",
  secondarySubtle: "#FF5E001A",
  tertiary: "#00CCFF",
  tertiarySubtle: "#00CCFF1A",
  success: "#22C55E",
  successSubtle: "#22C55E1A",
  danger: "#EF4444",
  dangerSubtle: "#EF44441A",
  warning: "#F59E0B",
  warningSubtle: "#F59E0B1A",
  appBg: "#FAFAFA",
  surface: "#FFFFFF",
  surfaceAlt: "#F5F5F5",
  surfaceElevated: "#FFFFFF",
  border: "#E5E5E5",
  borderStrong: "#D4D4D4",
  divider: "#E5E5E5",
  text: "#000000",
  textMuted: "#737373",
  textMicro: "#A3A3A3",
  onSurface: "#000000",
  overlay: "#00000080",
  shadow: "#0000001A",
  jobsCanvas: "#F9F9F9",
  jobsSurface: "#FFFFFF",
  jobsSurfaceRaised: "#FFFFFF",
  jobsSurfaceMuted: "#F5F5F5",
  jobsLine: "#E5E5E5",
  jobsGlow: "#CCFF0018",
  jobsGlowStrong: "#CCFF0030",
  jobsHeroTint: "#F0F7E6",
  jobsCardOverlay: "#FFFFFF00",
  jobsAccentHeat: "#D95400",
  jobsAccentHeatSubtle: "#FF5E001A",
  jobsSignal: "#8FBF3C",
  jobsIdle: "#A3A3A3",
} as const;

const darkColors = {
  primary: "#CCFF00",
  primarySubtle: "#CCFF0014",
  primaryPressed: "#A8CC00",
  onPrimary: "#000000",
  secondary: "#FF5E00",
  secondarySubtle: "#FF5E0014",
  tertiary: "#00CCFF",
  tertiarySubtle: "#00CCFF14",
  success: "#4ADE80",
  successSubtle: "#4ADE8014",
  danger: "#F87171",
  dangerSubtle: "#F8717114",
  warning: "#FBBF24",
  warningSubtle: "#FBBF2414",
  appBg: "#000000",
  surface: "#171717",
  surfaceAlt: "#0A0A0A",
  surfaceElevated: "#262626",
  border: "#262626",
  borderStrong: "#404040",
  divider: "#262626",
  text: "#FFFFFF",
  textMuted: "#A3A3A3",
  textMicro: "#737373",
  onSurface: "#FFFFFF",
  overlay: "#000000B3",
  shadow: "#00000040",
  jobsCanvas: "#090909",
  jobsSurface: "#131313",
  jobsSurfaceRaised: "#191919",
  jobsSurfaceMuted: "#242424",
  jobsLine: "#313131",
  jobsGlow: "#CCFF0038",
  jobsGlowStrong: "#CCFF005C",
  jobsHeroTint: "#0E1200",
  jobsCardOverlay: "#080808CC",
  jobsAccentHeat: "#FF5E00",
  jobsAccentHeatSubtle: "#FF5E0020",
  jobsSignal: "#CCFF00",
  jobsIdle: "#787878",
} as const;

export type ThemeColors = typeof lightColors | typeof darkColors;
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
      canvas: color.jobsCanvas,
      surface: color.jobsSurface,
      surfaceRaised: color.jobsSurfaceRaised,
      surfaceMuted: color.jobsSurfaceMuted,
      line: color.jobsLine,
      glow: color.jobsGlow,
      glowStrong: color.jobsGlowStrong,
      heroTint: color.jobsHeroTint,
      cardOverlay: color.jobsCardOverlay,
      accentHeat: color.jobsAccentHeat,
      accentHeatSubtle: color.jobsAccentHeatSubtle,
      signal: color.jobsSignal,
      idle: color.jobsIdle,
    },
  } as const;
}

export type AppTheme = ReturnType<typeof createTheme>;

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

export async function loadThemePreference(): Promise<ThemePreference | null> {
  try {
    const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
    return toThemePreference(stored);
  } catch {
    return null;
  }
}

export async function persistThemePreference(preference: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
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
      return { fg: palette.textMuted, bg: palette.surfaceAlt, border: palette.border };
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
    styleBackground: "#F4F6F8",
    waterFill: "#B2D3ED",
    waterLine: "#84B2D9",
    landcover: "#E1E8DE",
    roadLine: "#EEF1F4",
    roadPrimary: "#E1E6EC",
    roadSecondary: "#CCD3DB",
    roadTertiary: "#B8C2CD",
    buildingFill: "#D8DDE3",
    zoneOutline: "#8E9C84",
    zoneOutlineOpacity: 0.28,
    previewFill: "#CFE5BC",
    previewFillOpacity: 0.14,
    previewOutline: "#95B85F",
    previewOutlineOpacity: 0.42,
    selectedOutline: "#8FBF3C",
    selectedOutlineOpacity: 1,
    surfaceAlt: "#F8FAFB",
    primary: "#8FBF3C",
    markerAccent: "#2AA8E8",
    text: "#252A31",
    textHalo: "#F8FAFB",
  },
  dark: {
    styleBackground: "#14181D",
    waterFill: "#1A3447",
    waterLine: "#365B76",
    landcover: "#1A2024",
    roadLine: "#2A3138",
    roadPrimary: "#4B5563",
    roadSecondary: "#343B44",
    roadTertiary: "#2B3138",
    buildingFill: "#20262C",
    zoneOutline: "#5A6870",
    zoneOutlineOpacity: 0.38,
    previewFill: "#253224",
    previewFillOpacity: 0.16,
    previewOutline: "#8CAF5A",
    previewOutlineOpacity: 0.56,
    selectedOutline: "#A5CF5A",
    selectedOutlineOpacity: 1,
    surfaceAlt: "#1B2026",
    primary: "#A5CF5A",
    markerAccent: "#59C6F6",
    text: "#E8EDF2",
    textHalo: "#1B2026",
  },
} as const;

export function getMapBrandPalette(scheme: ResolvedBrandScheme) {
  return NativeMapBrandPalette[scheme];
}

export const MapBrandPalette = NativeMapBrandPalette;
