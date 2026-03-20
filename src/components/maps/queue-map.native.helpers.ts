import { OfflineManager } from "@maplibre/maplibre-react-native";

import { APPLE_MAP_THEME } from "@/components/maps/queue-map-apple-theme";
import type { getMapBrandPalette } from "@/constants/brand";
import { ISRAEL_MAP_INTERACTION_BOUNDS } from "@/constants/zones-map";
import type { QueueMapPin } from "./queue-map.types";

export type Expression = unknown;
export type AnyStyleLayer = Record<string, any>;
export type AnyStyleSpec = {
  version: number;
  sources: Record<string, unknown>;
  layers: AnyStyleLayer[];
  [key: string]: unknown;
};

const NO_MATCH_ZONE_FILTER: Expression = ["==", ["get", "id"], "__none__"];

let offlinePackBootstrapPromise: Promise<void> | null = null;
const mapStyleResponseCache = new Map<string, AnyStyleSpec | null>();
const mapStyleResponsePromiseCache = new Map<string, Promise<AnyStyleSpec | null>>();
const themedMapStyleCache = new Map<string, AnyStyleSpec>();

export function sanitizeZoom(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(22, value));
}

export function createZoneFilter(zoneIds: readonly string[], propertyName: string): Expression {
  if (zoneIds.length === 0) return NO_MATCH_ZONE_FILTER;
  return ["in", ["get", propertyName], ["literal", zoneIds as string[]]] as Expression;
}

export function toBounds(
  sw: [number, number],
  ne: [number, number],
): [number, number, number, number] {
  return [sw[0], sw[1], ne[0], ne[1]];
}

function isRoadNumberLayer(layer: AnyStyleLayer) {
  const id = String(layer?.id ?? "").toLowerCase();
  const sourceLayer = String(layer?.["source-layer"] ?? "").toLowerCase();
  if (id.includes("shield")) return true;
  if (id.includes("road-number")) return true;
  if (id.includes("highway-number")) return true;
  if (id.includes("route-number")) return true;
  if (sourceLayer.includes("shield")) return true;
  const textField = JSON.stringify(layer?.layout?.["text-field"] ?? "").toLowerCase();
  if (textField.includes("ref")) return true;
  return false;
}

export function withMapPersonality(
  style: AnyStyleSpec,
  palette: ReturnType<typeof getMapBrandPalette>,
  showBaseLabels: boolean,
) {
  const layers = (style.layers ?? [])
    .filter((layer) => !isRoadNumberLayer(layer))
    .filter((layer) => (showBaseLabels ? true : String(layer?.type ?? "") !== "symbol"))
    .map((layer) => {
      const nextLayer = { ...layer };
      const id = String(nextLayer.id ?? "").toLowerCase();
      const sourceLayer = String(nextLayer["source-layer"] ?? "").toLowerCase();
      const paint = { ...(nextLayer.paint ?? {}) };
      const layerType = String(nextLayer.type ?? "");

      if (layerType === "background") {
        paint["background-color"] = palette.styleBackground;
      }
      if ((sourceLayer.includes("water") || id.includes("water")) && layerType === "fill") {
        paint["fill-color"] = palette.waterFill;
      }
      if ((sourceLayer.includes("water") || id.includes("water")) && layerType === "line") {
        paint["line-color"] = palette.waterLine;
      }
      if (
        (sourceLayer.includes("park") ||
          sourceLayer.includes("landuse") ||
          sourceLayer.includes("landcover") ||
          sourceLayer.includes("forest") ||
          sourceLayer.includes("wood") ||
          sourceLayer.includes("grass") ||
          sourceLayer.includes("green") ||
          id.includes("forest") ||
          id.includes("green") ||
          id.includes("park")) &&
        layerType === "fill"
      ) {
        paint["fill-color"] = palette.landcover;
      }
      if (sourceLayer.includes("road") && layerType === "line") {
        paint["line-color"] = palette.roadLine;
      }
      if ((sourceLayer.includes("building") || id.includes("building")) && layerType === "fill") {
        paint["fill-color"] = palette.buildingFill;
      }
      if (layerType === "symbol") {
        paint["text-color"] = palette.text;
        paint["text-halo-color"] = palette.textHalo;
        paint["text-halo-width"] = 1;
      }

      nextLayer.paint = paint;
      return nextLayer;
    });

  return { ...style, layers };
}

export async function fetchMapStyleSpec(styleUrl: string): Promise<AnyStyleSpec | null> {
  if (mapStyleResponseCache.has(styleUrl)) {
    return mapStyleResponseCache.get(styleUrl) ?? null;
  }

  const existingPromise = mapStyleResponsePromiseCache.get(styleUrl);
  if (existingPromise) {
    return existingPromise;
  }

  const request = (async () => {
    try {
      const response = await fetch(styleUrl);
      if (!response.ok) {
        mapStyleResponseCache.set(styleUrl, null);
        return null;
      }

      const baseStyle = (await response.json()) as AnyStyleSpec;
      mapStyleResponseCache.set(styleUrl, baseStyle);
      return baseStyle;
    } catch {
      mapStyleResponseCache.set(styleUrl, null);
      return null;
    } finally {
      mapStyleResponsePromiseCache.delete(styleUrl);
    }
  })();

  mapStyleResponsePromiseCache.set(styleUrl, request);
  return request;
}

export function getCachedMapStyleSpec(styleUrl: string) {
  return mapStyleResponseCache.get(styleUrl);
}

export async function ensureVectorOfflinePack() {
  if (!APPLE_MAP_THEME.offlinePack.enabled) return;
  if (offlinePackBootstrapPromise) {
    await offlinePackBootstrapPromise;
    return;
  }

  const minZoom = sanitizeZoom(APPLE_MAP_THEME.offlinePack.minZoom, 8);
  const maxZoom = sanitizeZoom(APPLE_MAP_THEME.offlinePack.maxZoom, 11);
  const zoomStart = Math.min(minZoom, maxZoom);
  const zoomEnd = Math.max(minZoom, maxZoom);

  offlinePackBootstrapPromise = (async () => {
    try {
      const existingPacks = await OfflineManager.getPacks();
      const existingPack = existingPacks.find(
        (pack) =>
          typeof pack.metadata?.name === "string" &&
          pack.metadata.name === APPLE_MAP_THEME.offlinePack.name,
      );
      if (existingPack) return;

      OfflineManager.setProgressEventThrottle(APPLE_MAP_THEME.offlinePack.progressThrottleMs);
      await OfflineManager.createPack(
        {
          mapStyle: APPLE_MAP_THEME.mapStyleLightUrl,
          bounds: toBounds(ISRAEL_MAP_INTERACTION_BOUNDS.sw, ISRAEL_MAP_INTERACTION_BOUNDS.ne),
          minZoom: zoomStart,
          maxZoom: zoomEnd,
          metadata: {
            name: APPLE_MAP_THEME.offlinePack.name,
            createdAt: Date.now(),
            source: "queue_map_bootstrap",
          },
        },
        () => {},
        () => {},
      );
    } finally {
      offlinePackBootstrapPromise = null;
    }
  })();

  await offlinePackBootstrapPromise;
}

export function createPinShape(pin: QueueMapPin | null): GeoJSON.FeatureCollection {
  if (!pin) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [pin.longitude, pin.latitude],
        },
      },
    ],
  };
}

export function resolveThemedMapStyle(
  cacheKey: string,
  baseMapStyle: AnyStyleSpec | null,
  palette: ReturnType<typeof getMapBrandPalette>,
  showBaseLabels: boolean,
) {
  if (!baseMapStyle) return null;
  const cachedStyle = themedMapStyleCache.get(cacheKey);
  if (cachedStyle) {
    return cachedStyle;
  }
  const nextStyle = withMapPersonality(baseMapStyle, palette, showBaseLabels);
  themedMapStyleCache.set(cacheKey, nextStyle);
  return nextStyle;
}
