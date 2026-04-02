// Positron is a clean, modern, warm-toned style with excellent road hierarchy
// Dark Matter is its dark counterpart — deep charcoal with warm highlights
// Both share the same OpenFreeMap vector tile source, so Israeli data coverage is identical
const DEFAULT_MAP_STYLE_LIGHT_URL = "https://tiles.openfreemap.org/styles/positron";
const DEFAULT_MAP_STYLE_DARK_URL = "https://tiles.openfreemap.org/styles/dark-matter";

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type QueueMapAppleTheme = {
  mapStyleLightUrl: string;
  mapStyleDarkUrl: string;
  minZoom: number;
  maxZoom: number;
  defaultCenter: [number, number];
  defaultZoomWithoutPin: number;
  defaultZoomWithPin: number;
  focusPadding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  offlinePack: {
    enabled: boolean;
    name: string;
    minZoom: number;
    maxZoom: number;
    progressThrottleMs: number;
  };
  overlay: {
    baseOutlineWidth: number;
    baseOutlineOpacity: number;
    selectionFillOpacity: number;
    selectionOutlineWidth: number;
    selectionOutlineOpacity: number;
    selectionTransitionDuration: number;
    touchFillOpacity: number;
    pinRadius: number;
    pinStrokeWidth: number;
  };
};

export const APPLE_MAP_THEME: QueueMapAppleTheme = {
  mapStyleLightUrl:
    process.env.EXPO_PUBLIC_MAP_VECTOR_STYLE_LIGHT_URL?.trim() ||
    process.env.EXPO_PUBLIC_BASEMAP_STYLE_URL?.trim() ||
    process.env.EXPO_PUBLIC_MAP_VECTOR_STYLE_URL?.trim() ||
    DEFAULT_MAP_STYLE_LIGHT_URL,
  mapStyleDarkUrl:
    process.env.EXPO_PUBLIC_MAP_VECTOR_STYLE_DARK_URL?.trim() ||
    process.env.EXPO_PUBLIC_BASEMAP_STYLE_URL?.trim() ||
    process.env.EXPO_PUBLIC_MAP_VECTOR_STYLE_URL?.trim() ||
    DEFAULT_MAP_STYLE_DARK_URL,
  minZoom: parseNumber(process.env.EXPO_PUBLIC_MAP_MIN_ZOOM, 7.5),
  maxZoom: parseNumber(process.env.EXPO_PUBLIC_MAP_MAX_ZOOM, 16),
  defaultCenter: [34.85, 31.5],
  defaultZoomWithoutPin: 8.8,
  defaultZoomWithPin: 11.5,
  focusPadding: {
    top: 36,
    right: 36,
    bottom: 36,
    left: 36,
  },
  offlinePack: {
    enabled: process.env.EXPO_PUBLIC_MAP_PREFETCH_ON_MOUNT === "1",
    name: process.env.EXPO_PUBLIC_MAP_OFFLINE_PACK_NAME?.trim() || "queue_israel_base",
    minZoom: parseNumber(process.env.EXPO_PUBLIC_MAP_OFFLINE_MIN_ZOOM, 8),
    maxZoom: parseNumber(
      process.env.EXPO_PUBLIC_MAP_OFFLINE_MAX_ZOOM ?? process.env.EXPO_PUBLIC_PM_TILES_MAX_ZOOM,
      11,
    ),
    progressThrottleMs: 1200,
  },
  overlay: {
    baseOutlineWidth: 1.0,
    baseOutlineOpacity: 0.28,
    selectionFillOpacity: 0.16,
    selectionOutlineWidth: 2.2,
    selectionOutlineOpacity: 0.95,
    selectionTransitionDuration: 240,
    touchFillOpacity: 0.05,
    pinRadius: 6,
    pinStrokeWidth: 2,
  },
};
