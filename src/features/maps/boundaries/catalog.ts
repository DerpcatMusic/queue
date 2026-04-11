import { ZONE_OPTIONS, type ZoneOption } from "@/constants/zones";
import { getZoneCityMeta, getZoneIdsForCity } from "@/constants/zones-city";

import { LONDON_OVERTURE_BOROUGH_GEOJSON, LONDON_BOROUGH_PROVIDER_ID } from "./london-boroughs";
import { ENGLAND_BOUNDARY_PROVIDER, LONDON_BOROUGH_BOUNDARY_PROVIDER } from "./providers";
import type { BoundaryProviderDefinition } from "./types";

export type BoundaryLanguage = "en" | "he";

export type SelectableBoundary = {
  id: string;
  label: {
    en: string;
    he: string;
  };
  parentBoundaryId?: string;
  parentCityKey: string;
  parentCityLabel: {
    en: string;
    he: string;
  };
  countryCode: string;
  kind: "zone" | "city" | "borough" | "district" | "postcode";
  depth: number;
  source: string;
  seconds?: number;
  rawZone?: ZoneOption;
  postcode?: string;
};

export type BoundaryCityMeta = {
  cityKey: string;
  cityLabel: {
    en: string;
    he: string;
  };
  boundaryIds: string[];
};

function toSelectableIsraelBoundary(zone: ZoneOption): SelectableBoundary {
  const cityMeta = getZoneCityMeta(zone.id);
  return {
    id: zone.id,
    label: zone.label,
    parentCityKey: cityMeta?.cityKey ?? zone.id,
    parentCityLabel: {
      en: cityMeta?.cityEng ?? zone.label.en,
      he: cityMeta?.cityHeb ?? zone.label.he,
    },
    countryCode: "IL",
    kind: "zone",
    depth: 1,
    seconds: zone.seconds,
    source: "israel-pikud",
    rawZone: zone,
  };
}

function buildIsraelCityMeta(boundaries: SelectableBoundary[]) {
  return new Map<string, BoundaryCityMeta>(
    [...new Set(boundaries.map((boundary) => boundary.parentCityKey))].map((cityKey) => {
      const firstBoundary = boundaries.find((boundary) => boundary.parentCityKey === cityKey);
      return [
        cityKey,
        {
          cityKey,
          cityLabel: firstBoundary?.parentCityLabel ?? { en: cityKey, he: cityKey },
          boundaryIds: getZoneIdsForCity(cityKey),
        },
      ] as const;
    }),
  );
}

const LONDON_CITY_BOUNDARY: SelectableBoundary = {
  id: "london",
  label: { en: "London", he: "London" },
  parentCityKey: "london",
  parentCityLabel: { en: "London", he: "London" },
  countryCode: "GB",
  kind: "city",
  depth: 0,
  source: LONDON_BOROUGH_PROVIDER_ID,
};

/**
 * Builds selectable boundaries for the England provider.
 * Currently returns a single "England" city node; real sub-national boundaries
 * require Overture/OSM data download (see scripts/data/download-england-boundaries.py).
 */
function buildEnglandBoundaries(): SelectableBoundary[] {
  const englandCity: SelectableBoundary = {
    id: "england",
    label: { en: "England", he: "England" },
    parentCityKey: "england",
    parentCityLabel: { en: "England", he: "England" },
    countryCode: "GB",
    kind: "city",
    depth: 0,
    source: ENGLAND_BOUNDARY_PROVIDER.id,
  };
  return [englandCity];
}

/** Israel boundaries (static - only one provider for IL) */
export function buildIsraelBoundaries(): SelectableBoundary[] {
  return ZONE_OPTIONS.map(toSelectableIsraelBoundary);
}

/** London borough boundaries */
export function buildLondonBoundariesWithCity(
  cityBoundary: SelectableBoundary,
): SelectableBoundary[] {
  const boundaries = (LONDON_OVERTURE_BOROUGH_GEOJSON.features ?? [])
    .map((feature): SelectableBoundary | null => {
      const id = String(feature.properties?.id ?? "").trim();
      const name = String(feature.properties?.name ?? "").trim();
      if (!id || !name) return null;
      return {
        id,
        label: { en: name, he: name },
        parentBoundaryId: cityBoundary.id,
        parentCityKey: "london",
        parentCityLabel: { en: "London", he: "London" },
        countryCode: "GB",
        kind: "borough" as const,
        depth: 1,
        source: LONDON_BOROUGH_PROVIDER_ID,
      };
    })
    .filter((boundary): boundary is SelectableBoundary => boundary !== null);

  return [cityBoundary, ...boundaries.sort((a, b) => a.label.en.localeCompare(b.label.en))];
}

/** Build boundaries for a given provider */
export function buildBoundariesForProvider(
  provider: BoundaryProviderDefinition,
): SelectableBoundary[] {
  switch (provider.id) {
    case "israel-pikud":
      return buildIsraelBoundaries();
    case LONDON_BOROUGH_PROVIDER_ID:
      return buildLondonBoundariesWithCity(LONDON_CITY_BOUNDARY);
    case ENGLAND_BOUNDARY_PROVIDER.id:
      return buildEnglandBoundaries();
    default:
      // For any other provider (e.g. eu-* providers), return empty for now
      // Real implementations would load from geometry source
      return [];
  }
}

/** Build city metadata for a given provider's boundaries */
export function buildCityMetaForProvider(
  provider: BoundaryProviderDefinition,
  boundaries: SelectableBoundary[],
): Map<string, BoundaryCityMeta> {
  switch (provider.id) {
    case "israel-pikud":
      return buildIsraelCityMeta(boundaries);
    case LONDON_BOROUGH_PROVIDER_ID:
      return new Map<string, BoundaryCityMeta>([
        [
          "london",
          {
            cityKey: "london",
            cityLabel: { en: "London", he: "London" },
            boundaryIds: boundaries.filter((b) => b.kind !== "city").map((b) => b.id),
          },
        ],
      ]);
    case ENGLAND_BOUNDARY_PROVIDER.id:
      return new Map<string, BoundaryCityMeta>([
        [
          "england",
          {
            cityKey: "england",
            cityLabel: { en: "England", he: "England" },
            boundaryIds: boundaries.filter((b) => b.kind !== "city").map((b) => b.id),
          },
        ],
      ]);
    default:
      return new Map();
  }
}

// Legacy static exports for backward compatibility (defaults to London)
const ISRAEL_BOUNDARIES = buildIsraelBoundaries();
const LONDON_BOUNDARIES = buildLondonBoundariesWithCity(LONDON_CITY_BOUNDARY);

export { ISRAEL_BOUNDARIES, LONDON_BOUNDARIES };

export const SELECTABLE_BOUNDARY_OPTIONS = LONDON_BOUNDARIES;

export const SELECTABLE_BOUNDARY_BY_ID = new Map(
  SELECTABLE_BOUNDARY_OPTIONS.map((boundary) => [boundary.id, boundary]),
);

export const CITY_META_BY_KEY = buildCityMetaForProvider(
  LONDON_BOROUGH_BOUNDARY_PROVIDER,
  SELECTABLE_BOUNDARY_OPTIONS,
);

export function getSelectableBoundary(boundaryId: string) {
  return SELECTABLE_BOUNDARY_BY_ID.get(boundaryId);
}

export function getSelectableBoundaryLabel(
  boundaryId: string,
  language: BoundaryLanguage = "en",
): string {
  const boundary = getSelectableBoundary(boundaryId);
  if (!boundary) return boundaryId;
  return language === "he" ? boundary.label.he : boundary.label.en;
}

export function getCityBoundaries(cityKey: string): SelectableBoundary[] {
  const meta = CITY_META_BY_KEY.get(cityKey);
  if (!meta) return [];
  return meta.boundaryIds
    .map((boundaryId) => getSelectableBoundary(boundaryId))
    .filter((boundary): boundary is SelectableBoundary => Boolean(boundary));
}

export function getBoundaryAncestorIds(boundaryId: string): string[] {
  const ancestors: string[] = [];
  let current = getSelectableBoundary(boundaryId);
  while (current?.parentBoundaryId) {
    ancestors.push(current.parentBoundaryId);
    current = getSelectableBoundary(current.parentBoundaryId);
  }
  return ancestors;
}
