import { BrandRadius, getMapBrandPalette } from "@/constants/brand";
import {
  getFallbackMapStyle,
  getMapStyle,
  toPmtilesSourceUrl,
} from "@/constants/map-style";
import {
  buildCityFeatureCollectionFromZoneIds,
  buildZoneFeatureCollection,
  getZoneIndexEntry,
  getZoneIdsForCity,
  ISRAEL_MAP_INTERACTION_BOUNDS,
  PIKUD_AREA_GEOJSON,
  PIKUD_CITY_GEOJSON,
  PIKUD_ZONE_GEOJSON,
} from "@/constants/zones-map";
import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import type { FeatureCollection } from "geojson";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { useThemePreference } from "@/hooks/use-theme-preference";

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
  onPressCity?: (zoneIds: string[]) => void;
  onSelectionLevelChange?: (level: "city" | "zone") => void;
  onZoomLevelChange?: (zoomLevel: number) => void;
  selectionEnabled: boolean;
  minHeight: number;
  userLocation?: { latitude: number; longitude: number } | null | undefined;
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
const CITY_TOUCH_LAYER_ID = "zones-city-touch-fill";
const TOUCH_FILL_LAYER_ID = "zones-touch-fill";
const OUTLINE_LAYER_ID = "zones-outline";
const ALL_LABEL_LAYER_ID = "zones-all-label";
const PREVIEW_FILL_LAYER_ID = "zones-preview-fill";
const PREVIEW_LINE_LAYER_ID = "zones-preview-line";
const SELECTED_FILL_LAYER_ID = "zones-selected-fill";
const SELECTED_LINE_LAYER_ID = "zones-selected-line";
const SELECTED_LABEL_LAYER_ID = "zones-selected-label";
const USER_LOCATION_SOURCE_ID = "user-location-source";
const USER_LOCATION_DOT_LAYER_ID = "user-location-dot";

const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const ZONE_LABEL_OPACITY = ["interpolate", ["linear"], ["zoom"], 8.2, 0.4, 10.2, 0.92];
const CITY_LABEL_OPACITY = [
  "interpolate",
  ["linear"],
  ["zoom"],
  8,
  0.2,
  9.1,
  0.96,
  11.5,
  0.86,
  13,
  0.35,
];
const CITY_LABEL_OPACITY_NON_SELECTION = [
  "interpolate",
  ["linear"],
  ["zoom"],
  8.2,
  0,
  9.2,
  0.88,
  11.8,
  0.76,
  13,
  0.3,
];
const CITY_OUTLINE_OPACITY = ["interpolate", ["linear"], ["zoom"], 8, 0.16, 9.6, 0];
const CITY_SELECTION_MAX_ZOOM = 10.8;

export function ZonesMapWebBase({
  selectedZoneIds,
  previewZoneIds,
  focusZoneId,
  onPressZone,
  onPressCity,
  onSelectionLevelChange,
  onZoomLevelChange,
  selectionEnabled,
  minHeight,
  userLocation,
}: ZonesMapWebBaseProps) {
  const { i18n } = useTranslation();
  const { resolvedScheme, stylePreference } = useThemePreference();
  const mapPalette = getMapBrandPalette(stylePreference, resolvedScheme);
  const labelProperty =
    i18n.dir(i18n.resolvedLanguage) === "rtl" ? "hebName" : "engName";
  const cityLabelProperty = labelProperty === "hebName" ? "cityHeb" : "cityEng";
  const selectionLabelField = useMemo(
    () =>
      [
        "coalesce",
        ["get", labelProperty],
        ["get", cityLabelProperty],
      ] as unknown as string,
    [cityLabelProperty, labelProperty],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const selectionEnabledRef = useRef(selectionEnabled);
  const selectionLevelRef = useRef<"city" | "zone">("city");
  const onPressZoneRef = useRef(onPressZone);
  const onPressCityRef = useRef(onPressCity);
  const onSelectionLevelChangeRef = useRef(onSelectionLevelChange);
  const onZoomLevelChangeRef = useRef(onZoomLevelChange);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [selectionLevel, setSelectionLevel] = useState<"city" | "zone">("city");
  const updateSelectionLevel = useCallback((nextLevel: "city" | "zone") => {
    if (selectionLevelRef.current === nextLevel) return;
    selectionLevelRef.current = nextLevel;
    setSelectionLevel(nextLevel);
    onSelectionLevelChangeRef.current?.(nextLevel);
  }, []);

  const selectedFeatures = useMemo(() => {
    if (selectionLevel === "city") {
      return buildCityFeatureCollectionFromZoneIds(selectedZoneIds);
    }
    return buildZoneFeatureCollection(selectedZoneIds);
  }, [selectedZoneIds, selectionLevel]);
  const previewFeatures = useMemo(() => {
    const previewIds = previewZoneIds.slice(0, 20);
    if (selectionLevel === "city") {
      return buildCityFeatureCollectionFromZoneIds(previewIds);
    }
    return buildZoneFeatureCollection(previewIds);
  }, [previewZoneIds, selectionLevel]);

  const userLocationFeature = useMemo(() => {
    if (!userLocation) return EMPTY_FEATURE_COLLECTION;
    return {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [userLocation.longitude, userLocation.latitude],
        },
        properties: {},
      }],
    } as FeatureCollection;
  }, [userLocation]);

  useEffect(() => {
    selectionEnabledRef.current = selectionEnabled;
    if (!selectionEnabled) {
      updateSelectionLevel("zone");
    }
  }, [selectionEnabled, updateSelectionLevel]);

  useEffect(() => {
    onPressZoneRef.current = onPressZone;
  }, [onPressZone]);

  useEffect(() => {
    onPressCityRef.current = onPressCity;
  }, [onPressCity]);

  useEffect(() => {
    onSelectionLevelChangeRef.current = onSelectionLevelChange;
  }, [onSelectionLevelChange]);

  useEffect(() => {
    onZoomLevelChangeRef.current = onZoomLevelChange;
  }, [onZoomLevelChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mapStyle = (() => {
      const pmtilesSourceUrl = toPmtilesSourceUrl(PMTILES_URL);
      if (pmtilesSourceUrl) {
        return getMapStyle(resolvedScheme, pmtilesSourceUrl, MAP_GLYPHS_URL);
      }
      if (FALLBACK_STYLE_URL) {
        return FALLBACK_STYLE_URL;
      }
      return getFallbackMapStyle(resolvedScheme, MAP_GLYPHS_URL);
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

      if (selectionLevelRef.current === "city") {
        const cityFeatures = map.queryRenderedFeatures(event.point, {
          layers: [CITY_TOUCH_LAYER_ID],
        });
        const cityKey = cityFeatures.find((feature) => {
          const maybeId = feature.properties?.id;
          return typeof maybeId === "string" && maybeId.length > 0;
        })?.properties?.id;

        if (typeof cityKey === "string" && cityKey.length > 0) {
          const zoneIds = getZoneIdsForCity(cityKey);
          if (zoneIds.length > 0 && onPressCityRef.current) {
            onPressCityRef.current(zoneIds);
            return;
          }
        }
      }

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

    const handleMoveEnd = () => {
      onZoomLevelChangeRef.current?.(map.getZoom());

      if (!selectionEnabledRef.current) {
        updateSelectionLevel("zone");
        return;
      }

      const nextLevel = map.getZoom() <= CITY_SELECTION_MAX_ZOOM ? "city" : "zone";
      updateSelectionLevel(nextLevel);
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
      map.addSource(USER_LOCATION_SOURCE_ID, {
        type: "geojson",
        data: userLocationFeature,
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
          "text-color": mapPalette.text,
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
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": mapPalette.text,
          "text-halo-color": mapPalette.styleBackground,
          "text-halo-width": 1.55,
          "text-opacity": 1,
        },
      });
      map.addLayer({
        id: CITY_TOUCH_LAYER_ID,
        type: "fill",
        source: CITY_SOURCE_ID,
        paint: {
          "fill-color": mapPalette.surfaceAlt,
          "fill-opacity": 0,
        },
      });

      map.addLayer({
        id: TOUCH_FILL_LAYER_ID,
        type: "fill",
        source: ALL_SOURCE_ID,
        paint: {
          "fill-color": mapPalette.surfaceAlt,
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
        id: ALL_LABEL_LAYER_ID,
        type: "symbol",
        source: ALL_SOURCE_ID,
        minzoom: 6.5,
        layout: {
          "text-field": selectionLabelField,
          "text-size": ["interpolate", ["linear"], ["zoom"], 6.5, 11, 10.5, 15],
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 7.5,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": mapPalette.text,
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
          "fill-color": mapPalette.primary,
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
          "text-field": selectionLabelField,
          "text-size": ["interpolate", ["linear"], ["zoom"], 6.5, 11, 10.5, 15.5],
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 8,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": mapPalette.text,
          "text-halo-color": mapPalette.styleBackground,
          "text-halo-width": 1.6,
          "text-opacity": 0,
        },
      });

      map.addLayer({
        id: USER_LOCATION_DOT_LAYER_ID,
        type: "circle",
        source: USER_LOCATION_SOURCE_ID,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 12, 8],
          "circle-color": mapPalette.primary,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FFFFFF",
          "circle-opacity": 1,
        },
      });

      map.on("click", handleMapClick);
      map.on("mouseenter", TOUCH_FILL_LAYER_ID, handleEnter);
      map.on("mouseleave", TOUCH_FILL_LAYER_ID, handleLeave);
      map.on("moveend", handleMoveEnd);
      handleMoveEnd();
      setIsStyleLoaded(true);
    });

    return () => {
      map.off("click", handleMapClick);
      map.off("mouseenter", TOUCH_FILL_LAYER_ID, handleEnter);
      map.off("mouseleave", TOUCH_FILL_LAYER_ID, handleLeave);
      map.off("moveend", handleMoveEnd);
      map.remove();
      mapRef.current = null;
      setIsStyleLoaded(false);
    };
  }, [
    cityLabelProperty,
    labelProperty,
    selectionLabelField,
    mapPalette.previewFill,
    mapPalette.previewOutline,
    mapPalette.selectedOutline,
    mapPalette.selectedOutlineOpacity,
    mapPalette.styleBackground,
    mapPalette.zoneOutline,
    mapPalette.primary,
    mapPalette.surfaceAlt,
    mapPalette.text,
    resolvedScheme,
    userLocationFeature,
    updateSelectionLevel,
  ]);

  // Handle basemap theme switch separately to avoid full map rebuild
  useEffect(() => {
    if (!isStyleLoaded) return;
    const map = mapRef.current;
    if (!map) return;

    const newStyle = (() => {
      const pmtilesSourceUrl = toPmtilesSourceUrl(PMTILES_URL);
      if (pmtilesSourceUrl) {
        return getMapStyle(resolvedScheme, pmtilesSourceUrl, MAP_GLYPHS_URL);
      }
      if (FALLBACK_STYLE_URL) {
        return FALLBACK_STYLE_URL;
      }
      return getFallbackMapStyle(resolvedScheme, MAP_GLYPHS_URL);
    })();

    map.setStyle(newStyle as string | StyleSpecification);
  }, [isStyleLoaded, resolvedScheme]);

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
      selectionEnabled ? CITY_LABEL_OPACITY : CITY_LABEL_OPACITY_NON_SELECTION,
    );
    safeSetPaint(
      CITY_TOUCH_LAYER_ID,
      "fill-opacity",
      selectionEnabled && selectionLevel === "city" ? 0.03 : 0,
    );
    safeSetPaint(
      TOUCH_FILL_LAYER_ID,
      "fill-opacity",
      selectionEnabled && selectionLevel === "zone"
        ? ["interpolate", ["linear"], ["zoom"], 8.2, 0.015, 10.2, 0.035]
        : 0,
    );
    safeSetPaint(
      OUTLINE_LAYER_ID,
      "line-opacity",
      selectionEnabled && selectionLevel === "zone"
        ? ["interpolate", ["linear"], ["zoom"], 8.2, 0.14, 10.2, 0.3]
        : 0,
    );
    safeSetPaint(
      ALL_LABEL_LAYER_ID,
      "text-opacity",
      selectionEnabled && selectionLevel === "zone" ? 0.82 : 0,
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
            (mapPalette.previewFillOpacity) * 0.45,
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
            (mapPalette.previewOutlineOpacity) * 0.5,
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

    // Update colors on theme change
    safeSetPaint(AREA_FILL_LAYER_ID, "fill-color", mapPalette.previewFill);
    safeSetPaint(AREA_OUTLINE_LAYER_ID, "line-color", mapPalette.zoneOutline);
    safeSetPaint(AREA_LABEL_LAYER_ID, "text-color", mapPalette.text);
    safeSetPaint(AREA_LABEL_LAYER_ID, "text-halo-color", mapPalette.styleBackground);
    safeSetPaint(CITY_OUTLINE_LAYER_ID, "line-color", mapPalette.zoneOutline);
    safeSetPaint(CITY_LABEL_LAYER_ID, "text-color", mapPalette.text);
    safeSetPaint(CITY_LABEL_LAYER_ID, "text-halo-color", mapPalette.styleBackground);
    safeSetPaint(CITY_TOUCH_LAYER_ID, "fill-color", mapPalette.surfaceAlt);
    safeSetPaint(TOUCH_FILL_LAYER_ID, "fill-color", mapPalette.surfaceAlt);
    safeSetPaint(OUTLINE_LAYER_ID, "line-color", mapPalette.zoneOutline);
    safeSetPaint(ALL_LABEL_LAYER_ID, "text-color", mapPalette.text);
    safeSetPaint(ALL_LABEL_LAYER_ID, "text-halo-color", mapPalette.styleBackground);
    safeSetPaint(PREVIEW_FILL_LAYER_ID, "fill-color", mapPalette.previewFill);
    safeSetPaint(PREVIEW_LINE_LAYER_ID, "line-color", mapPalette.previewOutline);
    safeSetPaint(SELECTED_FILL_LAYER_ID, "fill-color", mapPalette.primary);
    safeSetPaint(SELECTED_LINE_LAYER_ID, "line-color", mapPalette.selectedOutline);
    safeSetPaint(SELECTED_LABEL_LAYER_ID, "text-color", mapPalette.text);
    safeSetPaint(SELECTED_LABEL_LAYER_ID, "text-halo-color", mapPalette.styleBackground);
    safeSetPaint(USER_LOCATION_DOT_LAYER_ID, "circle-color", mapPalette.primary);
  }, [
    isStyleLoaded,
    mapPalette,
    selectionLevel,
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

    const userLocationSource = map.getSource(USER_LOCATION_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    if (userLocationSource) {
      userLocationSource.setData(userLocationFeature);
    }
  }, [isStyleLoaded, previewFeatures, selectedFeatures, userLocationFeature]);

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
          borderColor: mapPalette.zoneOutline,
          backgroundColor: mapPalette.surfaceAlt,
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
