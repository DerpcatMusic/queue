import londonBoroughsRaw from "../../../../assets/data/europe/london-boroughs.json";
import londonOvertureBoroughsRaw from "../../../../assets/data/europe/london-overture-boroughs.json";

import type { BoundaryFeatureCollection, BoundaryViewportTarget } from "./types";

type LngLat = [number, number];

export const LONDON_BOROUGH_PROVIDER_ID = "gb-london-boroughs";
export const LONDON_BOROUGH_GEOJSON = londonBoroughsRaw as BoundaryFeatureCollection;
export const LONDON_OVERTURE_BOROUGH_GEOJSON =
  londonOvertureBoroughsRaw as BoundaryFeatureCollection;

function computeFeatureBounds(coordinates: any): { sw: LngLat; ne: LngLat } | null {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  const visit = (value: any) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      const lng = value[0] as number;
      const lat = value[1] as number;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
      return;
    }

    for (const nested of value) {
      visit(nested);
    }
  };

  visit(coordinates);

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

export const LONDON_BOROUGH_BOUNDS_BY_ID = new Map(
  (LONDON_BOROUGH_GEOJSON.features ?? [])
    .map((feature) => {
      const boundaryId = String(feature.properties?.id ?? "").trim();
      const geometry = feature.geometry as
        | GeoJSON.Polygon
        | GeoJSON.MultiPolygon
        | undefined;
      const bounds = computeFeatureBounds(geometry?.coordinates);
      if (!boundaryId || !bounds) return null;
      return [boundaryId, bounds] as const;
    })
    .filter((entry): entry is readonly [string, { sw: LngLat; ne: LngLat }] => Boolean(entry)),
);

export const LONDON_VIEWPORT_TARGET: BoundaryViewportTarget = {
  countryCode: "GB",
  bbox: {
    sw: [-0.5103, 51.2868],
    ne: [0.3340, 51.6923],
  },
  zoom: 8.7,
};

function buildLondonBoroughFeatureCollectionFromArcGis(json: any): BoundaryFeatureCollection {
  return {
    type: "FeatureCollection",
    features: (json.features ?? []).map((feature: any) => ({
      type: "Feature",
      properties: {
        id: `london-borough:${String(feature.attributes?.gss_code ?? "").trim()}`,
        name: String(feature.attributes?.name ?? "").trim(),
        countryCode: "GB",
        city: "London",
        boroughCode: String(feature.attributes?.gss_code ?? "").trim(),
        source: "gla-london-boroughs",
      },
      geometry: {
        type: "Polygon",
        coordinates: (feature.geometry?.rings ?? []).map((ring: number[][]) =>
          ring.map(([lng, lat]) => [lng, lat]),
        ),
      },
    })),
  };
}

function createLondonArcGisQueryUrl(bbox: { sw: LngLat; ne: LngLat } | null) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "name,gss_code",
    returnGeometry: "true",
    outSR: "4326",
    f: "pjson",
  });

  if (bbox) {
    params.set("geometryType", "esriGeometryEnvelope");
    params.set(
      "geometry",
      JSON.stringify({
        xmin: bbox.sw[0],
        ymin: bbox.sw[1],
        xmax: bbox.ne[0],
        ymax: bbox.ne[1],
        spatialReference: { wkid: 4326 },
      }),
    );
    params.set("inSR", "4326");
    params.set("spatialRel", "esriSpatialRelIntersects");
  }

  return `https://gis2.london.gov.uk/server/rest/services/apps/webmap_context_layer/MapServer/3/query?${params.toString()}`;
}

export async function loadLondonBoroughFeatureCollection(args: {
  bbox: { sw: LngLat; ne: LngLat } | null;
  signal?: AbortSignal;
}) {
  const response = await fetch(createLondonArcGisQueryUrl(args.bbox), {
    ...(args.signal ? { signal: args.signal } : {}),
  });
  if (!response.ok) {
    throw new Error(`Failed to load London boroughs (${response.status})`);
  }
  const json = await response.json();
  return buildLondonBoroughFeatureCollectionFromArcGis(json);
}
