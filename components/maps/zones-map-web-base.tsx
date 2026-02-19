import { Brand, BrandRadius } from "@/constants/brand";
import {
  getFallbackMapStyle,
  getMapStyle,
  toPmtilesSourceUrl,
} from "@/constants/map-style";
import {
  buildZoneFeatureCollection,
  getZoneIndexEntry,
  ISRAEL_MAP_INTERACTION_BOUNDS,
  PIKUD_AREA_GEOJSON,
  PIKUD_CITY_GEOJSON,
  PIKUD_ZONE_GEOJSON,
} from "@/constants/zones-map";
import { useColorScheme } from "@/hooks/use-color-scheme";
import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

type MapLibreWithSupportedOverride = typeof maplibregl & {
  supported: () => boolean;
};

// Fix: maplibre-gl v5 tries to create a blob worker for its supported() check,
// which fails in Metro/webpack environments. Override it before any map init.
(maplibregl as MapLibreWithSupportedOverride).supported = () => true;

// Register pmtiles:// protocol once at module level
const _pmtilesProtocol = new Protocol();
maplibregl.addProtocol("pmtiles", _pmtilesProtocol.tile.bind(_pmtilesProtocol));

const PMTILES_URL = process.env.EXPO_PUBLIC_PM_TILES_URL?.trim() ?? "";
const FALLBACK_STYLE_URL = process.env.EXPO_PUBLIC_BASEMAP_STYLE_URL?.trim() ?? "";
const PMTILES_MAX_ZOOM = Number.parseFloat(
  process.env.EXPO_PUBLIC_PM_TILES_MAX_ZOOM ?? "12",
);
const MAP_GLYPHS_URL =
  "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

type ZonesMapWebBaseProps = {
  selectedZoneIds: string[];
  previewZoneIds: string[];
  focusZoneId: string | null;
  onPressZone: (zoneId: string) => void;
  selectionEnabled: boolean;
  minHeight: number;
};

const ALL_SOURCE_ID = "zones-all-source";
const AREA_SOURCE_ID = "zones-area-source";
const CITY_SOURCE_ID = "zones-city-source";
const PREVIEW_SOURCE_ID = "zones-preview-source";
const SELECTED_SOURCE_ID = "zones-selected-source";

const AREA_FILL_LAYER_ID = "zones-area-fill";
const AREA_OUTLINE_LAYER_ID = "zones-area-outline";
const AREA_LABEL_LAYER_ID = "zones-area-label";
const CITY_OUTLINE_LAYER_ID = "zones-city-outline";
const CITY_LABEL_LAYER_ID = "zones-city-label";
const TOUCH_FILL_LAYER_ID = "zones-touch-fill";
const OUTLINE_LAYER_ID = "zones-outline";
const PREVIEW_FILL_LAYER_ID = "zones-preview-fill";
const PREVIEW_LINE_LAYER_ID = "zones-preview-line";
const SELECTED_FILL_LAYER_ID = "zones-selected-fill";
const SELECTED_LINE_LAYER_ID = "zones-selected-line";
const SELECTED_LABEL_LAYER_ID = "zones-selected-label";

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const ZONE_LABEL_OPACITY = ["interpolate", ["linear"], ["zoom"], 8.2, 0.4, 10.2, 0.92];
const CITY_LABEL_OPACITY = [
  "interpolate",
  ["linear"],
  ["zoom"],
  8,
  0.58,
  10.5,
  0.84,
  13,
  0.44,
];
const CITY_OUTLINE_OPACITY = ["interpolate", ["linear"], ["zoom"], 8, 0.16, 9.6, 0];

export function ZonesMapWebBase({
  selectedZoneIds,
  previewZoneIds,
  focusZoneId,
  onPressZone,
  selectionEnabled,
  minHeight,
}: ZonesMapWebBaseProps) {
  const { i18n } = useTranslation();
  const uiColorScheme = useColorScheme() ?? "light";
  const mapColorScheme = uiColorScheme === "dark" ? "dark" : "light";
  const palette = Brand[uiColorScheme];
  const mapTheme = Brand[uiColorScheme];
  const mapPalette = mapTheme.map;
  const labelProperty =
    i18n.dir(i18n.resolvedLanguage) === "rtl" ? "hebName" : "engName";
  const cityLabelProperty = labelProperty === "hebName" ? "cityHeb" : "cityEng";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const selectionEnabledRef = useRef(selectionEnabled);
  const onPressZoneRef = useRef(onPressZone);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

  const selectedFeatures = useMemo(
    () => buildZoneFeatureCollection(selectedZoneIds),
    [selectedZoneIds],
  );
  const previewFeatures = useMemo(
    () => buildZoneFeatureCollection(previewZoneIds.slice(0, 20)),
    [previewZoneIds],
  );

  useEffect(() => {
    selectionEnabledRef.current = selectionEnabled;
  }, [selectionEnabled]);

  useEffect(() => {
    onPressZoneRef.current = onPressZone;
  }, [onPressZone]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mapStyle = (() => {
      const pmtilesSourceUrl = toPmtilesSourceUrl(PMTILES_URL);
      if (pmtilesSourceUrl) {
        return getMapStyle(mapColorScheme, pmtilesSourceUrl, MAP_GLYPHS_URL);
      }
      if (FALLBACK_STYLE_URL) {
        return FALLBACK_STYLE_URL;
      }
      return getFallbackMapStyle(mapColorScheme, MAP_GLYPHS_URL);
    })();

    const map = new maplibregl.Map({
      container,
      style: mapStyle as string | StyleSpecification,
      bounds: [ISRAEL_MAP_INTERACTION_BOUNDS.sw, ISRAEL_MAP_INTERACTION_BOUNDS.ne],
      fitBoundsOptions: { padding: 42, duration: 0 },
      maxBounds: [ISRAEL_MAP_INTERACTION_BOUNDS.sw, ISRAEL_MAP_INTERACTION_BOUNDS.ne],
      minZoom: 8,
      maxZoom:
        PMTILES_URL
          ? Number.isFinite(PMTILES_MAX_ZOOM)
            ? PMTILES_MAX_ZOOM + 2
            : 14
          : 16,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
      renderWorldCopies: false,
    });

    mapRef.current = map;

    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      if (!selectionEnabledRef.current) return;

      const features = map.queryRenderedFeatures(event.point, {
        layers: [TOUCH_FILL_LAYER_ID],
      });
      const zoneId = features.find((feature) => {
        const maybeId = feature.properties?.id;
        return typeof maybeId === "string" && maybeId.length > 0;
      })?.properties?.id;

      if (typeof zoneId === "string" && zoneId.length > 0) {
        onPressZoneRef.current(zoneId);
      }
    };

    const handleEnter = () => {
      map.getCanvas().style.cursor = selectionEnabledRef.current
        ? "pointer"
        : "grab";
    };

    const handleLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("load", () => {
      map.addSource(ALL_SOURCE_ID, {
        type: "geojson",
        data: PIKUD_ZONE_GEOJSON,
      });
      map.addSource(AREA_SOURCE_ID, {
        type: "geojson",
        data: PIKUD_AREA_GEOJSON,
      });
      map.addSource(CITY_SOURCE_ID, {
        type: "geojson",
        data: PIKUD_CITY_GEOJSON,
      });
      map.addSource(PREVIEW_SOURCE_ID, {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });
      map.addSource(SELECTED_SOURCE_ID, {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });

      map.addLayer({
        id: AREA_FILL_LAYER_ID,
        type: "fill",
        source: AREA_SOURCE_ID,
        paint: {
          "fill-color": mapPalette.previewFill,
          "fill-opacity": 0,
        },
      });
      map.addLayer({
        id: AREA_OUTLINE_LAYER_ID,
        type: "line",
        source: AREA_SOURCE_ID,
        paint: {
          "line-color": mapPalette.zoneOutline,
          "line-width": 0.9,
          "line-opacity": 0,
        },
      });
      map.addLayer({
        id: AREA_LABEL_LAYER_ID,
        type: "symbol",
        source: AREA_SOURCE_ID,
        minzoom: 8.2,
        layout: {
          "text-field": ["get", labelProperty],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10.1, 11.5, 11, 14.5],
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 7,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": mapTheme.text,
          "text-halo-color": mapPalette.styleBackground,
          "text-halo-width": 1.5,
          "text-opacity": 0,
        },
      });
      map.addLayer({
        id: CITY_OUTLINE_LAYER_ID,
        type: "line",
        source: CITY_SOURCE_ID,
        paint: {
          "line-color": mapPalette.zoneOutline,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.78, 10, 0.48],
          "line-opacity": 0,
        },
      });
      map.addLayer({
        id: CITY_LABEL_LAYER_ID,
        type: "symbol",
        source: CITY_SOURCE_ID,
        layout: {
          "text-field": ["get", cityLabelProperty],
          "text-size": ["interpolate", ["linear"], ["zoom"], 6, 12, 10, 16.5],
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 8,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": mapTheme.text,
          "text-halo-color": mapPalette.styleBackground,
          "text-halo-width": 1.55,
          "text-opacity": 1,
        },
      });

      map.addLayer({
        id: TOUCH_FILL_LAYER_ID,
        type: "fill",
        source: ALL_SOURCE_ID,
        paint: {
          "fill-color": mapTheme.surfaceAlt,
          "fill-opacity": 0,
        },
      });
      map.addLayer({
        id: OUTLINE_LAYER_ID,
        type: "line",
        source: ALL_SOURCE_ID,
        paint: {
          "line-color": mapPalette.zoneOutline,
          "line-width": 0.75,
          "line-opacity": 0,
        },
      });
      map.addLayer({
        id: "zones-all-label",
        type: "symbol",
        source: ALL_SOURCE_ID,
        minzoom: 6.5,
        layout: {
          "text-field": ["get", labelProperty],
          "text-size": ["interpolate", ["linear"], ["zoom"], 6.5, 11, 10.5, 15],
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 7.5,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": mapTheme.text,
          "text-halo-color": mapPalette.styleBackground,
          "text-halo-width": 1.45,
          "text-opacity": 0,
        },
      });

      map.addLayer({
        id: PREVIEW_FILL_LAYER_ID,
        type: "fill",
        source: PREVIEW_SOURCE_ID,
        paint: {
          "fill-color": mapPalette.previewFill,
          "fill-opacity": 0,
        },
      });
      map.addLayer({
        id: PREVIEW_LINE_LAYER_ID,
        type: "line",
        source: PREVIEW_SOURCE_ID,
        paint: {
          "line-color": mapPalette.previewOutline,
          "line-width": 0.85,
          "line-opacity": 0,
        },
      });

      map.addLayer({
        id: SELECTED_FILL_LAYER_ID,
        type: "fill",
        source: SELECTED_SOURCE_ID,
        paint: {
          "fill-color": mapTheme.primary,
          "fill-opacity": 0.24,
        },
      });
      map.addLayer({
        id: SELECTED_LINE_LAYER_ID,
        type: "line",
        source: SELECTED_SOURCE_ID,
        paint: {
          "line-color": mapPalette.selectedOutline,
          "line-width": 1.35,
          "line-opacity": mapPalette.selectedOutlineOpacity,
        },
      });
      map.addLayer({
        id: SELECTED_LABEL_LAYER_ID,
        type: "symbol",
        source: SELECTED_SOURCE_ID,
        layout: {
          "text-field": ["get", labelProperty],
          "text-size": ["interpolate", ["linear"], ["zoom"], 6.5, 11, 10.5, 15.5],
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 8,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": mapTheme.text,
          "text-halo-color": mapPalette.styleBackground,
          "text-halo-width": 1.6,
          "text-opacity": 0,
        },
      });

      map.on("click", handleMapClick);
      map.on("mouseenter", TOUCH_FILL_LAYER_ID, handleEnter);
      map.on("mouseleave", TOUCH_FILL_LAYER_ID, handleLeave);
      setIsStyleLoaded(true);
    });

    return () => {
      map.off("click", handleMapClick);
      map.off("mouseenter", TOUCH_FILL_LAYER_ID, handleEnter);
      map.off("mouseleave", TOUCH_FILL_LAYER_ID, handleLeave);
      map.remove();
      mapRef.current = null;
      setIsStyleLoaded(false);
    };
  }, [
    cityLabelProperty,
    labelProperty,
    mapColorScheme,
    mapPalette.previewFill,
    mapPalette.previewOutline,
    mapPalette.selectedOutline,
    mapPalette.selectedOutlineOpacity,
    mapPalette.styleBackground,
    mapPalette.zoneOutline,
    mapTheme.primary,
    mapTheme.surfaceAlt,
    mapTheme.text,
  ]);

  useEffect(() => {
    if (!isStyleLoaded) return;
    const map = mapRef.current;
    if (!map) return;

    const safeSetPaint = (layerId: string, property: string, value: unknown) => {
      if (!map.getLayer(layerId)) return;
      map.setPaintProperty(layerId, property, value);
    };

    safeSetPaint(
      AREA_FILL_LAYER_ID,
      "fill-opacity",
      selectionEnabled
        ? ["interpolate", ["linear"], ["zoom"], 8.2, 0.02, 10.2, 0.07]
        : 0,
    );
    safeSetPaint(
      AREA_OUTLINE_LAYER_ID,
      "line-opacity",
      selectionEnabled
        ? ["interpolate", ["linear"], ["zoom"], 8.2, 0.08, 10.2, 0.2]
        : 0,
    );
    safeSetPaint(
      AREA_LABEL_LAYER_ID,
      "text-opacity",
      selectionEnabled ? ZONE_LABEL_OPACITY : 0,
    );
    safeSetPaint(
      CITY_OUTLINE_LAYER_ID,
      "line-opacity",
      selectionEnabled ? CITY_OUTLINE_OPACITY : 0,
    );
    safeSetPaint(
      CITY_LABEL_LAYER_ID,
      "text-opacity",
      selectionEnabled ? CITY_LABEL_OPACITY : 0,
    );
    safeSetPaint(
      TOUCH_FILL_LAYER_ID,
      "fill-opacity",
      selectionEnabled
        ? ["interpolate", ["linear"], ["zoom"], 8.2, 0.015, 10.2, 0.035]
        : 0,
    );
    safeSetPaint(
      OUTLINE_LAYER_ID,
      "line-opacity",
      selectionEnabled
        ? ["interpolate", ["linear"], ["zoom"], 8.2, 0.14, 10.2, 0.3]
        : 0,
    );
    safeSetPaint(
      "zones-all-label",
      "text-opacity",
      selectionEnabled ? 0.82 : 0,
    );
    safeSetPaint(
      PREVIEW_FILL_LAYER_ID,
      "fill-opacity",
      selectionEnabled
        ? [
            "interpolate",
            ["linear"],
            ["zoom"],
            8.2,
            mapPalette.previewFillOpacity * 0.45,
            10.2,
            mapPalette.previewFillOpacity,
          ]
        : 0,
    );
    safeSetPaint(
      PREVIEW_LINE_LAYER_ID,
      "line-opacity",
      selectionEnabled
        ? [
            "interpolate",
            ["linear"],
            ["zoom"],
            8.2,
            mapPalette.previewOutlineOpacity * 0.5,
            10.2,
            mapPalette.previewOutlineOpacity,
          ]
        : 0,
    );
    safeSetPaint(
      SELECTED_FILL_LAYER_ID,
      "fill-opacity",
      selectionEnabled
        ? ["interpolate", ["linear"], ["zoom"], 8.2, 0.24, 10.2, 0.34]
        : 0.24,
    );
    safeSetPaint(
      SELECTED_LINE_LAYER_ID,
      "line-width",
      selectionEnabled
        ? ["interpolate", ["linear"], ["zoom"], 8.2, 1.2, 10.2, 1.6]
        : 1.35,
    );
    safeSetPaint(
      SELECTED_LABEL_LAYER_ID,
      "text-opacity",
      selectionEnabled ? 0.96 : 0,
    );
  }, [
    isStyleLoaded,
    mapPalette.previewFillOpacity,
    mapPalette.previewOutlineOpacity,
    selectionEnabled,
  ]);

  useEffect(() => {
    if (!isStyleLoaded) return;
    const map = mapRef.current;
    if (!map) return;

    const previewSource = map.getSource(PREVIEW_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    const selectedSource = map.getSource(SELECTED_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    if (previewSource) {
      previewSource.setData(previewFeatures);
    }
    if (selectedSource) {
      selectedSource.setData(selectedFeatures);
    }
  }, [isStyleLoaded, previewFeatures, selectedFeatures]);

  useEffect(() => {
    if (!isStyleLoaded || !focusZoneId) return;
    const map = mapRef.current;
    if (!map) return;

    const zone = getZoneIndexEntry(focusZoneId);
    if (!zone) return;

    map.fitBounds(
      [
        [zone.bbox[0], zone.bbox[1]],
        [zone.bbox[2], zone.bbox[3]],
      ],
      {
        padding: 46,
        duration: 520,
      },
    );
  }, [focusZoneId, isStyleLoaded]);

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: palette.border,
          backgroundColor: palette.surface,
          minHeight,
        },
      ]}
    >
      <div ref={containerRef} style={webMapStyle} />
    </View>
  );
}

const webMapStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: 320,
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    overflow: "hidden",
    flex: 1,
  },
});
