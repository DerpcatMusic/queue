import type { Feature } from "geojson";
import { Asset } from "expo-asset";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { configureMapLibreLogging } from "@/components/maps/configure-maplibre-logging";
import { resolveMapLibreRuntime } from "@/components/maps/maplibre-runtime";
import { ThemedText } from "@/components/themed-text";
import { getMapBrandPalette } from "@/constants/brand";
import {
  getFallbackMapStyle,
  getMapStyle,
  toPmtilesSourceUrl,
} from "@/constants/map-style";
import {
  getZoneIdsForCity,
  getZoneIndexEntry,
  ISRAEL_MAP_INTERACTION_BOUNDS,
  PIKUD_CITY_GEOJSON,
  PIKUD_ZONE_GEOJSON,
} from "@/constants/zones-map";
import { useThemePreference } from "@/hooks/use-theme-preference";
import type { InstructorZonesMapProps } from "./instructor-zones-map.types";

const PMTILES_URL = process.env.EXPO_PUBLIC_PM_TILES_URL?.trim() ?? "";
const FALLBACK_STYLE_URL = process.env.EXPO_PUBLIC_BASEMAP_STYLE_URL?.trim() ?? "";
const PMTILES_MAX_ZOOM = Number.parseFloat(
  process.env.EXPO_PUBLIC_PM_TILES_MAX_ZOOM ?? "12",
);

const PREVIEW_LIMIT = 20;
const CITY_SELECTION_MAX_ZOOM = 10.8;
const MAX_SELECTED_LABEL_COUNT = 12;
const MAP_GLYPHS_URL =
  "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BUNDLED_PM_TILES_MODULE = require("../../../assets/maps/israel-z11.pmtiles");

configureMapLibreLogging();

type Expression = unknown;
type MapPressEvent = {
  features: { properties?: { id?: unknown } }[];
};

function createCoalescedLabelExpression(
  primaryField: string,
  fallbackField: string,
): Expression {
  return ["coalesce", ["get", primaryField], ["get", fallbackField]];
}

const NO_MATCH_ZONE_FILTER: Expression = ["==", ["get", "id"], "__none__"];

function createZoneIdFilter(zoneIds: readonly string[]): Expression {
  if (zoneIds.length === 0) return NO_MATCH_ZONE_FILTER;
  return ["in", ["get", "id"], ["literal", zoneIds as string[]]] as unknown as Expression;
}

function InstructorZonesMapInner({
  zoneMode,
  selectedZoneIds,
  previewZoneIds,
  focusZoneId,
  onPressZone,
  onPressCity,
  onSelectionLevelChange,
  onZoomLevelChange,
  userLocation,
}: InstructorZonesMapProps) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<{ setCamera: (config: unknown) => void } | null>(null);
  const { resolvedScheme, stylePreference } = useThemePreference();
  const mapPalette = getMapBrandPalette(stylePreference, resolvedScheme);
  const mapLibreRuntime = useMemo(() => resolveMapLibreRuntime(), []);
  const MapViewComponent = mapLibreRuntime?.MapView as ComponentType<any> | undefined;
  const CameraComponent = mapLibreRuntime?.Camera as ComponentType<any> | undefined;
  const ShapeSourceComponent = mapLibreRuntime?.ShapeSource as ComponentType<any> | undefined;
  const FillLayerComponent = mapLibreRuntime?.FillLayer as ComponentType<any> | undefined;
  const LineLayerComponent = mapLibreRuntime?.LineLayer as ComponentType<any> | undefined;
  const SymbolLayerComponent = mapLibreRuntime?.SymbolLayer as ComponentType<any> | undefined;
  const CircleLayerComponent = mapLibreRuntime?.CircleLayer as ComponentType<any> | undefined;
  const isMapRuntimeReady =
    typeof MapViewComponent === "function" &&
    typeof CameraComponent === "function" &&
    typeof ShapeSourceComponent === "function" &&
    typeof FillLayerComponent === "function" &&
    typeof LineLayerComponent === "function" &&
    typeof SymbolLayerComponent === "function" &&
    typeof CircleLayerComponent === "function";

  const cityLabelField =
    i18n.dir(i18n.resolvedLanguage) === "rtl"
      ? createCoalescedLabelExpression("cityHeb", "cityEng")
      : createCoalescedLabelExpression("cityEng", "cityHeb");
  const selectedZoneLabelField =
    i18n.dir(i18n.resolvedLanguage) === "rtl"
      ? createCoalescedLabelExpression("hebName", "cityHeb")
      : createCoalescedLabelExpression("engName", "cityEng");

  const [bundledPmtilesUrl, setBundledPmtilesUrl] = useState("");
  const [selectionLevel, setSelectionLevel] = useState<"city" | "zone">("city");
  const zoneModeRef = useRef(zoneMode);
  const selectionLevelRef = useRef(selectionLevel);
  const onSelectionLevelChangeRef = useRef(onSelectionLevelChange);
  const onZoomLevelChangeRef = useRef(onZoomLevelChange);

  useEffect(() => {
    zoneModeRef.current = zoneMode;
  }, [zoneMode]);

  useEffect(() => {
    selectionLevelRef.current = selectionLevel;
  }, [selectionLevel]);

  useEffect(() => {
    onSelectionLevelChangeRef.current = onSelectionLevelChange;
  }, [onSelectionLevelChange]);

  useEffect(() => {
    onZoomLevelChangeRef.current = onZoomLevelChange;
  }, [onZoomLevelChange]);

  useEffect(() => {
    if (!zoneMode && selectionLevel !== "zone") {
      setSelectionLevel("zone");
      onSelectionLevelChange?.("zone");
    }
  }, [onSelectionLevelChange, selectionLevel, zoneMode]);

  useEffect(() => {
    let isMounted = true;
    void Asset.loadAsync(BUNDLED_PM_TILES_MODULE)
      .then((assets) => {
        const asset = assets[0];
        if (!isMounted || !asset) return;
        const uri = asset.localUri ?? asset.uri ?? "";
        setBundledPmtilesUrl(uri);
      })
      .catch(() => {
        if (isMounted) {
          setBundledPmtilesUrl("");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const pmtilesInputUrl = PMTILES_URL || bundledPmtilesUrl;

  const mapStyle = useMemo(() => {
    const pmtilesSourceUrl = toPmtilesSourceUrl(pmtilesInputUrl);
    if (pmtilesSourceUrl) {
      return getMapStyle(resolvedScheme, pmtilesSourceUrl, MAP_GLYPHS_URL);
    }

    if (FALLBACK_STYLE_URL) {
      return FALLBACK_STYLE_URL;
    }

    return getFallbackMapStyle(resolvedScheme, MAP_GLYPHS_URL);
  }, [pmtilesInputUrl, resolvedScheme]);

  const effectiveMaxZoomLevel = pmtilesInputUrl
    ? (Number.isFinite(PMTILES_MAX_ZOOM) ? PMTILES_MAX_ZOOM : 12) + 2
    : 16;

  const previewZoneIdsForMap = useMemo(
    () => previewZoneIds.slice(0, PREVIEW_LIMIT),
    [previewZoneIds],
  );
  const selectedZoneIdSet = useMemo(
    () => new Set(selectedZoneIds),
    [selectedZoneIds],
  );
  const previewZoneIdsFiltered = useMemo(() => {
    if (previewZoneIdsForMap.length === 0) return previewZoneIdsForMap;
    return previewZoneIdsForMap.filter((zoneId) => !selectedZoneIdSet.has(zoneId));
  }, [previewZoneIdsForMap, selectedZoneIdSet]);
  const selectedZoneFilter = useMemo(
    () => createZoneIdFilter(selectedZoneIds),
    [selectedZoneIds],
  );
  const previewZoneFilter = useMemo(
    () => createZoneIdFilter(previewZoneIdsFiltered),
    [previewZoneIdsFiltered],
  );

  const showGlobalZoneLabels =
    zoneMode &&
    selectionLevel === "zone" &&
    selectedZoneIds.length === 0;
  const showSelectedZoneLabels =
    zoneMode &&
    selectedZoneIds.length > 0 &&
    selectedZoneIds.length <= MAX_SELECTED_LABEL_COUNT;

  const userLocationShape = useMemo(() => {
    if (!userLocation) return null;
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [userLocation.longitude, userLocation.latitude],
      },
      properties: {},
    } as Feature;
  }, [userLocation]);

  useEffect(() => {
    if (!focusZoneId) return;
    const zone = getZoneIndexEntry(focusZoneId);
    if (!zone) return;

    cameraRef.current?.setCamera({
      bounds: {
        ne: [zone.bbox[2], zone.bbox[3]],
        sw: [zone.bbox[0], zone.bbox[1]],
        paddingTop: 70,
        paddingRight: 45,
        paddingBottom: 70,
        paddingLeft: 45,
      },
      animationDuration: 520,
      animationMode: "easeTo",
    });
  }, [focusZoneId]);

  const baseZoneOutlineOpacity = useMemo(
    () =>
      zoneMode
        ? ([
            "interpolate",
            ["linear"],
            ["zoom"],
            8.2,
            0.14,
            10.2,
            0.3,
          ] as Expression)
        : 0,
    [zoneMode],
  );
  const cityOutlineStyle = useMemo(
    () => ({
      lineColor: mapPalette.zoneOutline,
      lineWidth: ["interpolate", ["linear"], ["zoom"], 7, 0.78, 10, 0.48] as Expression,
      lineOpacity: zoneMode
        ? (["interpolate", ["linear"], ["zoom"], 8, 0.16, 9.6, 0] as Expression)
        : 0,
      lineJoin: "round" as const,
    }),
    [mapPalette.zoneOutline, zoneMode],
  );
  const cityLabelStyle = useMemo(
    () => ({
      textField: cityLabelField,
      textSize: ["interpolate", ["linear"], ["zoom"], 6, 12, 10, 16.5] as Expression,
      textFont: ["Noto Sans Regular"],
      textColor: mapPalette.text,
      textHaloColor: mapPalette.styleBackground,
      textHaloWidth: 1.55,
      textAllowOverlap: false,
      textIgnorePlacement: false,
      textMaxWidth: 8,
      textOpacity: zoneMode
        ? ([
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
          ] as Expression)
        : ([
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
          ] as Expression),
    }),
    [cityLabelField, mapPalette.styleBackground, mapPalette.text, zoneMode],
  );
  const cityTouchFillStyle = useMemo(
    () => ({
      fillColor: mapPalette.surfaceAlt,
      fillOpacity: zoneMode && selectionLevel === "city" ? 0.03 : 0,
    }),
    [mapPalette.surfaceAlt, selectionLevel, zoneMode],
  );
  const userLocationPinStyle = useMemo(
    () => ({
      iconImage: "pin",
      iconSize: 1,
      iconAllowOverlap: true,
      iconIgnorePlacement: true,
    }),
    [],
  );
  const userLocationDotStyle = useMemo(
    () => ({
      circleRadius: ["interpolate", ["linear"], ["zoom"], 8, 4, 12, 8] as Expression,
      circleColor: mapPalette.primary,
      circleStrokeWidth: 2,
      circleStrokeColor: mapPalette.styleBackground,
      circleOpacity: 1,
    }),
    [mapPalette.primary, mapPalette.styleBackground],
  );
  const zoneTouchFillStyle = useMemo(
    () => ({
      fillColor: mapPalette.surfaceAlt,
      fillOpacity: zoneMode && selectionLevel === "zone"
        ? ([
            "interpolate",
            ["linear"],
            ["zoom"],
            8.2,
            0.015,
            10.2,
            0.035,
          ] as Expression)
        : 0,
    }),
    [mapPalette.surfaceAlt, selectionLevel, zoneMode],
  );
  const zoneOutlineStyle = useMemo(
    () => ({
      lineColor: mapPalette.zoneOutline,
      lineWidth: 0.75,
      lineOpacity: selectionLevel === "zone" ? baseZoneOutlineOpacity : 0,
      lineJoin: "round" as const,
    }),
    [baseZoneOutlineOpacity, mapPalette.zoneOutline, selectionLevel],
  );
  const zoneLabelStyle = useMemo(
    () => ({
      textField: selectedZoneLabelField,
      textSize: ["interpolate", ["linear"], ["zoom"], 6.5, 11, 10.5, 15] as Expression,
      textFont: ["Noto Sans Regular"],
      textColor: mapPalette.text,
      textHaloColor: mapPalette.styleBackground,
      textHaloWidth: 1.45,
      textAllowOverlap: false,
      textMaxWidth: 7.5,
      textOpacity: showGlobalZoneLabels
        ? ([
            "interpolate",
            ["linear"],
            ["zoom"],
            11.6,
            0,
            12.8,
            0.4,
          ] as Expression)
        : 0,
    }),
    [
      mapPalette.styleBackground,
      mapPalette.text,
      selectedZoneLabelField,
      showGlobalZoneLabels,
    ],
  );
  const previewFillStyle = useMemo(
    () => ({
      fillColor: mapPalette.previewFill,
      fillOpacity: zoneMode
        ? ([
            "interpolate",
            ["linear"],
            ["zoom"],
            8.2,
            mapPalette.previewFillOpacity * 0.45,
            10.2,
            mapPalette.previewFillOpacity,
          ] as Expression)
        : 0,
    }),
    [mapPalette.previewFill, mapPalette.previewFillOpacity, zoneMode],
  );
  const previewOutlineStyle = useMemo(
    () => ({
      lineColor: mapPalette.previewOutline,
      lineWidth: 0.85,
      lineOpacity: zoneMode
        ? ([
            "interpolate",
            ["linear"],
            ["zoom"],
            8.2,
            mapPalette.previewOutlineOpacity * 0.5,
            10.2,
            mapPalette.previewOutlineOpacity,
          ] as Expression)
        : 0,
      lineJoin: "round" as const,
    }),
    [mapPalette.previewOutline, mapPalette.previewOutlineOpacity, zoneMode],
  );
  const selectedFillStyle = useMemo(
    () => ({
      fillColor: mapPalette.primary,
      fillOpacity: zoneMode
        ? ([
            "interpolate",
            ["linear"],
            ["zoom"],
            8.2,
            0.24,
            10.2,
            0.34,
          ] as Expression)
        : 0.24,
    }),
    [mapPalette.primary, zoneMode],
  );
  const selectedOutlineStyle = useMemo(
    () => ({
      lineColor: mapPalette.selectedOutline,
      lineWidth: zoneMode
        ? ([
            "interpolate",
            ["linear"],
            ["zoom"],
            8.2,
            1.2,
            10.2,
            1.6,
          ] as Expression)
        : 1.35,
      lineOpacity: mapPalette.selectedOutlineOpacity,
      lineJoin: "round" as const,
    }),
    [mapPalette.selectedOutline, mapPalette.selectedOutlineOpacity, zoneMode],
  );
  const selectedLabelStyle = useMemo(
    () => ({
      textField: selectedZoneLabelField,
      textSize: ["interpolate", ["linear"], ["zoom"], 6.5, 11, 10.5, 15.5] as Expression,
      textFont: ["Noto Sans Regular"],
      textColor: mapPalette.text,
      textHaloColor: mapPalette.styleBackground,
      textHaloWidth: 1.6,
      textAllowOverlap: true,
      textIgnorePlacement: true,
      textOpacity: showSelectedZoneLabels
        ? ([
            "interpolate",
            ["linear"],
            ["zoom"],
            10.8,
            0.74,
            12.4,
            0.94,
          ] as Expression)
        : 0,
      textMaxWidth: 8,
    }),
    [
      mapPalette.styleBackground,
      mapPalette.text,
      selectedZoneLabelField,
      showSelectedZoneLabels,
    ],
  );

  const handlePressZone = useCallback((event: MapPressEvent) => {
    if (!zoneModeRef.current) return;
    if (selectionLevelRef.current !== "zone") return;

    const pressedFeature = event.features.find((feature) => {
      const maybeId = feature.properties?.id;
      return typeof maybeId === "string" && maybeId.length > 0;
    });
    const zoneId = pressedFeature?.properties?.id;
    if (typeof zoneId !== "string" || zoneId.length === 0) return;

    onPressZone(zoneId);
  }, [onPressZone]);

  const handlePressCity = useCallback((event: MapPressEvent) => {
    if (!zoneModeRef.current) return;
    if (selectionLevelRef.current !== "city") return;
    if (!onPressCity) return;

    const cityKey = event.features.find((feature) => {
      const maybeId = feature.properties?.id;
      return typeof maybeId === "string" && maybeId.length > 0;
    })?.properties?.id;

    if (typeof cityKey !== "string" || cityKey.length === 0) return;

    const zoneIds = getZoneIdsForCity(cityKey);
    if (zoneIds.length > 0) {
      onPressCity(zoneIds);
    }
  }, [onPressCity]);

  const handleRegionDidChange = useCallback((event: {
    properties?: { zoomLevel?: number };
    nativeEvent?: { properties?: { zoomLevel?: number } };
  }) => {
    const zoomLevel =
      event.nativeEvent?.properties?.zoomLevel ?? event.properties?.zoomLevel;
    if (typeof zoomLevel === "number" && !Number.isNaN(zoomLevel)) {
      onZoomLevelChangeRef.current?.(zoomLevel);
    }

    if (!zoneModeRef.current) {
      if (selectionLevelRef.current !== "zone") {
        setSelectionLevel("zone");
        onSelectionLevelChangeRef.current?.("zone");
      }
      return;
    }
    if (typeof zoomLevel !== "number" || Number.isNaN(zoomLevel)) return;

    const nextLevel = zoomLevel <= CITY_SELECTION_MAX_ZOOM ? "city" : "zone";
    if (nextLevel === selectionLevelRef.current) return;
    setSelectionLevel(nextLevel);
    onSelectionLevelChangeRef.current?.(nextLevel);
  }, []);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: mapPalette.surfaceAlt },
      ]}
    >
      {isMapRuntimeReady ? (
        <MapViewComponent
          style={styles.map}
          mapStyle={mapStyle}
          scrollEnabled
          zoomEnabled
          rotateEnabled={false}
          pitchEnabled={false}
          compassEnabled={false}
          attributionEnabled={false}
          logoEnabled={false}
          surfaceView={Platform.OS === "android"}
          onRegionDidChange={handleRegionDidChange}
        >
          <CameraComponent
            ref={cameraRef}
            maxBounds={ISRAEL_MAP_INTERACTION_BOUNDS}
            minZoomLevel={8}
            maxZoomLevel={effectiveMaxZoomLevel}
            defaultSettings={{
              bounds: {
                ne: ISRAEL_MAP_INTERACTION_BOUNDS.ne,
                sw: ISRAEL_MAP_INTERACTION_BOUNDS.sw,
                paddingTop: Math.max(insets.top, 16),
                paddingRight: 36,
                paddingBottom: 48,
                paddingLeft: 36,
              },
            }}
          />

          <ShapeSourceComponent
            id="instructor-city-source"
            shape={PIKUD_CITY_GEOJSON}
            onPress={handlePressCity}
          >
            <LineLayerComponent
              id="instructor-city-outline"
              style={cityOutlineStyle}
            />
            <SymbolLayerComponent
              id="instructor-city-labels"
              style={cityLabelStyle}
            />
            <FillLayerComponent
              id="instructor-city-touch-fill"
              style={cityTouchFillStyle}
            />
          </ShapeSourceComponent>

          {userLocation && userLocationShape && (
            <ShapeSourceComponent id="user-location-source" shape={userLocationShape}>
              <SymbolLayerComponent
                id="user-location-pin"
                style={userLocationPinStyle}
              />
              <CircleLayerComponent
                id="user-location-dot"
                style={userLocationDotStyle}
              />
            </ShapeSourceComponent>
          )}

          <ShapeSourceComponent
            id="instructor-zone-all-source"
            shape={PIKUD_ZONE_GEOJSON}
            onPress={handlePressZone}
          >
            <FillLayerComponent
              id="instructor-zone-touch-fill"
              style={zoneTouchFillStyle}
            />
            <LineLayerComponent
              id="instructor-zone-outline"
              style={zoneOutlineStyle}
            />
            <SymbolLayerComponent
              id="instructor-zone-labels"
              style={zoneLabelStyle}
            />

            <FillLayerComponent
              id="instructor-zone-preview-fill"
              filter={previewZoneFilter}
              style={previewFillStyle}
            />
            <LineLayerComponent
              id="instructor-zone-preview-outline"
              filter={previewZoneFilter}
              style={previewOutlineStyle}
            />

            <FillLayerComponent
              id="instructor-zone-selected-fill"
              filter={selectedZoneFilter}
              style={selectedFillStyle}
            />
            <LineLayerComponent
              id="instructor-zone-selected-outline"
              filter={selectedZoneFilter}
              style={selectedOutlineStyle}
            />
            <SymbolLayerComponent
              id="instructor-zone-selected-labels"
              filter={selectedZoneFilter}
              style={selectedLabelStyle}
            />
          </ShapeSourceComponent>
        </MapViewComponent>
      ) : (
        <View style={styles.fallback}>
          <ThemedText type="defaultSemiBold">Map runtime unavailable.</ThemedText>
          <ThemedText type="caption">Rebuild and relaunch the dev client.</ThemedText>
        </View>
      )}
    </View>
  );
}

export const InstructorZonesMap = memo(InstructorZonesMapInner);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  map: {
    flex: 1,
  },
});
