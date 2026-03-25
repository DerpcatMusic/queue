import { Radius, Spacing, Typography } from "@/lib/design-system";

export type ResolvedBrandScheme = "light" | "dark";

// ─── Spacing ─────────────────────────────────────────────────────────────────
// These are JS constants for React Native inline styles.
// Prefer Tailwind classes (p-lg, gap-sm, etc.) where possible.

export const BrandSpacing = Spacing;

// ─── Border Radius ───────────────────────────────────────────────────────────

export const BrandRadius = Radius;

export const BrandType = Typography;

// ─── Map Palette (native map component — not brand colors) ───────────────────

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
    selectedOutlineOpacity: 1.0,
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
    selectedOutlineOpacity: 1.0,
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
