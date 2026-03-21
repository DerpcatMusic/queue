export type ResolvedThemeScheme = "light" | "dark";

export type ThemeSeed = {
  primary: string;
  background: string;
  neutral: string;
  success: string;
  warning: string;
  danger: string;
  accent?: string;
};

export type ThemeGenerationOptions = {
  targetTextContrast: number;
  targetMutedTextContrast: number;
  minChroma: number;
  maxChroma: number;
};

export type GeneratedThemeTokens = {
  surface: {
    app: string;
    base: string;
    alt: string;
    elevated: string;
  };
  text: {
    primary: string;
    secondary: string;
    micro: string;
    inverse: string;
  };
  border: {
    subtle: string;
    strong: string;
    focus: string;
  };
  brand: {
    primary: string;
    pressed: string;
    subtle: string;
    onPrimary: string;
    accent: string;
  };
  semantic: {
    success: { base: string; subtle: string };
    warning: { base: string; subtle: string };
    danger: { base: string; subtle: string };
  };
  state: {
    disabled: string;
    overlay: string;
    ripple: string;
    selected: string;
  };
  elevation: {
    low: string;
    high: string;
  };
  overlay: {
    tabBar: string;
    tabBarBorder: string;
  };
};

export type TokenAliasMap = Record<string, string>;

type Oklch = { l: number; c: number; h: number };
type LinearRgb = { r: number; g: number; b: number };
type Rgb = { r: number; g: number; b: number };

const DEFAULT_OPTIONS: ThemeGenerationOptions = {
  targetTextContrast: 7.2,
  targetMutedTextContrast: 4.2,
  minChroma: 0.0, // Removed artificial tinting (was 0.04)
  maxChroma: 0.42,
};

const TOKEN_ALIAS_MAP: TokenAliasMap = {
  appBg: "surface.app",
  surface: "surface.base",
  surfaceAlt: "surface.alt",
  surfaceElevated: "surface.elevated",
  border: "border.subtle",
  borderStrong: "border.strong",
  text: "text.primary",
  textMuted: "text.secondary",
  textMicro: "text.micro",
  primary: "brand.primary",
  primaryPressed: "brand.pressed",
  primarySubtle: "brand.subtle",
  onPrimary: "brand.onPrimary",
  success: "semantic.success.base",
  successSubtle: "semantic.success.subtle",
  danger: "semantic.danger.base",
  dangerSubtle: "semantic.danger.subtle",
  warning: "semantic.warning.base",
  warningSubtle: "semantic.warning.subtle",
  focusRing: "border.focus",
  tabBar: "overlay.tabBar",
  tabBarBorder: "overlay.tabBarBorder",
};

const CACHE = new Map<string, GeneratedThemeTokens>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseHexColor(hex: string): Rgb {
  const normalized = hex.trim().replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;
  if (full.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(color: Rgb): string {
  const toHex = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function mixHexColors(foreground: string, background: string, backgroundWeight: number): string {
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);
  const clampedWeight = clamp(backgroundWeight, 0, 1);
  const foregroundWeight = 1 - clampedWeight;

  return rgbToHex({
    r: fg.r * foregroundWeight + bg.r * clampedWeight,
    g: fg.g * foregroundWeight + bg.g * clampedWeight,
    b: fg.b * foregroundWeight + bg.b * clampedWeight,
  });
}

function srgbToLinear(value: number): number {
  const normalized = value / 255;
  if (normalized <= 0.04045) return normalized / 12.92;
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  const clamped = clamp(value, 0, 1);
  if (clamped <= 0.0031308) return clamped * 12.92 * 255;
  return (1.055 * clamped ** (1 / 2.4) - 0.055) * 255;
}

function rgbToLinear(rgb: Rgb): LinearRgb {
  return {
    r: srgbToLinear(rgb.r),
    g: srgbToLinear(rgb.g),
    b: srgbToLinear(rgb.b),
  };
}

function linearToRgb(linear: LinearRgb): Rgb {
  return {
    r: linearToSrgb(linear.r),
    g: linearToSrgb(linear.g),
    b: linearToSrgb(linear.b),
  };
}

function linearToOklab(linear: LinearRgb) {
  const l = 0.4122214708 * linear.r + 0.5363325363 * linear.g + 0.0514459929 * linear.b;
  const m = 0.2119034982 * linear.r + 0.6806995451 * linear.g + 0.1073969566 * linear.b;
  const s = 0.0883024619 * linear.r + 0.2817188376 * linear.g + 0.6299787005 * linear.b;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  };
}

function oklabToLinear(lab: { l: number; a: number; b: number }): LinearRgb {
  const l_ = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function rgbToOklch(rgb: Rgb): Oklch {
  const lab = linearToOklab(rgbToLinear(rgb));
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  const rawH = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  const h = rawH < 0 ? rawH + 360 : rawH;
  return { l: lab.l, c, h };
}

function oklchToRgb(oklch: Oklch): Rgb {
  const hRad = (oklch.h * Math.PI) / 180;
  const lab = {
    l: oklch.l,
    a: oklch.c * Math.cos(hRad),
    b: oklch.c * Math.sin(hRad),
  };
  return linearToRgb(oklabToLinear(lab));
}

function luminance(hex: string): number {
  const rgb = parseHexColor(hex);
  const linear = rgbToLinear(rgb);
  return 0.2126 * linear.r + 0.7152 * linear.g + 0.0722 * linear.b;
}

function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

function tuneTextOnBackground(background: string, preferDark: boolean, minRatio: number): string {
  const bg = parseHexColor(background);
  const bgOklch = rgbToOklch(bg);
  const base = rgbToOklch(parseHexColor(preferDark ? "#12161b" : "#f8fbff"));
  let candidate = { ...base, h: bgOklch.h, c: clamp(base.c, 0.02, 0.08) };

  for (let i = 0; i < 24; i += 1) {
    const next = rgbToHex(oklchToRgb(candidate));
    if (contrastRatio(next, background) >= minRatio) {
      return next;
    }
    candidate = {
      ...candidate,
      l: clamp(candidate.l + (preferDark ? -0.03 : 0.03), 0.02, 0.98),
    };
  }

  return preferDark ? "#111827" : "#f8fafc";
}

function softenTextOnBackground(
  text: string,
  background: string,
  initialBackgroundWeight: number,
  minRatio: number,
): string {
  let weight = clamp(initialBackgroundWeight, 0, 0.82);

  for (let i = 0; i < 8; i += 1) {
    const candidate = mixHexColors(text, background, weight);
    if (contrastRatio(candidate, background) >= minRatio) {
      return candidate;
    }
    weight = Math.max(0, weight - 0.08);
  }

  return text;
}

function derive(base: Oklch, overrides: Partial<Oklch>, options: ThemeGenerationOptions): string {
  // We carefully clamp chroma to the options minimum, EXCEPT if the caller explicitly requests extremely low chroma
  // to avoid tinting deep/dark backgrounds with an artificial hue.
  const targetC = overrides.c ?? base.c;
  const isNeutralRequested = overrides.c !== undefined && overrides.c < options.minChroma;

  return rgbToHex(
    oklchToRgb({
      l: clamp(overrides.l ?? base.l, 0.02, 0.98),
      c: isNeutralRequested ? targetC : clamp(targetC, options.minChroma, options.maxChroma),
      h: overrides.h ?? base.h,
    }),
  );
}

function createKey(
  seed: ThemeSeed,
  scheme: ResolvedThemeScheme,
  options: ThemeGenerationOptions,
): string {
  return JSON.stringify({ seed, scheme, options });
}

export function getTokenAliasMap() {
  return TOKEN_ALIAS_MAP;
}

export function mapLegacyTokenPath(tokenName: string): string | undefined {
  return TOKEN_ALIAS_MAP[tokenName];
}

export function generateThemeTokens(
  seed: ThemeSeed,
  scheme: ResolvedThemeScheme,
  overrides?: Partial<ThemeGenerationOptions>,
): GeneratedThemeTokens {
  const options = { ...DEFAULT_OPTIONS, ...overrides };
  const cacheKey = createKey(seed, scheme, options);
  const cached = CACHE.get(cacheKey);
  if (cached) return cached;

  const isDark = scheme === "dark";
  const basePrimary = rgbToOklch(parseHexColor(seed.primary));
  const baseBackground = rgbToOklch(parseHexColor(seed.background));
  const baseNeutral = rgbToOklch(parseHexColor(seed.neutral));
  const baseSuccess = rgbToOklch(parseHexColor(seed.success));
  const baseWarning = rgbToOklch(parseHexColor(seed.warning));
  const baseDanger = rgbToOklch(parseHexColor(seed.danger));
  const baseAccent = rgbToOklch(parseHexColor(seed.accent ?? seed.primary));

  const surfaceApp = derive(
    baseBackground,
    { l: isDark ? 0.14 : 0.97, c: baseBackground.c * 0.18 },
    options,
  );
  const surfaceBase = derive(
    baseNeutral,
    { l: isDark ? 0.16 : 0.99, c: baseNeutral.c * 0.18 },
    options,
  );
  const surfaceAlt = derive(
    baseNeutral,
    { l: isDark ? 0.24 : 0.935, c: baseNeutral.c * 0.26 },
    options,
  );
  const surfaceElevated = derive(
    baseNeutral,
    { l: isDark ? 0.3 : 0.998, c: baseNeutral.c * 0.22 },
    options,
  );

  const textPrimary = tuneTextOnBackground(surfaceBase, !isDark, options.targetTextContrast);
  const textSecondary = softenTextOnBackground(
    textPrimary,
    surfaceBase,
    isDark ? 0.34 : 0.42,
    options.targetMutedTextContrast,
  );
  const textMicro = softenTextOnBackground(textSecondary, surfaceAlt, isDark ? 0.28 : 0.38, 3.0);
  const onPrimary = tuneTextOnBackground(
    derive(basePrimary, { l: isDark ? 0.68 : 0.58, c: basePrimary.c }, options),
    isDark,
    4.5,
  );

  const borderSubtle = derive(
    baseNeutral,
    { l: isDark ? 0.4 : 0.84, c: baseNeutral.c * 0.32 },
    options,
  );
  const borderStrong = derive(
    baseNeutral,
    { l: isDark ? 0.54 : 0.73, c: baseNeutral.c * 0.38 },
    options,
  );
  const focus = derive(basePrimary, { l: isDark ? 0.76 : 0.64, c: basePrimary.c * 0.9 }, options);

  const primary = derive(basePrimary, { l: isDark ? 0.68 : 0.58, c: basePrimary.c }, options);
  const primaryPressed = derive(
    basePrimary,
    { l: isDark ? 0.6 : 0.5, c: basePrimary.c * 1.03 },
    options,
  );
  const primarySubtle = derive(
    basePrimary,
    { l: isDark ? 0.38 : 0.92, c: basePrimary.c * 0.38 },
    options,
  );
  const accent = derive(baseAccent, { l: isDark ? 0.72 : 0.6, c: baseAccent.c }, options);

  const success = derive(baseSuccess, { l: isDark ? 0.72 : 0.55, c: baseSuccess.c }, options);
  const successSubtle = derive(
    baseSuccess,
    { l: isDark ? 0.27 : 0.9, c: baseSuccess.c * 0.35 },
    options,
  );
  const warning = derive(baseWarning, { l: isDark ? 0.74 : 0.66, c: baseWarning.c }, options);
  const warningSubtle = derive(
    baseWarning,
    { l: isDark ? 0.3 : 0.92, c: baseWarning.c * 0.36 },
    options,
  );
  const danger = derive(baseDanger, { l: isDark ? 0.68 : 0.58, c: baseDanger.c }, options);
  const dangerSubtle = derive(
    baseDanger,
    { l: isDark ? 0.28 : 0.91, c: baseDanger.c * 0.35 },
    options,
  );

  const stateDisabled = derive(
    baseNeutral,
    { l: isDark ? 0.34 : 0.85, c: baseNeutral.c * 0.15 },
    options,
  );
  const stateOverlay = derive(
    baseNeutral,
    { l: isDark ? 0.25 : 0.9, c: baseNeutral.c * 0.2 },
    options,
  );
  const stateRipple = derive(
    basePrimary,
    { l: isDark ? 0.3 : 0.86, c: basePrimary.c * 0.48 },
    options,
  );
  const stateSelected = derive(
    basePrimary,
    { l: isDark ? 0.34 : 0.9, c: basePrimary.c * 0.53 },
    options,
  );

  const tokens: GeneratedThemeTokens = {
    surface: {
      app: surfaceApp,
      base: surfaceBase,
      alt: surfaceAlt,
      elevated: surfaceElevated,
    },
    text: {
      primary: textPrimary,
      secondary: textSecondary,
      micro: textMicro,
      inverse: onPrimary,
    },
    border: {
      subtle: borderSubtle,
      strong: borderStrong,
      focus,
    },
    brand: {
      primary,
      pressed: primaryPressed,
      subtle: primarySubtle,
      onPrimary,
      accent,
    },
    semantic: {
      success: { base: success, subtle: successSubtle },
      warning: { base: warning, subtle: warningSubtle },
      danger: { base: danger, subtle: dangerSubtle },
    },
    state: {
      disabled: stateDisabled,
      overlay: stateOverlay,
      ripple: stateRipple,
      selected: stateSelected,
    },
    elevation: {
      low: derive(baseNeutral, { l: isDark ? 0.24 : 0.98, c: baseNeutral.c * 0.18 }, options),
      high: derive(baseNeutral, { l: isDark ? 0.3 : 1, c: baseNeutral.c * 0.15 }, options),
    },
    overlay: {
      tabBar: derive(baseNeutral, { l: isDark ? 0.18 : 0.985, c: baseNeutral.c * 0.18 }, options),
      tabBarBorder: derive(
        baseNeutral,
        { l: isDark ? 0.36 : 0.82, c: baseNeutral.c * 0.3 },
        options,
      ),
    },
  };

  CACHE.set(cacheKey, tokens);
  return tokens;
}
