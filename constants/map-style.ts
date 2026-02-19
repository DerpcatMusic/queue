const LAND_LAYER = "earth";
const WATER_LAYER = "water";
const WATER_LABEL_LAYER = "water";
const LANDCOVER_LAYER = "landcover";
const LANDUSE_LAYER = "landuse";
const ROADS_LAYER = "roads";
const PLACES_LAYER = "places";
const BOUNDARIES_LAYER = "boundaries";
const BUILDINGS_LAYER = "buildings";

const DEFAULT_GLYPHS_URL =
  "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

type BaseMapTokens = {
  land: string;
  landShade: string;
  park: string;
  parkShade: string;
  water: string;
  waterDeep: string;
  waterLabel: string;
  roadMinor: string;
  roadMajor: string;
  roadHighway: string;
  boundary: string;
  building: string;
  buildingEdge: string;
  cityLabel: string;
  cityLabelHalo: string;
  townLabel: string;
  townLabelHalo: string;
};

type MapColorScheme = "light" | "dark";

const BASE_MAP_TOKENS: Record<MapColorScheme, BaseMapTokens> = {
  light: {
    land: "#eef3f9",
    landShade: "#e5ebf4",
    park: "#d6eadf",
    parkShade: "#bfd8cb",
    water: "#bfd7ee",
    waterDeep: "#9fc2e2",
    waterLabel: "#4d7093",
    roadMinor: "#c4cfdd",
    roadMajor: "#a8b8ca",
    roadHighway: "#8ea4bd",
    boundary: "#a6b4c6",
    building: "#d5deea",
    buildingEdge: "#becbda",
    cityLabel: "#2f4055",
    cityLabelHalo: "#f3f7fc",
    townLabel: "#4b5f78",
    townLabelHalo: "#f3f7fc",
  },
  dark: {
    land: "#111b2d",
    landShade: "#162235",
    park: "#163140",
    parkShade: "#214355",
    water: "#1e2f4a",
    waterDeep: "#1b2a42",
    waterLabel: "#9ebad7",
    roadMinor: "#516783",
    roadMajor: "#6c83a0",
    roadHighway: "#8ea7c2",
    boundary: "#5a7090",
    building: "#4a6483",
    buildingEdge: "#5f7894",
    cityLabel: "#dce7f5",
    cityLabelHalo: "#152235",
    townLabel: "#becee2",
    townLabelHalo: "#152235",
  },
};

function getBaseMapTokens(colorScheme: MapColorScheme): BaseMapTokens {
  return BASE_MAP_TOKENS[colorScheme];
}

export function toPmtilesSourceUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  if (raw.startsWith("pmtiles://")) return raw;
  if (raw.startsWith("asset://")) return `pmtiles://${raw}`;
  if (raw.startsWith("file://")) return `pmtiles://${raw}`;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return `pmtiles://${raw}`;
  }
  if (raw.startsWith("/")) return `pmtiles://file://${raw}`;

  const normalized = raw.replace(/^\.?\//, "");
  return `pmtiles://file:///${normalized}`;
}

export function getFallbackMapStyle(
  colorScheme: MapColorScheme,
  glyphsUrl: string = DEFAULT_GLYPHS_URL,
) {
  const c = getBaseMapTokens(colorScheme);
  return {
    version: 8,
    glyphs: glyphsUrl,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": c.land },
      },
    ],
  };
}

export function getMapStyle(
  colorScheme: MapColorScheme,
  tileUrl: string,
  glyphsUrl: string = DEFAULT_GLYPHS_URL,
) {
  const sourceUrl = toPmtilesSourceUrl(tileUrl);
  if (!sourceUrl) {
    throw new Error("PMTiles URL is required to create a PMTiles style.");
  }

  const c = getBaseMapTokens(colorScheme);
  const nameField = ["coalesce", ["get", "name:he"], ["get", "name"]];

  return {
    version: 8,
    glyphs: glyphsUrl,
    sources: {
      protomaps: {
        type: "vector",
        url: sourceUrl,
        attribution: "© <a href='https://openstreetmap.org'>OpenStreetMap</a>",
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": c.land },
      },
      {
        id: "earth",
        type: "fill",
        source: "protomaps",
        "source-layer": LAND_LAYER,
        paint: { "fill-color": c.land },
      },
      {
        id: "landcover",
        type: "fill",
        source: "protomaps",
        "source-layer": LANDCOVER_LAYER,
        paint: {
          "fill-color": c.landShade,
          "fill-opacity": 0.42,
        },
      },
      {
        id: "landuse-park",
        type: "fill",
        source: "protomaps",
        "source-layer": LANDUSE_LAYER,
        filter: ["in", "kind", "park", "forest", "nature_reserve", "wood"],
        paint: {
          "fill-color": c.park,
          "fill-opacity": 0.52,
        },
      },
      {
        id: "landuse-park-shade",
        type: "line",
        source: "protomaps",
        "source-layer": LANDUSE_LAYER,
        filter: ["in", "kind", "park", "forest", "nature_reserve", "wood"],
        paint: {
          "line-color": c.parkShade,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.2, 11, 0.45],
          "line-opacity": 0.34,
        },
      },
      {
        id: "water",
        type: "fill",
        source: "protomaps",
        "source-layer": WATER_LAYER,
        filter: [
          "all",
          [
            "match",
            ["get", "kind"],
            ["water", "lake", "ocean", "other"],
            true,
            false,
          ],
          [
            "!",
            [
              "match",
              ["get", "kind_detail"],
              ["river", "riverbank", "stream", "canal", "drain", "ditch"],
              true,
              false,
            ],
          ],
        ],
        paint: {
          "fill-color": c.water,
          "fill-opacity": 0.82,
        },
      },
      {
        id: "water-rivers",
        type: "line",
        source: "protomaps",
        "source-layer": WATER_LAYER,
        filter: [
          "match",
          ["get", "kind_detail"],
          ["river", "riverbank", "stream", "canal", "drain", "ditch"],
          true,
          false,
        ],
        paint: {
          "line-color": c.waterDeep,
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.45, 11, 1.35],
          "line-opacity": 0.55,
        },
      },
      {
        id: "boundaries",
        type: "line",
        source: "protomaps",
        "source-layer": BOUNDARIES_LAYER,
        minzoom: 5,
        paint: {
          "line-color": c.boundary,
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.25, 11, 0.85],
          "line-opacity": 0.22,
        },
      },
      {
        id: "roads-highway",
        type: "line",
        source: "protomaps",
        "source-layer": ROADS_LAYER,
        filter: ["==", ["get", "kind"], "highway"],
        minzoom: 7,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": c.roadHighway,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.9, 11, 2.1],
          "line-opacity": 0.72,
        },
      },
      {
        id: "roads-major",
        type: "line",
        source: "protomaps",
        "source-layer": ROADS_LAYER,
        filter: ["in", "kind", "major_road", "medium_road"],
        minzoom: 8,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": c.roadMajor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.62, 11, 1.52],
          "line-opacity": 0.56,
        },
      },
      {
        id: "roads-minor",
        type: "line",
        source: "protomaps",
        "source-layer": ROADS_LAYER,
        filter: ["==", ["get", "kind"], "minor_road"],
        minzoom: 10,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": c.roadMinor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9.5, 0.2, 11, 0.62],
          "line-opacity": 0.34,
        },
      },
      {
        id: "buildings-footprint",
        type: "fill",
        source: "protomaps",
        "source-layer": BUILDINGS_LAYER,
        minzoom: 10.5,
        paint: {
          "fill-color": c.building,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 10.5, 0.18, 11, 0.42],
        },
      },
      {
        id: "buildings-outline",
        type: "line",
        source: "protomaps",
        "source-layer": BUILDINGS_LAYER,
        minzoom: 10.5,
        paint: {
          "line-color": c.buildingEdge,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10.5, 0.15, 11, 0.55],
          "line-opacity": 0.44,
        },
      },
      {
        id: "water-labels",
        type: "symbol",
        source: "protomaps",
        "source-layer": WATER_LABEL_LAYER,
        minzoom: 6,
        layout: {
          "text-field": nameField,
          "text-size": ["interpolate", ["linear"], ["zoom"], 6, 10.5, 9, 12.5, 11, 15],
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 8,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": c.waterLabel,
          "text-halo-color": c.water,
          "text-halo-width": 1.45,
        },
      },
      {
        id: "places-city",
        type: "symbol",
        source: "protomaps",
        "source-layer": PLACES_LAYER,
        filter: ["in", "kind", "city", "town"],
        minzoom: 4,
        layout: {
          "text-field": nameField,
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            10,
            8,
            13.5,
            10,
            15.5,
            11,
            16.5,
          ],
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 10,
          "text-allow-overlap": false,
          "text-letter-spacing": 0.02,
        },
        paint: {
          "text-color": c.cityLabel,
          "text-halo-color": c.cityLabelHalo,
          "text-halo-width": 1.5,
          "text-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            0.96,
            11,
            0.96,
            13,
            0.72,
          ],
        },
      },
      {
        id: "places-town",
        type: "symbol",
        source: "protomaps",
        "source-layer": PLACES_LAYER,
        filter: ["in", "kind", "village", "suburb", "quarter", "neighbourhood"],
        minzoom: 11,
        layout: {
          "text-field": nameField,
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 8.8, 13, 11.5],
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 8,
          "text-allow-overlap": false,
          "text-letter-spacing": 0.015,
        },
        paint: {
          "text-color": c.townLabel,
          "text-halo-color": c.townLabelHalo,
          "text-halo-width": 1.35,
          "text-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            0.25,
            12,
            0.78,
            13,
            0.95,
          ],
        },
      },
    ],
  };
}
