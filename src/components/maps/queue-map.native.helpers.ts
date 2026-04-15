import { OfflineManager } from "./native-map-sdk";

import { APPLE_MAP_THEME } from "@/components/maps/queue-map-apple-theme";
import type { getMapBrandPalette } from "@/constants/brand";
import { ISRAEL_MAP_INTERACTION_BOUNDS } from "@/constants/zones-map";
import type {
  MapCoveragePolygon,
  QueueMapBounds,
  QueueMapPin,
  StudioMapMarker,
} from "./queue-map.types";

export type Expression = unknown;
export type AnyStyleLayer = Record<string, any>;
export type AnyStyleSpec = {
  version: number;
  sources: Record<string, unknown>;
  layers: AnyStyleLayer[];
  [key: string]: unknown;
};

let offlinePackBootstrapPromise: Promise<void> | null = null;
const MAP_STYLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const mapStyleResponseCache = new Map<string, { data: AnyStyleSpec | null; timestamp: number }>();
const mapStyleResponsePromiseCache = new Map<string, Promise<AnyStyleSpec | null>>();
const themedMapStyleCache = new Map<string, { data: AnyStyleSpec; timestamp: number }>();
const MAPLIBRE_GLYPHS_URL = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

export function sanitizeZoom(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(22, value));
}

export function createCoverageFeatureCollection(
  polygons: readonly MapCoveragePolygon[],
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: polygons.map((polygon) => {
      const coordinates = polygon.boundary.map(({ longitude, latitude }) => [longitude, latitude]);
      const closedRing =
        coordinates.length > 0 &&
        (coordinates[0]?.[0] !== coordinates[coordinates.length - 1]?.[0] ||
          coordinates[0]?.[1] !== coordinates[coordinates.length - 1]?.[1])
          ? [...coordinates, coordinates[0]!]
          : coordinates;
      return {
        type: "Feature",
        properties: { cell: polygon.cell, resolution: polygon.resolution },
        geometry: {
          type: "Polygon",
          coordinates: [closedRing as [number, number][]],
        },
      };
    }),
  };
}

export function getFeatureCollectionBounds(
  featureCollection: GeoJSON.FeatureCollection<GeoJSON.Polygon>,
): { sw: [number, number]; ne: [number, number] } | null {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const feature of featureCollection.features) {
    for (const ring of feature.geometry.coordinates) {
      for (const coordinate of ring) {
        const [lng, lat] = coordinate;
        if (lng == null || lat == null) {
          continue;
        }
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }

  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(maxLat)
  ) {
    return null;
  }

  return {
    sw: [minLng, minLat],
    ne: [maxLng, maxLat],
  };
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
): [GeoJSON.Position, GeoJSON.Position] {
  return [
    [ne[0], ne[1]],
    [sw[0], sw[1]],
  ];
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
            ? palette.roadPrimary
            : palette.roadSecondary;
        paint["line-color"] = roadColor;
        paint["line-width"] = mainRoad
          ? ["interpolate", ["linear"], ["zoom"], 5, 0.3, 9, 0.7, 12, 1.4, 15, 2.4]
          : secondaryRoad
            ? ["interpolate", ["linear"], ["zoom"], 5, 0.2, 9, 0.5, 12, 1.0, 15, 1.8]
            : localRoad
              ? ["interpolate", ["linear"], ["zoom"], 5, 0.15, 9, 0.35, 12, 0.65, 15, 1.2]
              : ["interpolate", ["linear"], ["zoom"], 5, 0.18, 9, 0.4, 12, 0.75, 15, 1.3];
        paint["line-opacity"] = 0.75;
        layout["line-cap"] = "round";
        layout["line-join"] = "round";
      }
      if (isRoadLayer(id, sourceLayer) && layerType === "fill") {
        paint["fill-color"] = isMainRoadLayer(id, sourceLayer)
          ? palette.roadPrimary
          : isSecondaryRoadLayer(id, sourceLayer)
            ? palette.roadPrimary
            : palette.roadSecondary;
        paint["fill-opacity"] = 0.75;
      }
      // Buildings — dominant urban feature
      if ((sourceLayer.includes("building") || id.includes("building")) && layerType === "fill") {
        paint["fill-color"] = palette.buildingFill;
        paint["fill-opacity"] = palette.buildingOpacity ?? 0.85;
      }
      if (layerType === "symbol") {
        layout["text-font"] = ["Noto Sans Regular"];
        paint["text-color"] = palette.text;
        paint["text-halo-color"] = palette.textHalo;
        paint["text-halo-width"] = 1.0;
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
  if (styleUrl.startsWith("mapbox://")) {
    return null;
  }

  const cachedEntry = mapStyleResponseCache.get(styleUrl);
  if (cachedEntry && Date.now() - cachedEntry.timestamp <= MAP_STYLE_CACHE_TTL_MS) {
    return cachedEntry.data;
  }

  const existingPromise = mapStyleResponsePromiseCache.get(styleUrl);
  if (existingPromise) {
    return existingPromise;
  }

  const request = (async () => {
    try {
      const response = await fetch(styleUrl);
      if (!response.ok) {
        mapStyleResponseCache.set(styleUrl, { data: null, timestamp: Date.now() });
        return null;
      }

      const baseStyle = (await response.json()) as AnyStyleSpec;
      mapStyleResponseCache.set(styleUrl, { data: baseStyle, timestamp: Date.now() });
      return baseStyle;
    } catch {
      mapStyleResponseCache.set(styleUrl, { data: null, timestamp: Date.now() });
      return null;
    } finally {
      mapStyleResponsePromiseCache.delete(styleUrl);
    }
  })();

  mapStyleResponsePromiseCache.set(styleUrl, request);
  return request;
}

export function getCachedMapStyleSpec(styleUrl: string) {
  const cachedEntry = mapStyleResponseCache.get(styleUrl);
  if (cachedEntry && Date.now() - cachedEntry.timestamp <= MAP_STYLE_CACHE_TTL_MS) {
    return cachedEntry.data;
  }
  return undefined;
}

export function warmMapStyleSpec(styleUrl: string) {
  if (styleUrl.startsWith("mapbox://")) {
    return;
  }

  const cachedEntry = mapStyleResponseCache.get(styleUrl);
  if (
    (cachedEntry && Date.now() - cachedEntry.timestamp <= MAP_STYLE_CACHE_TTL_MS) ||
    mapStyleResponsePromiseCache.has(styleUrl)
  ) {
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
          name: APPLE_MAP_THEME.offlinePack.name,
          styleURL: APPLE_MAP_THEME.mapStyleLightUrl,
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
  selectedStudioId: string | null | undefined,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: studios.map((studio) => ({
      type: "Feature" as const,
      properties: {
        studioId: studio.studioId,
        studioName: studio.studioName,
        zone: studio.zone,
        label: studio.studioName.slice(0, 1).toUpperCase(),
        iconKey: `${STUDIO_MARKER_IMAGE_PREFIX}${studio.studioId}`,
        hasLogo: Boolean(studio.logoImageUrl),
        selected: selectedStudioId === studio.studioId,
        accentColor: studio.mapMarkerColor ?? null,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [studio.longitude, studio.latitude],
      },
    })),
  };
}

function normalizeLng(lng: number) {
  if (!Number.isFinite(lng)) return lng;
  while (lng < -180) lng += 360;
  while (lng > 180) lng -= 360;
  return lng;
}

function isStudioInsideBounds(studio: StudioMapMarker, bounds: QueueMapBounds) {
  const west = normalizeLng(bounds.sw[0]);
  const east = normalizeLng(bounds.ne[0]);
  const south = Math.min(bounds.sw[1], bounds.ne[1]);
  const north = Math.max(bounds.sw[1], bounds.ne[1]);
  const latitude = studio.latitude;
  const longitude = normalizeLng(studio.longitude);

  if (latitude < south || latitude > north) {
    return false;
  }

  if (west <= east) {
    return longitude >= west && longitude <= east;
  }

  return longitude >= west || longitude <= east;
}

function getBoundsCenter(bounds: QueueMapBounds): [number, number] {
  const west = normalizeLng(bounds.sw[0]);
  const east = normalizeLng(bounds.ne[0]);
  const south = Math.min(bounds.sw[1], bounds.ne[1]);
  const north = Math.max(bounds.sw[1], bounds.ne[1]);

  const centerLatitude = (south + north) / 2;
  const centerLongitude = west <= east ? (west + east) / 2 : normalizeLng((west + east + 360) / 2);

  return [centerLongitude, centerLatitude];
}

function getStudioCenterDistanceScore(studio: StudioMapMarker, center: [number, number] | null) {
  if (!center) return 0;
  const lngDistance = studio.longitude - center[0];
  const latDistance = studio.latitude - center[1];
  return lngDistance * lngDistance + latDistance * latDistance;
}

export function getStudioMarkerRenderLimit(zoomLevel: number) {
  if (zoomLevel < 10) return 0;
  if (zoomLevel < 11) return 8;
  if (zoomLevel < 12) return 12;
  if (zoomLevel < 13) return 20;
  if (zoomLevel < 14) return 32;
  if (zoomLevel < 15) return 48;
  if (zoomLevel < 16) return 72;
  return 120;
}

export function selectRenderableStudioMarkers(
  studios: readonly StudioMapMarker[],
  options: {
    bounds?: QueueMapBounds | null;
    zoomLevel?: number | null;
    selectedStudioId?: string | null;
  },
) {
  const zoomLevel = options.zoomLevel ?? null;
  const renderLimit = zoomLevel === null ? studios.length : getStudioMarkerRenderLimit(zoomLevel);
  if (renderLimit <= 0) {
    return [];
  }

  const boundedStudios = options.bounds
    ? studios.filter((studio) => isStudioInsideBounds(studio, options.bounds as QueueMapBounds))
    : [...studios];
  const center = options.bounds ? getBoundsCenter(options.bounds as QueueMapBounds) : null;
  const selectedStudioId = options.selectedStudioId ?? null;

  const sortedStudios = [...boundedStudios].sort((left, right) => {
    const leftSelected = selectedStudioId !== null && left.studioId === selectedStudioId;
    const rightSelected = selectedStudioId !== null && right.studioId === selectedStudioId;
    if (leftSelected !== rightSelected) {
      return leftSelected ? -1 : 1;
    }

    return getStudioCenterDistanceScore(left, center) - getStudioCenterDistanceScore(right, center);
  });

  return sortedStudios.slice(0, renderLimit);
}

export function resolveThemedMapStyle(
  cacheKey: string,
  baseMapStyle: AnyStyleSpec | null,
  palette: ReturnType<typeof getMapBrandPalette>,
  showBaseLabels: boolean,
) {
  if (!baseMapStyle) return null;
  const cachedEntry = themedMapStyleCache.get(cacheKey);
  if (cachedEntry && Date.now() - cachedEntry.timestamp <= MAP_STYLE_CACHE_TTL_MS) {
    return cachedEntry.data;
  }
  const nextStyle = withMapPersonality(baseMapStyle, palette, showBaseLabels);
  themedMapStyleCache.set(cacheKey, { data: nextStyle, timestamp: Date.now() });
  return nextStyle;
}
