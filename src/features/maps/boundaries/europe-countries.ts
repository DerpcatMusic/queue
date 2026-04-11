import type { BoundaryProviderDefinition } from "./types";
import type { BoundaryGeometrySource } from "./types";

function isBoundaryZoomTier(value: unknown): value is import("./types").BoundaryZoomTier {
  if (!value || typeof value !== "object") return false;
  const tier = value as Record<string, unknown>;
  return (
    typeof tier.tierId === "string" &&
    Number.isFinite(tier.minZoom as number) &&
    Number.isFinite(tier.maxZoom as number) &&
    (tier.sourceLayer === undefined || typeof tier.sourceLayer === "string")
  );
}

function parseZoomTiers(raw: string): import("./types").BoundaryZoomTier[] | undefined {
  if (!raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const tiers = parsed
      .filter(isBoundaryZoomTier)
      .sort((left, right) => left.minZoom - right.minZoom);
    return tiers.length > 0 ? tiers : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Optional env-driven vector-tile overrides for Europe country providers.
 * When the corresponding env vars are set the provider geometry switches
 * from the stub geojson to vectorTiles kind.
 *
 * Env vars (all optional):
 *   EXPO_PUBLIC_EU_{CC}_VECTOR_TILES_URL_TEMPLATE – tile URL template string,
 *       e.g. "https://tiles.example.com/eu/{cc}/{z}/{x}/{y}.mvt"
 *   EXPO_PUBLIC_EU_{CC}_SOURCE_LAYER              – source layer name inside
 *       the tileset (default: "boundaries")
 *   EXPO_PUBLIC_EU_{CC}_ZOOM_TIERS                – JSON-encoded array of
 *       BoundaryZoomTier objects describing zoom-aware rendering tiers.
 *       Example: '[{"tierId":"coarse","minZoom":0,"maxZoom":8},{"tierId":"fine","minZoom":9,"maxZoom":20}]'
 *       When omitted the source renders at all zoom levels.
 */
function getEuropeVectorTilesGeometry(countryCode: string): {
  kind: "vectorTiles";
  sourceId: string;
  sourceLayer: string;
  tileUrlTemplates: string[];
  promoteId: string;
  zoomTiers?: import("./types").BoundaryZoomTier[];
} | null {
  const cc = countryCode.toUpperCase();
  const urlTemplate = (process.env[`EXPO_PUBLIC_EU_${cc}_VECTOR_TILES_URL_TEMPLATE`] ?? "").trim();
  if (!urlTemplate) return null;

  const sourceLayer = (process.env[`EXPO_PUBLIC_EU_${cc}_SOURCE_LAYER`] ?? "boundaries").trim();

  // Parse optional zoom tiers from env var
  const zoomTiersRaw = (process.env[`EXPO_PUBLIC_EU_${cc}_ZOOM_TIERS`] ?? "").trim();
  const zoomTiers = parseZoomTiers(zoomTiersRaw);

  return {
    kind: "vectorTiles",
    sourceId: `eu-${cc.toLowerCase()}-vector`,
    sourceLayer,
    tileUrlTemplates: [urlTemplate],
    promoteId: "id",
    ...(zoomTiers ? { zoomTiers } : {}),
  };
}

function buildEuropeProviderGeometry(countryCode: string): BoundaryGeometrySource {
  const vectorTilesGeometry = getEuropeVectorTilesGeometry(countryCode);
  if (vectorTilesGeometry) return vectorTilesGeometry;

  // Fallback: stub GeoJSON (kept for build sanity; real data must be loaded via
  // either zoom tiers with a vector tile backend or a remoteGeojson source).
  return {
    kind: "geojson",
    featureCollection: { type: "FeatureCollection" as const, features: [] },
    idProperty: "id",
  };
}

export type EuropeCountryConfig = {
  countryCode: string;
  name: string;
  viewport: {
    bbox: {
      sw: [number, number];
      ne: [number, number];
    };
    zoom: number;
  };
  defaultZoom: number;
};

export const EUROPE_COUNTRY_CONFIGS: Map<string, EuropeCountryConfig> = new Map([
  [
    "GB",
    {
      countryCode: "GB",
      name: "United Kingdom",
      viewport: {
        bbox: { sw: [-8.17, 49.86], ne: [1.77, 60.84] },
        zoom: 5.5,
      },
      defaultZoom: 5.5,
    },
  ],
  [
    "FR",
    {
      countryCode: "FR",
      name: "France",
      viewport: {
        bbox: { sw: [-5.14, 41.34], ne: [9.56, 51.09] },
        zoom: 5,
      },
      defaultZoom: 5,
    },
  ],
  [
    "DE",
    {
      countryCode: "DE",
      name: "Germany",
      viewport: {
        bbox: { sw: [5.87, 47.27], ne: [15.04, 55.06] },
        zoom: 5,
      },
      defaultZoom: 5,
    },
  ],
  [
    "ES",
    {
      countryCode: "ES",
      name: "Spain",
      viewport: {
        bbox: { sw: [-9.39, 35.95], ne: [3.35, 43.79] },
        zoom: 5,
      },
      defaultZoom: 5,
    },
  ],
  [
    "IT",
    {
      countryCode: "IT",
      name: "Italy",
      viewport: {
        bbox: { sw: [6.63, 35.49], ne: [18.52, 47.09] },
        zoom: 5,
      },
      defaultZoom: 5,
    },
  ],
  [
    "NL",
    {
      countryCode: "NL",
      name: "Netherlands",
      viewport: {
        bbox: { sw: [3.36, 50.75], ne: [7.21, 53.56] },
        zoom: 7,
      },
      defaultZoom: 7,
    },
  ],
  [
    "PT",
    {
      countryCode: "PT",
      name: "Portugal",
      viewport: {
        bbox: { sw: [-9.53, 36.94], ne: [-6.19, 42.16] },
        zoom: 6,
      },
      defaultZoom: 6,
    },
  ],
  [
    "BE",
    {
      countryCode: "BE",
      name: "Belgium",
      viewport: {
        bbox: { sw: [2.51, 49.5], ne: [6.41, 51.55] },
        zoom: 7,
      },
      defaultZoom: 7,
    },
  ],
  [
    "AT",
    {
      countryCode: "AT",
      name: "Austria",
      viewport: {
        bbox: { sw: [9.53, 46.37], ne: [17.16, 49.02] },
        zoom: 6,
      },
      defaultZoom: 6,
    },
  ],
  [
    "CH",
    {
      countryCode: "CH",
      name: "Switzerland",
      viewport: {
        bbox: { sw: [5.96, 45.82], ne: [10.49, 47.81] },
        zoom: 7,
      },
      defaultZoom: 7,
    },
  ],
  [
    "IE",
    {
      countryCode: "IE",
      name: "Ireland",
      viewport: {
        bbox: { sw: [-10.47, 51.45], ne: [-5.99, 55.39] },
        zoom: 6,
      },
      defaultZoom: 6,
    },
  ],
  [
    "SE",
    {
      countryCode: "SE",
      name: "Sweden",
      viewport: {
        bbox: { sw: [11.13, 55.34], ne: [24.16, 69.06] },
        zoom: 4,
      },
      defaultZoom: 4,
    },
  ],
  [
    "DK",
    {
      countryCode: "DK",
      name: "Denmark",
      viewport: {
        bbox: { sw: [8.07, 54.56], ne: [12.64, 57.75] },
        zoom: 7,
      },
      defaultZoom: 7,
    },
  ],
  [
    "NO",
    {
      countryCode: "NO",
      name: "Norway",
      viewport: {
        bbox: { sw: [4.68, 57.96], ne: [31.07, 71.18] },
        zoom: 4,
      },
      defaultZoom: 4,
    },
  ],
  [
    "PL",
    {
      countryCode: "PL",
      name: "Poland",
      viewport: {
        bbox: { sw: [14.07, 49.0], ne: [24.15, 54.84] },
        zoom: 5,
      },
      defaultZoom: 5,
    },
  ],
]);

function createEuropeProvider(countryCode: string, name: string): BoundaryProviderDefinition {
  return {
    id: `eu-${countryCode.toLowerCase()}-localities`,
    label: `${name} localities`,
    countryCode,
    geometry: buildEuropeProviderGeometry(countryCode),
    capabilities: {
      supportsPolygonSelection: true,
      supportsPostcodeSelection: false,
      supportsSearch: true,
      supportsGpsResolution: true,
      supportsVectorTiles: true,
    },
    selectionMode: "polygon",
    selectionStorage: "boundaries",
    labelPropertyCandidates: ["name", "id"],
  };
}

export function getProviderForCountry(countryCode: string): BoundaryProviderDefinition | null {
  const config = EUROPE_COUNTRY_CONFIGS.get(countryCode.toUpperCase());
  if (!config) return null;
  return createEuropeProvider(config.countryCode, config.name);
}

export function getProviderForCoordinates(
  lng: number,
  lat: number,
): BoundaryProviderDefinition | null {
  for (const config of EUROPE_COUNTRY_CONFIGS.values()) {
    const { sw, ne } = config.viewport.bbox;
    if (lng >= sw[0] && lng <= ne[0] && lat >= sw[1] && lat <= ne[1]) {
      return createEuropeProvider(config.countryCode, config.name);
    }
  }
  return null;
}
