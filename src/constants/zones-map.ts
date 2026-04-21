/**
 * zones-map.ts — STRIPPED of Pikud/H3 zone logic.
 * 
 * The legacy Pikud HaOref polygon zone system has been removed.
 * Onboarding no longer validates against polygon boundaries.
 * H3 hexagonal grid handles global geolocation instead.
 * 
 * Only kept: ISRAEL_MAP_INTERACTION_BOUNDS (hardcoded) for map bootstrap
 * and boundary provider detection.
 */

// Hardcoded Israel map bounds (replaces the dynamic parsing from pikud-haoref JSON)
export const ISRAEL_MAP_INTERACTION_BOUNDS: {
  sw: [number, number];
  ne: [number, number];
} = {
  sw: [34.17, 29.49],
  ne: [35.90, 33.28],
};

// Re-export stubs for any remaining consumers
export type ZoneCityMeta = { cityKey: string; cityHeb: string; cityEng: string };
export type ZoneIndexEntry = { id: string; featureIndex: number; bbox: [number, number, number, number]; center: [number, number]; seconds: number };
export type ZoneFeatureCollection = { type: "FeatureCollection"; features: unknown[] };
export type CityFeatureCollection = { type: "FeatureCollection"; features: unknown[] };
export type AreaFeatureCollection = { type: "FeatureCollection"; features: unknown[] };

export const PIKUD_AREA_GEOJSON: AreaFeatureCollection = { type: "FeatureCollection", features: [] };
export const PIKUD_ZONE_GEOJSON: ZoneFeatureCollection = { type: "FeatureCollection", features: [] };
export const PIKUD_CITY_GEOJSON: CityFeatureCollection = { type: "FeatureCollection", features: [] };
export const PIKUD_ZONE_FEATURES: unknown[] = [];
export const PIKUD_ZONE_INDEX: ZoneIndexEntry[] = [];

export function buildZoneFeatureCollection(_zoneIds: string[]): ZoneFeatureCollection {
  return { type: "FeatureCollection", features: [] };
}
export function getZoneCityMeta(_zoneId: string): ZoneCityMeta | undefined { return undefined; }
export function getZoneIdsForCity(_cityKey: string): string[] { return []; }
export function buildCityFeatureCollectionFromZoneIds(_zoneIds: string[]): CityFeatureCollection {
  return { type: "FeatureCollection", features: [] };
}
export function getZoneIndexEntry(_zoneId: string): ZoneIndexEntry | undefined { return undefined; }
export function findZoneIdForCoordinate(_point: { longitude: number; latitude: number }): string | null { return null; }