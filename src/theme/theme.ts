import { MMKV } from "react-native-mmkv";
import { Appearance, StyleSheet as RNStyleSheet, type TextStyle } from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

export type ThemeScheme = "light" | "dark";
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedBrandScheme = ThemeScheme;

const THEME_PREFERENCE_KEY = "app_theme_preference";
const storage = new MMKV({ id: "app-storage" });

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
  primary: "#5E8000",
  primarySubtle: "#5E80001A",
  primaryPressed: "#4F6C00",
  onPrimary: "#FFFFFF",
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
  appBg: "#F5EEE3",
  surface: "#FBF5EC",
  surfaceAlt: "#EFE4D0",
  surfaceElevated: "#FEFAF4",
  border: "#D7C9B2",
  borderStrong: "#C4B299",
  divider: "#E8DCC9",
  text: "#221B13",
  textMuted: "#6A5D4B",
  textMicro: "#94846D",
  onSurface: "#221B13",
  overlay: "#221B1370",
  shadow: "#5A432218",
  sheetGlow: "#FF5E0014",
  sheetGlowStrong: "#FF5E0024",
  jobsCanvas: "#F0E5D4",
  jobsSurface: "#F8EEDF",
  jobsSurfaceRaised: "#FDF5E9",
  jobsSurfaceMuted: "#EEE0CB",
  jobsLine: "#DBCAB0",
  jobsGlow: "#5E800018",
  jobsGlowStrong: "#5E80002E",
  jobsHeroTint: "#F0E8D4",
  jobsCardOverlay: "#FFFFFF00",
  jobsAccentHeat: "#D95400",
  jobsAccentHeatSubtle: "#FF5E001A",
  jobsSignal: "#6F8C3B",
  jobsIdle: "#9B8A71",
  outline: "#D7C9B2",
  outlineStrong: "#C4B299",
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
  appBg: "#0e0e0e",
  surface: "#0e0e0e",
  surfaceAlt: "#131313",
  surfaceElevated: "#181818",
  surfaceContainer: "#131313",
  surfaceContainerHigh: "#1A1A1A",
  surfaceContainerHighest: "#262626",
  border: "#2A2A2A",
  borderStrong: "#3A3A3A",
  divider: "#1E1E1E",
  text: "#FFFFFF",
  textMuted: "#A0A0A0",
  textMicro: "#686868",
  onSurface: "#FFFFFF",
  overlay: "#000000B3",
  shadow: "#00000040",
  sheetGlow: "#FF5E0020",
  sheetGlowStrong: "#FF5E0038",
  jobsCanvas: "#0A0A0A",
  jobsSurface: "#111111",
  jobsSurfaceRaised: "#181818",
  jobsSurfaceMuted: "#1C1C1C",
  jobsLine: "#252525",
  jobsGlow: "#CCFF0038",
  jobsGlowStrong: "#CCFF005C",
  jobsHeroTint: "#0E1200",
  jobsCardOverlay: "#080808CC",
  jobsAccentHeat: "#FF5E00",
  jobsAccentHeatSubtle: "#FF5E0020",
  jobsSignal: "#CCFF00",
  jobsIdle: "#787878",
  outline: "#2A2A2A",
  outlineStrong: "#3A3A3A",
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
      // Surfaces — slightly warmer than main surfaces
      surface: color.surfaceAlt,
      surfaceElevated: color.surface,
      canvas: color.appBg,
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
    // Base canvas — warm off-white, feels like quality paper
    styleBackground: "#F6F4F1",
    // Water — subtle Mediterranean blue
    waterFill: "#8BBFD4",
    waterLine: "#6FA8C2",
    // Landcover — muted sage, urban parks
    landcover: "#C8D9C4",
    // Roads — subtle warm gray, don't compete with buildings
    roadPrimary: "#CAC6C0",
    roadSecondary: "#BEB9B3",
    roadTertiary: "#ADA9A3",
    // Buildings — medium warm gray, the DOMINANT urban feature
    // This is what makes the map feel like a real city map
    buildingFill: "#9A9590",
    buildingOpacity: 0.88,
    // Zone overlay — muted olive
    zoneOutline: "#7A8C70",
    zoneOutlineOpacity: 0.3,
    // Touch/hover preview
    previewFill: "#D4E5CF",
    previewFillOpacity: 0.2,
    previewOutline: "#8AAF7A",
    previewOutlineOpacity: 0.55,
    // Selected zone — brand green
    selectedOutline: "#6DB82A",
    selectedOutlineOpacity: 1,
    surfaceAlt: "#F2F1EF",
    primary: "#8FBF3C",
    markerAccent: "#2A8FD8",
    text: "#2C2825",
    textHalo: "#F8F7F5",
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
    surfaceAlt: "#242220",
    primary: "#A5CF5A",
    markerAccent: "#4AAAE8",
    text: "#EDE9E4",
    textHalo: "#18181C",
  },
} as const;

export function getMapBrandPalette(scheme: ResolvedBrandScheme) {
  return NativeMapBrandPalette[scheme];
}

export const MapBrandPalette = NativeMapBrandPalette;
