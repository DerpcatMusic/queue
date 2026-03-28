/**
 * Custom MapLibre style for Queue.
 *
 * Self-contained branded map style using OpenFreeMap vector tiles.
 * Every layer, color, and width is defined here — no base style fetch required.
 *
 * Design philosophy:
 * - Buildings are the dominant urban feature (not roads)
 * - Roads are subtle warm-gray lines that don't compete
 * - Clean, warm-toned palette that harmonizes with the brand
 */

import type { AnyStyleSpec } from "@/components/maps/queue-map.native.helpers";
import type { getMapBrandPalette } from "@/constants/brand";

// ─── Constants ────────────────────────────────────────────────────────────────

const GLYPHS_URL = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const SPRITE_URL = "https://tiles.openfreemap.org/sprites/ofm_f384/ofm";
const VECTOR_SOURCE_URL = "https://tiles.openfreemap.org/planet";

// Road zoom interpolation: [zoom, width, zoom, width, ...]
const RW = {
  major: [5, 0.3, 9, 0.7, 12, 1.4, 15, 2.4],
  minor: [5, 0.18, 9, 0.4, 12, 0.75, 15, 1.3],
};

// ─── Style builder ────────────────────────────────────────────────────────────

export function buildCustomMapStyle(palette: ReturnType<typeof getMapBrandPalette>): AnyStyleSpec {
  return {
    version: 8,
    name: "Queue",
    glyphs: GLYPHS_URL,
    sprite: SPRITE_URL,
    sources: {
      openmaptiles: {
        type: "vector",
        url: VECTOR_SOURCE_URL,
      },
    },
    layers: [
      // ── Background ─────────────────────────────────────────────────────────
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": palette.styleBackground,
        },
      },

      // ── Water ──────────────────────────────────────────────────────────────
      {
        id: "water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        paint: {
          "fill-color": palette.waterFill,
          "fill-opacity": 1,
        },
      },

      // ── Landcover: parks ──────────────────────────────────────────────────
      {
        id: "landcover-park",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "park",
        paint: {
          "fill-color": palette.landcover,
          "fill-opacity": 0.7,
        },
      },
      {
        id: "landcover-wood",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "wood"],
        paint: {
          "fill-color": palette.landcover,
          "fill-opacity": 0.5,
        },
      },
      {
        id: "landcover-grass",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "grass"],
        paint: {
          "fill-color": palette.landcover,
          "fill-opacity": 0.35,
        },
      },

      // ── Landuse: residential ──────────────────────────────────────────────
      {
        id: "landuse-residential",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landuse",
        filter: ["==", ["get", "class"], "residential"],
        paint: {
          "fill-color": palette.landcover,
          "fill-opacity": 0.22,
        },
      },

      // ── Aeroway: runways ───────────────────────────────────────────────────
      {
        id: "aeroway-runway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "aeroway",
        filter: ["==", ["get", "class"], "runway"],
        paint: {
          "line-color": palette.roadSecondary,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 14, 8, 18, 20],
          "line-opacity": 0.5,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      },

      // ── Roads — subtle warm gray, don't compete with buildings ─────────────
      // All road classes use the same color, differentiated only by width
      {
        id: "road-major",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "road"]],
        ],
        paint: {
          "line-color": palette.roadPrimary,
          "line-width": ["interpolate", ["linear"], ["zoom"], ...RW.major],
          "line-opacity": 0.75,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      },
      {
        id: "road-minor",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["residential", "service", "track", "path", "unclassified", "living_street"]],
        ],
        paint: {
          "line-color": palette.roadSecondary,
          "line-width": ["interpolate", ["linear"], ["zoom"], ...RW.minor],
          "line-opacity": 0.7,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      },

      // ── Bridges — slightly more visible ──────────────────────────────────────
      {
        id: "road-bridge",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["==", ["get", "brunnel"], "bridge"],
        paint: {
          "line-color": palette.roadSecondary,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 9, 1.0, 12, 2.0, 15, 3.5],
          "line-opacity": 0.8,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      },

      // ── Buildings — the dominant urban feature ──────────────────────────────
      // Rendered after roads so they naturally sit on top
      {
        id: "building",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        paint: {
          "fill-color": palette.buildingFill,
          "fill-opacity": palette.buildingOpacity ?? 0.85,
        },
      },

      // ── Waterway labels (river names) ───────────────────────────────────────
      {
        id: "waterway-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "waterway",
        filter: ["==", ["get", "class"], "river"],
        layout: {
          "text-font": ["Noto Sans Regular"],
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 10, 12, 12, 14, 14],
          "text-max-width": 6,
          "symbol-placement": "line",
        },
        paint: {
          "text-color": palette.waterLine,
          "text-halo-color": palette.styleBackground,
          "text-halo-width": 1.0,
        },
      },

      // ── Place labels (city, town, village) ─────────────────────────────────
      {
        id: "place-city",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: ["==", ["get", "class"], "city"],
        layout: {
          "text-font": ["Noto Sans Bold"],
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 12, 8, 16, 10, 20],
          "text-max-width": 8,
        },
        paint: {
          "text-color": palette.text,
          "text-halo-color": palette.textHalo,
          "text-halo-width": 1.2,
        },
      },
      {
        id: "place-town",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: ["==", ["get", "class"], "town"],
        layout: {
          "text-font": ["Noto Sans Bold"],
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 6, 10, 9, 14, 11, 16],
          "text-max-width": 8,
        },
        paint: {
          "text-color": palette.text,
          "text-halo-color": palette.textHalo,
          "text-halo-width": 1.0,
        },
      },
      {
        id: "place-village",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: ["==", ["get", "class"], "village"],
        layout: {
          "text-font": ["Noto Sans Regular"],
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 7, 9, 10, 12, 12, 14],
          "text-max-width": 8,
        },
        paint: {
          "text-color": palette.text,
          "text-halo-color": palette.textHalo,
          "text-halo-width": 1.0,
        },
      },

      // ── Road name labels ─────────────────────────────────────────────────────
      {
        id: "road-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        filter: ["!=", ["get", "class"], "rail"],
        layout: {
          "text-font": ["Noto Sans Regular"],
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 9, 14, 11, 16, 13],
          "text-max-width": 5,
          "symbol-placement": "line",
          "text-rotation-alignment": "map",
        },
        paint: {
          "text-color": palette.text,
          "text-halo-color": palette.textHalo,
          "text-halo-width": 1.0,
        },
      },
    ],
  };
}
