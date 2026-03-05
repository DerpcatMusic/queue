import {
  getZoneCityMeta as getZoneCityMetaFromIndex,
  getZoneIdsForCity as getZoneIdsForCityFromIndex,
  type ZoneCityMeta,
} from "@/constants/zones-city";
import zoneGeoJsonRaw from "../../assets/data/pikud-haoref/all.json";
import cityGeoJsonRaw from "../../assets/data/pikud-haoref/city-polygons.json";
import zoneIndexFileRaw from "../../assets/data/pikud-haoref/zone-index.json";

type ZoneGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;
type LngLatPoint = { longitude: number; latitude: number };

type ZoneFeatureProperties = {
  id?: string;
  hebName?: string;
  engName?: string;
  cityHeb?: string;
  cityEng?: string;
  seconds?: number;
  type?: string;
};

type ZoneFeature = GeoJSON.Feature<ZoneGeometry, ZoneFeatureProperties>;
type ZoneFeatureCollection = GeoJSON.FeatureCollection<ZoneGeometry, ZoneFeatureProperties>;

type AreaFeatureProperties = {
  id: string;
  hebName: string;
  engName: string;
};

type AreaFeature = GeoJSON.Feature<ZoneGeometry, AreaFeatureProperties>;
type AreaFeatureCollection = GeoJSON.FeatureCollection<ZoneGeometry, AreaFeatureProperties>;

type CityFeatureProperties = {
  id: string;
  cityHeb: string;
  cityEng: string;
};

type CityFeatureCollection = GeoJSON.FeatureCollection<ZoneGeometry, CityFeatureProperties>;

type ZoneIndexEntry = {
  id: string;
  featureIndex: number;
  bbox: [number, number, number, number];
  center: [number, number];
  seconds: number;
};

type ZoneIndexFile = {
  version: number;
  generatedAt: string;
  bounds: {
    sw: [number, number];
    ne: [number, number];
  };
  zones: ZoneIndexEntry[];
};

const zoneGeoJson = zoneGeoJsonRaw as ZoneFeatureCollection;
const cityGeoJson = cityGeoJsonRaw as CityFeatureCollection;
const zoneIndexFile = zoneIndexFileRaw as ZoneIndexFile;

export const PIKUD_ZONE_GEOJSON = zoneGeoJson;
export const PIKUD_CITY_GEOJSON = cityGeoJson;
const PIKUD_ZONE_FEATURES = zoneGeoJson.features ?? [];
const PIKUD_ZONE_INDEX = zoneIndexFile.zones ?? [];
const ISRAEL_MAP_BOUNDS = zoneIndexFile.bounds;
// Keep the camera inside Israel bounds and reduce drift into empty ocean space.
export const ISRAEL_MAP_INTERACTION_BOUNDS = {
  sw: [ISRAEL_MAP_BOUNDS.sw[0] + 0.32, ISRAEL_MAP_BOUNDS.sw[1]] as [number, number],
  ne: [ISRAEL_MAP_BOUNDS.ne[0] - 0.03, ISRAEL_MAP_BOUNDS.ne[1]] as [number, number],
};

export const PIKUD_AREA_GEOJSON: AreaFeatureCollection = {
  type: "FeatureCollection",
  features: PIKUD_ZONE_FEATURES.map((feature) => {
    const id = String(feature.properties?.id ?? "").trim();
    const hebName = String(feature.properties?.hebName ?? id).trim() || id;
    const engName = String(feature.properties?.engName ?? hebName).trim() || hebName;

    return {
      type: "Feature",
      properties: {
        id,
        hebName,
        engName,
      },
      geometry: feature.geometry,
    };
  }).filter(
    (feature): feature is AreaFeature =>
      Boolean(feature.properties.id) &&
      (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon"),
  ),
};

const zoneIndexById = new Map<string, ZoneIndexEntry>();
const zoneFeatureById = new Map<string, ZoneFeature>();
const cityFeatureByCityKey = new Map<
  string,
  GeoJSON.Feature<ZoneGeometry, CityFeatureProperties>
>();

for (const zone of PIKUD_ZONE_INDEX) {
  zoneIndexById.set(zone.id, zone);
}

for (const zoneFeature of PIKUD_ZONE_FEATURES) {
  const zoneId = String(zoneFeature.properties?.id ?? "").trim();
  if (!zoneId) continue;

  zoneFeatureById.set(zoneId, zoneFeature);
}

for (const cityFeature of cityGeoJson.features ?? []) {
  const cityKey = String(cityFeature.properties?.id ?? "").trim();
  if (!cityKey) continue;
  cityFeatureByCityKey.set(cityKey, cityFeature);
}

export function getZoneIndexEntry(zoneId: string): ZoneIndexEntry | undefined {
  return zoneIndexById.get(zoneId);
}

function getZoneFeature(zoneId: string): ZoneFeature | undefined {
  const fromMap = zoneFeatureById.get(zoneId);
  if (fromMap) return fromMap;

  const zone = getZoneIndexEntry(zoneId);
  if (!zone) return undefined;
  return PIKUD_ZONE_FEATURES[zone.featureIndex] as ZoneFeature | undefined;
}

export function buildZoneFeatureCollection(zoneIds: string[]): ZoneFeatureCollection {
  const uniqueIds = [...new Set(zoneIds)];
  const features = uniqueIds
    .map((zoneId) => getZoneFeature(zoneId))
    .filter((feature): feature is ZoneFeature => Boolean(feature));

  return {
    type: "FeatureCollection",
    features,
  };
}

export function getZoneCityMeta(zoneId: string): ZoneCityMeta | undefined {
  return getZoneCityMetaFromIndex(zoneId);
}

export function getZoneIdsForCity(cityKey: string): string[] {
  return getZoneIdsForCityFromIndex(cityKey);
}

export function buildCityFeatureCollectionFromZoneIds(zoneIds: string[]): CityFeatureCollection {
  const seen = new Set<string>();
  const features: GeoJSON.Feature<ZoneGeometry, CityFeatureProperties>[] = [];

  for (const zoneId of zoneIds) {
    const cityMeta = getZoneCityMeta(zoneId);
    if (!cityMeta || seen.has(cityMeta.cityKey)) continue;
    seen.add(cityMeta.cityKey);

    const cityFeature = cityFeatureByCityKey.get(cityMeta.cityKey);
    if (cityFeature) {
      features.push(cityFeature);
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

function isPointInsideRing(point: LngLatPoint, ring: number[][]): boolean {
  let inside = false;
  const x = point.longitude;
  const y = point.latitude;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i]?.[0];
    const yi = ring[i]?.[1];
    const xj = ring[j]?.[0];
    const yj = ring[j]?.[1];
    if (
      typeof xi !== "number" ||
      typeof yi !== "number" ||
      typeof xj !== "number" ||
      typeof yj !== "number"
    ) {
      continue;
    }

    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function isPointInsidePolygon(point: LngLatPoint, rings: number[][][]): boolean {
  if (!rings.length) return false;
  if (!isPointInsideRing(point, rings[0] ?? [])) {
    return false;
  }

  for (let i = 1; i < rings.length; i += 1) {
    if (isPointInsideRing(point, rings[i] ?? [])) {
      return false;
    }
  }

  return true;
}

function isPointInZoneGeometry(point: LngLatPoint, geometry: ZoneGeometry): boolean {
  if (geometry.type === "Polygon") {
    return isPointInsidePolygon(point, geometry.coordinates as number[][][]);
  }

  const multipolygon = geometry.coordinates as number[][][][];
  for (const polygon of multipolygon) {
    if (isPointInsidePolygon(point, polygon)) {
      return true;
    }
  }

  return false;
}

function isPointInBbox(point: LngLatPoint, bbox: [number, number, number, number]) {
  return (
    point.longitude >= bbox[0] &&
    point.longitude <= bbox[2] &&
    point.latitude >= bbox[1] &&
    point.latitude <= bbox[3]
  );
}

export function findZoneIdForCoordinate(point: LngLatPoint): string | null {
  for (const zone of PIKUD_ZONE_INDEX) {
    if (!isPointInBbox(point, zone.bbox)) {
      continue;
    }

    const feature = PIKUD_ZONE_FEATURES[zone.featureIndex] as ZoneFeature | undefined;
    if (!feature || !feature.geometry) {
      continue;
    }

    if (isPointInZoneGeometry(point, feature.geometry)) {
      return zone.id;
    }
  }

  return null;
}
