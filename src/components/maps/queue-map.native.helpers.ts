import { OfflineManager } from "@maplibre/maplibre-react-native";

import { APPLE_MAP_THEME } from "@/components/maps/queue-map-apple-theme";
import type { getMapBrandPalette } from "@/constants/brand";
import { ISRAEL_MAP_INTERACTION_BOUNDS } from "@/constants/zones-map";
import type { QueueMapPin, StudioMapMarker } from "./queue-map.types";

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
const MAPLIBRE_GLYPHS_URL = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

export function sanitizeZoom(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(22, value));
}

export function createZoneFilter(zoneIds: readonly string[], propertyName: string): Expression {
  if (zoneIds.length === 0) return NO_MATCH_ZONE_FILTER;
  return ["in", ["get", propertyName], ["literal", zoneIds as string[]]] as Expression;
}

export function toCameraBounds(
  sw: [number, number],
  ne: [number, number],
): { sw: [number, number]; ne: [number, number] } {
  return { sw, ne };
}

export function toBounds(
  sw: [number, number],
  ne: [number, number],
): [number, number, number, number] {
  return [sw[0], sw[1], ne[0], ne[1]];
}

export function toOfflineBounds(
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

function isLowValueSymbolLayer(layer: AnyStyleLayer) {
  const id = String(layer?.id ?? "").toLowerCase();
  const sourceLayer = String(layer?.["source-layer"] ?? "").toLowerCase();
  if (String(layer?.type ?? "") !== "symbol") {
    return false;
  }

  const value = `${id} ${sourceLayer}`;
  return (
    value.includes("poi") ||
    value.includes("transit") ||
    value.includes("rail") ||
    value.includes("bus") ||
    value.includes("parking") ||
    value.includes("ferry") ||
    value.includes("airport") ||
    value.includes("aerialway")
  );
}

function is3DBuildingLayer(layer: AnyStyleLayer) {
  const id = String(layer?.id ?? "").toLowerCase();
  const sourceLayer = String(layer?.["source-layer"] ?? "").toLowerCase();
  const type = String(layer?.type ?? "").toLowerCase();
  return (
    type === "fill-extrusion" ||
    id.includes("extrusion") ||
    id.includes("3d-building") ||
    sourceLayer.includes("building-3d")
  );
}

function isRoadLayer(id: string, sourceLayer: string) {
  const value = `${id} ${sourceLayer}`;
  return (
    value.includes("road") ||
    value.includes("street") ||
    value.includes("highway") ||
    value.includes("motorway") ||
    value.includes("trunk") ||
    value.includes("primary") ||
    value.includes("secondary") ||
    value.includes("tertiary") ||
    value.includes("bridge") ||
    value.includes("tunnel")
  );
}

function isMainRoadLayer(id: string, sourceLayer: string) {
  const value = `${id} ${sourceLayer}`;
  return (
    value.includes("motorway") ||
    value.includes("trunk") ||
    value.includes("primary") ||
    value.includes("highway") ||
    value.includes("major")
  );
}

function isSecondaryRoadLayer(id: string, sourceLayer: string) {
  const value = `${id} ${sourceLayer}`;
  return (
    value.includes("secondary") ||
    value.includes("tertiary") ||
    value.includes("residential") ||
    value.includes("service") ||
    value.includes("street") ||
    value.includes("unclassified")
  );
}

function isLocalRoadLayer(id: string, sourceLayer: string) {
  const value = `${id} ${sourceLayer}`;
  return (
    value.includes("path") ||
    value.includes("track") ||
    value.includes("service") ||
    value.includes("living") ||
    value.includes("lane") ||
    value.includes("alley") ||
    value.includes("minor")
  );
}

export function withMapPersonality(
  style: AnyStyleSpec,
  palette: ReturnType<typeof getMapBrandPalette>,
  showBaseLabels: boolean,
) {
  const layers = (style.layers ?? [])
    .filter((layer) => !isRoadNumberLayer(layer))
    .filter((layer) => !is3DBuildingLayer(layer))
    .filter((layer) => (showBaseLabels ? true : String(layer?.type ?? "") !== "symbol"))
    .filter((layer) => !isLowValueSymbolLayer(layer))
    .map((layer) => {
      const nextLayer = { ...layer };
      const id = String(nextLayer.id ?? "").toLowerCase();
      const sourceLayer = String(nextLayer["source-layer"] ?? "").toLowerCase();
      const paint = { ...(nextLayer.paint ?? {}) };
      const layout = { ...(nextLayer.layout ?? {}) };
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
      if (isRoadLayer(id, sourceLayer) && layerType === "line") {
        const mainRoad = isMainRoadLayer(id, sourceLayer);
        const secondaryRoad = isSecondaryRoadLayer(id, sourceLayer);
        const localRoad = isLocalRoadLayer(id, sourceLayer);
        const roadColor = mainRoad
          ? palette.roadPrimary
          : secondaryRoad
            ? palette.roadSecondary
            : palette.roadTertiary;
        paint["line-color"] = roadColor;
        paint["line-width"] = mainRoad
          ? ["interpolate", ["linear"], ["zoom"], 6, 0.4, 10, 0.82, 14, 1.7]
          : secondaryRoad
            ? ["interpolate", ["linear"], ["zoom"], 6, 0.28, 10, 0.58, 14, 1.12]
            : localRoad
              ? ["interpolate", ["linear"], ["zoom"], 6, 0.18, 10, 0.38, 14, 0.78]
              : ["interpolate", ["linear"], ["zoom"], 6, 0.2, 10, 0.42, 14, 0.84];
        paint["line-opacity"] = 1;
        layout["line-cap"] = "round";
        layout["line-join"] = "round";
      }
      if (isRoadLayer(id, sourceLayer) && layerType === "fill") {
        paint["fill-color"] = isMainRoadLayer(id, sourceLayer)
          ? palette.roadPrimary
          : isSecondaryRoadLayer(id, sourceLayer)
            ? palette.roadSecondary
            : palette.roadTertiary;
        paint["fill-opacity"] = 1;
      }
      if ((sourceLayer.includes("building") || id.includes("building")) && layerType === "fill") {
        paint["fill-color"] = palette.buildingFill;
        paint["fill-opacity"] = 1;
      }
      if (layerType === "symbol") {
        layout["text-font"] = ["Noto Sans Regular"];
        paint["text-color"] = palette.text;
        paint["text-halo-color"] = palette.textHalo;
        paint["text-halo-width"] = 0.55;
        paint["text-opacity"] = 1;
      }

      nextLayer.paint = paint;
      nextLayer.layout = layout;
      return nextLayer;
    });

  return { ...style, glyphs: MAPLIBRE_GLYPHS_URL, layers };
}

export function createFallbackMapStyle(
  palette: ReturnType<typeof getMapBrandPalette>,
): AnyStyleSpec {
  return {
    version: 8,
    glyphs: MAPLIBRE_GLYPHS_URL,
    sources: {},
    layers: [
      {
        id: "queue-map-background",
        type: "background",
        paint: {
          "background-color": palette.styleBackground,
        },
      },
    ],
  };
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

export function warmMapStyleSpec(styleUrl: string) {
  if (mapStyleResponseCache.has(styleUrl) || mapStyleResponsePromiseCache.has(styleUrl)) {
    return;
  }
  void fetchMapStyleSpec(styleUrl);
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
          bounds: toOfflineBounds(
            ISRAEL_MAP_INTERACTION_BOUNDS.sw,
            ISRAEL_MAP_INTERACTION_BOUNDS.ne,
          ),
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

const STUDIO_MARKER_IMAGE_PREFIX = "studio-marker:";

export function getStudioMarkerImageEntries(studios: readonly StudioMapMarker[]) {
  return Object.fromEntries(
    studios
      .filter((studio) => typeof studio.logoImageUrl === "string" && studio.logoImageUrl.length > 0)
      .map((studio) => [
        `${STUDIO_MARKER_IMAGE_PREFIX}${studio.studioId}`,
        studio.logoImageUrl as string,
      ]),
  );
}

export function createStudioMarkersGeoJson(
  studios: readonly StudioMapMarker[],
  variant: "logo" | "fallback",
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: studios
      .filter((studio) =>
        variant === "logo" ? Boolean(studio.logoImageUrl) : !studio.logoImageUrl,
      )
      .map((studio) => ({
        type: "Feature" as const,
        properties: {
          studioId: studio.studioId,
          studioName: studio.studioName,
          zone: studio.zone,
          label: studio.studioName.slice(0, 1).toUpperCase(),
          ...(variant === "logo"
            ? { iconKey: `${STUDIO_MARKER_IMAGE_PREFIX}${studio.studioId}` }
            : {}),
        },
        geometry: {
          type: "Point" as const,
          coordinates: [studio.longitude, studio.latitude],
        },
      })),
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
