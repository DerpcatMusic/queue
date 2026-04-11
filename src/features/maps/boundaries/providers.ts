import { PIKUD_AREA_GEOJSON } from "@/constants/zones-map";
import { ISRAEL_MAP_INTERACTION_BOUNDS } from "@/constants/zones-map";

import {
  loadLondonBoroughFeatureCollection,
  LONDON_BOROUGH_PROVIDER_ID,
  LONDON_OVERTURE_BOROUGH_GEOJSON,
} from "./london-boroughs";
import {
  EUROPE_COUNTRY_CONFIGS,
  getProviderForCoordinates,
  getProviderForCountry,
} from "./europe-countries";
import type { BoundaryGeometrySource, BoundaryProviderDefinition, BoundaryZoomTier } from "./types";

const configuredLondonBoundaryTilesUrl = (
  process.env.EXPO_PUBLIC_LONDON_BOUNDARY_TILES_URL_TEMPLATE ?? ""
).trim();
const configuredLondonBoundarySourceLayer = (
  process.env.EXPO_PUBLIC_LONDON_BOUNDARY_SOURCE_LAYER ?? "boundaries"
).trim();

const configuredEnglandBoundaryTilesUrl = (
  process.env.EXPO_PUBLIC_ENGLAND_BOUNDARY_TILES_URL_TEMPLATE ?? ""
).trim();
const configuredEnglandBoundarySourceLayer = (
  process.env.EXPO_PUBLIC_ENGLAND_BOUNDARY_SOURCE_LAYER ?? "boundaries"
).trim();

// Optional zoom tiers for England vector tiles (env-driven)
function parseEnglandZoomTiers(): BoundaryZoomTier[] | undefined {
  const raw = (process.env.EXPO_PUBLIC_ENGLAND_ZOOM_TIERS ?? "").trim();
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter(
      (t): t is BoundaryZoomTier =>
        typeof t === "object" &&
        t !== null &&
        typeof (t as Record<string, unknown>).tierId === "string" &&
        typeof (t as Record<string, unknown>).minZoom === "number" &&
        typeof (t as Record<string, unknown>).maxZoom === "number",
    );
  } catch {
    return undefined;
  }
}

export const ISRAEL_PIKUD_BOUNDARY_PROVIDER: BoundaryProviderDefinition = {
  id: "israel-pikud",
  label: "Israel Pikud HaOref",
  countryCode: "IL",
  geometry: {
    kind: "geojson",
    featureCollection: PIKUD_AREA_GEOJSON,
    idProperty: "id",
  },
  capabilities: {
    supportsPolygonSelection: true,
    supportsPostcodeSelection: false,
    supportsSearch: true,
    supportsGpsResolution: true,
    supportsVectorTiles: false,
    supportsOffline: true,
  },
  selectionMode: "polygon",
  selectionStorage: "legacyZones",
  interactionBounds: ISRAEL_MAP_INTERACTION_BOUNDS,
  labelPropertyCandidates: ["engName", "hebName", "id"],
};

export const LONDON_BOROUGH_BOUNDARY_PROVIDER: BoundaryProviderDefinition = {
  id: LONDON_BOROUGH_PROVIDER_ID,
  label: "London boroughs",
  countryCode: "GB",
  geometry: configuredLondonBoundaryTilesUrl
    ? {
        kind: "vectorTiles",
        sourceId: "london-boroughs-vector",
        sourceLayer: configuredLondonBoundarySourceLayer,
        tileUrlTemplates: [configuredLondonBoundaryTilesUrl],
        promoteId: "id",
      }
    : process.env.EXPO_PUBLIC_USE_REMOTE_LONDON_BOUNDARIES === "1"
      ? {
          kind: "remoteGeojson",
          sourceId: "london-boroughs-remote",
          idProperty: "id",
          loadFeatureCollection: loadLondonBoroughFeatureCollection,
        }
      : {
          kind: "geojson",
          featureCollection: LONDON_OVERTURE_BOROUGH_GEOJSON,
          idProperty: "id",
        },
  capabilities: {
    supportsPolygonSelection: true,
    supportsPostcodeSelection: false,
    supportsSearch: true,
    supportsGpsResolution: true,
    supportsVectorTiles: false,
    supportsOffline: true,
  },
  selectionMode: "polygon",
  selectionStorage: "boundaries",
  viewport: {
    countryCode: "GB",
    bbox: {
      sw: [-0.5103, 51.2868],
      ne: [0.334, 51.6923],
    },
    zoom: 8.7,
  },
  labelPropertyCandidates: ["name", "postcode", "id"],
};

// England-specific boundary provider (GB sub-national, detected before broader UK fallback)
const ENGLAND_ZOOM_TIERS = parseEnglandZoomTiers();

function buildEnglandGeometry(): BoundaryGeometrySource {
  if (configuredEnglandBoundaryTilesUrl) {
    const geo: BoundaryGeometrySource = {
      kind: "vectorTiles",
      sourceId: "england-boundaries-vector",
      sourceLayer: configuredEnglandBoundarySourceLayer,
      tileUrlTemplates: [configuredEnglandBoundaryTilesUrl],
      promoteId: "id",
    };
    if (ENGLAND_ZOOM_TIERS) {
      (geo as typeof geo & { zoomTiers: typeof ENGLAND_ZOOM_TIERS }).zoomTiers = ENGLAND_ZOOM_TIERS;
    }
    return geo;
  }
  const geo: BoundaryGeometrySource = {
    kind: "geojson",
    // Placeholder: real data requires download from Overture/OSM
    featureCollection: { type: "FeatureCollection" as const, features: [] },
    idProperty: "id",
  };
  if (ENGLAND_ZOOM_TIERS) {
    (geo as typeof geo & { zoomTiers: typeof ENGLAND_ZOOM_TIERS }).zoomTiers = ENGLAND_ZOOM_TIERS;
  }
  return geo;
}

export const ENGLAND_BOUNDARY_PROVIDER: BoundaryProviderDefinition = {
  id: "gb-england-boroughs",
  label: "England localities",
  countryCode: "GB",
  geometry: buildEnglandGeometry(),
  capabilities: {
    supportsPolygonSelection: true,
    supportsPostcodeSelection: false,
    supportsSearch: true,
    supportsGpsResolution: true,
    supportsVectorTiles: true,
    supportsOffline: false,
  },
  selectionMode: "polygon",
  selectionStorage: "boundaries",
  viewport: {
    countryCode: "GB",
    // Tighter England bbox (excludes Scotland, Wales, Northern Ireland, Isle of Man, Channel Islands)
    bbox: {
      sw: [-5.75, 49.86],
      ne: [1.87, 55.81],
    },
    zoom: 6,
  },
  interactionBounds: {
    sw: [-5.75, 49.86],
    ne: [1.87, 55.81],
  },
  labelPropertyCandidates: ["name", "id"],
};

const EUROPE_BOUNDARY_PROVIDERS: BoundaryProviderDefinition[] = [];
for (const config of EUROPE_COUNTRY_CONFIGS.values()) {
  const provider = getProviderForCountry(config.countryCode);
  if (provider) {
    EUROPE_BOUNDARY_PROVIDERS.push(provider);
  }
}

export const BOUNDARY_PROVIDERS = [
  ISRAEL_PIKUD_BOUNDARY_PROVIDER,
  LONDON_BOROUGH_BOUNDARY_PROVIDER,
  ENGLAND_BOUNDARY_PROVIDER,
  ...EUROPE_BOUNDARY_PROVIDERS,
] as const;

export const BOUNDARY_PROVIDER_BY_ID = new Map(
  BOUNDARY_PROVIDERS.map((provider) => [provider.id, provider] as const),
);

const configuredBoundaryProviderId = (
  process.env.EXPO_PUBLIC_BOUNDARY_PROVIDER_ID ?? LONDON_BOROUGH_BOUNDARY_PROVIDER.id
)
  .trim()
  .toLowerCase();

export const ACTIVE_BOUNDARY_PROVIDER =
  BOUNDARY_PROVIDER_BY_ID.get(configuredBoundaryProviderId) ?? LONDON_BOROUGH_BOUNDARY_PROVIDER;

export const DEFAULT_BOUNDARY_PROVIDER = ACTIVE_BOUNDARY_PROVIDER;

export function getBoundaryProviderForLocation(
  lng: number,
  lat: number,
): BoundaryProviderDefinition {
  // Check if coordinates match Israel bounds
  const { sw, ne } = ISRAEL_MAP_INTERACTION_BOUNDS;
  if (lng >= sw[0] && lng <= ne[0] && lat >= sw[1] && lat <= ne[1]) {
    return ISRAEL_PIKUD_BOUNDARY_PROVIDER;
  }

  // Check England bounds (tighter than full UK)
  const engSw = ENGLAND_BOUNDARY_PROVIDER.interactionBounds!.sw;
  const engNe = ENGLAND_BOUNDARY_PROVIDER.interactionBounds!.ne;
  if (lng >= engSw[0] && lng <= engNe[0] && lat >= engSw[1] && lat <= engNe[1]) {
    return ENGLAND_BOUNDARY_PROVIDER;
  }

  // Try European country providers (includes generic GB provider with full UK bbox)
  const europeProvider = getProviderForCoordinates(lng, lat);
  if (europeProvider) {
    return europeProvider;
  }

  // Fall back to London
  return LONDON_BOROUGH_BOUNDARY_PROVIDER;
}
