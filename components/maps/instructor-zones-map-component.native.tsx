import {
  Camera,
  type CameraRef,
  type Expression,
  FillLayer,
  LineLayer,
  MapView,
  ShapeSource,
  SymbolLayer,
  type OnPressEvent,
} from "@maplibre/maplibre-react-native";
import { Asset } from "expo-asset";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { configureMapLibreLogging } from "@/components/maps/configure-maplibre-logging";
import { Brand } from "@/constants/brand";
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
import type { InstructorZonesMapProps } from "./instructor-zones-map.types";

const PMTILES_URL = process.env.EXPO_PUBLIC_PM_TILES_URL?.trim() ?? "";
const FALLBACK_STYLE_URL = process.env.EXPO_PUBLIC_BASEMAP_STYLE_URL?.trim() ?? "";
const PMTILES_MAX_ZOOM = Number.parseFloat(
  process.env.EXPO_PUBLIC_PM_TILES_MAX_ZOOM ?? "12",
);

const PREVIEW_LIMIT = 20;
const MAP_GLYPHS_URL =
  "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BUNDLED_PM_TILES_MODULE = require("../../assets/maps/israel-z11.pmtiles");

configureMapLibreLogging();

function createCoalescedLabelExpression(
  primaryField: string,
  fallbackField: string,
): Expression {
  return ["coalesce", ["get", primaryField], ["get", fallbackField]];
}

export function InstructorZonesMap({
  zoneMode,
  selectedZoneIds,
  previewZoneIds,
  focusZoneId,
  onPressZone,
}: InstructorZonesMapProps) {
  const { i18n } = useTranslation();
  const cameraRef = useRef<CameraRef>(null);
  const uiColorScheme = useColorScheme() ?? "light";
  const mapColorScheme = uiColorScheme === "dark" ? "dark" : "light";
  const palette = Brand[uiColorScheme];
  const mapPalette = palette.map;
  const areaLabelField =
    i18n.dir(i18n.resolvedLanguage) === "rtl"
      ? createCoalescedLabelExpression("hebName", "engName")
      : createCoalescedLabelExpression("engName", "hebName");
  const cityLabelField =
    i18n.dir(i18n.resolvedLanguage) === "rtl"
      ? createCoalescedLabelExpression("cityHeb", "cityEng")
      : createCoalescedLabelExpression("cityEng", "cityHeb");
  const selectedZoneLabelField =
    i18n.dir(i18n.resolvedLanguage) === "rtl"
      ? createCoalescedLabelExpression("hebName", "engName")
      : createCoalescedLabelExpression("engName", "hebName");

  const [bundledPmtilesUrl, setBundledPmtilesUrl] = useState("");

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
      return getMapStyle(mapColorScheme, pmtilesSourceUrl, MAP_GLYPHS_URL);
    }

    if (FALLBACK_STYLE_URL) {
      return FALLBACK_STYLE_URL;
    }

    return getFallbackMapStyle(mapColorScheme, MAP_GLYPHS_URL);
  }, [mapColorScheme, pmtilesInputUrl]);

  const effectiveMaxZoomLevel = pmtilesInputUrl
    ? (Number.isFinite(PMTILES_MAX_ZOOM) ? PMTILES_MAX_ZOOM : 12) + 2
    : 16;

  const previewZoneIdsForMap = useMemo(
    () => previewZoneIds.slice(0, PREVIEW_LIMIT),
    [previewZoneIds],
  );

  const previewZonesShape = useMemo(
    () => buildZoneFeatureCollection(previewZoneIdsForMap),
    [previewZoneIdsForMap],
  );
  const selectedZonesShape = useMemo(
    () => buildZoneFeatureCollection(selectedZoneIds),
    [selectedZoneIds],
  );

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

  const areaFillOpacity = zoneMode
    ? ([
        "interpolate",
        ["linear"],
        ["zoom"],
        8.2,
        0.02,
        10.2,
        0.07,
      ] as Expression)
    : 0;
  const areaOutlineOpacity = zoneMode
    ? ([
        "interpolate",
        ["linear"],
        ["zoom"],
        8.2,
        0.08,
        10.2,
        0.2,
      ] as Expression)
    : 0;
  const baseZoneOutlineOpacity = zoneMode
    ? ([
        "interpolate",
        ["linear"],
        ["zoom"],
        8.2,
        0.14,
        10.2,
        0.3,
      ] as Expression)
    : 0;

  const handlePressZone = (event: OnPressEvent) => {
    if (!zoneMode) return;

    const pressedFeature = event.features.find((feature) => {
      const maybeId = feature.properties?.id;
      return typeof maybeId === "string" && maybeId.length > 0;
    });
    const zoneId = pressedFeature?.properties?.id;
    if (typeof zoneId !== "string" || zoneId.length === 0) return;

    onPressZone(zoneId);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.surface },
      ]}
    >
      <MapView
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
      >
        <Camera
          ref={cameraRef}
          maxBounds={ISRAEL_MAP_INTERACTION_BOUNDS}
          minZoomLevel={8}
          maxZoomLevel={effectiveMaxZoomLevel}
          defaultSettings={{
            bounds: {
              ne: ISRAEL_MAP_INTERACTION_BOUNDS.ne,
              sw: ISRAEL_MAP_INTERACTION_BOUNDS.sw,
              paddingTop: 44,
              paddingRight: 36,
              paddingBottom: 48,
              paddingLeft: 36,
            },
          }}
        />

        <ShapeSource id="instructor-area-source" shape={PIKUD_AREA_GEOJSON}>
          <FillLayer
            id="instructor-area-fill"
            style={{
              fillColor: mapPalette.previewFill,
              fillOpacity: areaFillOpacity,
            }}
          />
          <LineLayer
            id="instructor-area-outline"
            style={{
              lineColor: mapPalette.zoneOutline,
              lineWidth: 0.9,
              lineOpacity: areaOutlineOpacity,
              lineJoin: "round",
            }}
          />
          <SymbolLayer
            id="instructor-area-labels"
            style={{
              textField: areaLabelField,
              textSize: ["interpolate", ["linear"], ["zoom"], 10.1, 11.5, 11, 14.5],
              textFont: ["Noto Sans Regular"],
              textColor: palette.text,
              textHaloColor: mapPalette.styleBackground,
              textHaloWidth: 1.5,
              textAllowOverlap: false,
              textMaxWidth: 7,
              textOpacity: zoneMode
                ? ["interpolate", ["linear"], ["zoom"], 8.2, 0.4, 10.2, 0.92]
                : 0,
            }}
          />
        </ShapeSource>

        <ShapeSource id="instructor-city-source" shape={PIKUD_CITY_GEOJSON}>
          <LineLayer
            id="instructor-city-outline"
            style={{
              lineColor: mapPalette.zoneOutline,
              lineWidth: ["interpolate", ["linear"], ["zoom"], 7, 0.78, 10, 0.48],
              lineOpacity: zoneMode
                ? ["interpolate", ["linear"], ["zoom"], 8, 0.16, 9.6, 0]
                : 0,
              lineJoin: "round",
            }}
          />
          <SymbolLayer
            id="instructor-city-labels"
            style={{
              textField: cityLabelField,
              textSize: ["interpolate", ["linear"], ["zoom"], 6, 12, 10, 16.5],
              textFont: ["Noto Sans Regular"],
              textColor: palette.text,
              textHaloColor: mapPalette.styleBackground,
              textHaloWidth: 1.55,
              textAllowOverlap: false,
              textMaxWidth: 8,
              textOpacity: zoneMode
                ? ([
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    8,
                    0.58,
                    10.5,
                    0.84,
                    13,
                    0.44,
                  ] as Expression)
                : 0,
            }}
          />
        </ShapeSource>

        <ShapeSource
          id="instructor-zone-all-source"
          shape={PIKUD_ZONE_GEOJSON}
          onPress={handlePressZone}
        >
          <FillLayer
            id="instructor-zone-touch-fill"
            style={{
              fillColor: palette.surfaceAlt,
              fillOpacity: zoneMode
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
            }}
          />
          <LineLayer
            id="instructor-zone-outline"
            style={{
              lineColor: mapPalette.zoneOutline,
              lineWidth: 0.75,
              lineOpacity: baseZoneOutlineOpacity,
              lineJoin: "round",
            }}
          />
          <SymbolLayer
            id="instructor-zone-labels"
            style={{
              textField: selectedZoneLabelField,
              textSize: ["interpolate", ["linear"], ["zoom"], 6.5, 11, 10.5, 15],
              textFont: ["Noto Sans Regular"],
              textColor: palette.text,
              textHaloColor: mapPalette.styleBackground,
              textHaloWidth: 1.45,
              textAllowOverlap: false,
              textMaxWidth: 7.5,
              textOpacity: zoneMode ? 0.82 : 0,
            }}
          />
        </ShapeSource>

        <ShapeSource
          id="instructor-zone-preview-source"
          shape={previewZonesShape}
        >
          <FillLayer
            id="instructor-zone-preview-fill"
            style={{
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
            }}
          />
          <LineLayer
            id="instructor-zone-preview-outline"
            style={{
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
              lineJoin: "round",
            }}
          />
        </ShapeSource>

        <ShapeSource
          id="instructor-zone-selected-source"
          shape={selectedZonesShape}
        >
          <FillLayer
            id="instructor-zone-selected-fill"
            style={{
              fillColor: palette.primary,
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
            }}
          />
          <LineLayer
            id="instructor-zone-selected-outline"
            style={{
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
              lineJoin: "round",
            }}
          />
          <SymbolLayer
            id="instructor-zone-selected-labels"
            style={{
              textField: selectedZoneLabelField,
              textSize: ["interpolate", ["linear"], ["zoom"], 6.5, 11, 10.5, 15.5],
              textFont: ["Noto Sans Regular"],
              textColor: palette.text,
              textHaloColor: mapPalette.styleBackground,
              textHaloWidth: 1.6,
              textAllowOverlap: true,
              textIgnorePlacement: true,
              textOpacity: zoneMode ? 0.96 : 0,
              textMaxWidth: 8,
            }}
          />
        </ShapeSource>
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
