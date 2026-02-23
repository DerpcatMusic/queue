import Constants from "expo-constants";
import { Asset } from "expo-asset";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitFab, KitSurface } from "@/components/ui/kit";
import { getMapBrandPalette } from "@/constants/brand";
import {
  getFallbackMapStyle,
  getMapStyle,
  toPmtilesSourceUrl,
} from "@/constants/map-style";
import { useBrand } from "@/hooks/use-brand";
import {
  buildZoneFeatureCollection,
  ISRAEL_MAP_INTERACTION_BOUNDS,
  PIKUD_AREA_GEOJSON,
  PIKUD_ZONE_GEOJSON,
} from "@/constants/zones-map";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { resolveMapLibreRuntime } from "@/components/maps/maplibre-runtime";
import { InstructorZonesMap } from "./instructor-zones-map";
import type { OnboardingLocationMapProps } from "./onboarding-location-map.types";

const PMTILES_URL = process.env.EXPO_PUBLIC_PM_TILES_URL?.trim() ?? "";
const FALLBACK_STYLE_URL = process.env.EXPO_PUBLIC_BASEMAP_STYLE_URL?.trim() ?? "";
const PMTILES_MAX_ZOOM = Number.parseFloat(
  process.env.EXPO_PUBLIC_PM_TILES_MAX_ZOOM ?? "12",
);
const MAP_GLYPHS_URL =
  "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BUNDLED_PM_TILES_MODULE = require("../../../assets/maps/israel-z11.pmtiles");

type MapComponents = {
  CameraComponent: ComponentType<any>;
  CircleLayerComponent: ComponentType<any>;
  FillLayerComponent: ComponentType<any>;
  LineLayerComponent: ComponentType<any>;
  MapViewComponent: ComponentType<any>;
  ShapeSourceComponent: ComponentType<any>;
};

export function OnboardingLocationMap({
  mode,
  pin,
  selectedZoneIds,
  previewZoneIds,
  focusZoneId,
  onPressMap,
  onPressZone,
  onUseGps,
}: OnboardingLocationMapProps) {

  const palette = useBrand();
  const mapLibreRuntime = useMemo(() => resolveMapLibreRuntime(), []);
  const MapViewComponent = mapLibreRuntime?.MapView as ComponentType<any> | undefined;
  const CameraComponent = mapLibreRuntime?.Camera as ComponentType<any> | undefined;
  const ShapeSourceComponent = mapLibreRuntime?.ShapeSource as ComponentType<any> | undefined;
  const FillLayerComponent = mapLibreRuntime?.FillLayer as ComponentType<any> | undefined;
  const LineLayerComponent = mapLibreRuntime?.LineLayer as ComponentType<any> | undefined;
  const CircleLayerComponent = mapLibreRuntime?.CircleLayer as ComponentType<any> | undefined;
  const isMapRuntimeReady =
    typeof MapViewComponent === "function" &&
    typeof CameraComponent === "function" &&
    typeof ShapeSourceComponent === "function" &&
    typeof FillLayerComponent === "function" &&
    typeof LineLayerComponent === "function" &&
    typeof CircleLayerComponent === "function";
  const mapComponents = useMemo<MapComponents | null>(() => {
    if (
      !MapViewComponent ||
      !CameraComponent ||
      !ShapeSourceComponent ||
      !FillLayerComponent ||
      !LineLayerComponent ||
      !CircleLayerComponent
    ) {
      return null;
    }
    return {
      MapViewComponent,
      CameraComponent,
      ShapeSourceComponent,
      FillLayerComponent,
      LineLayerComponent,
      CircleLayerComponent,
    };
  }, [
    CameraComponent,
    CircleLayerComponent,
    FillLayerComponent,
    LineLayerComponent,
    MapViewComponent,
    ShapeSourceComponent,
  ]);

  if (Constants.appOwnership === "expo") {
    return (
      <KitSurface tone="elevated" style={styles.expoFallback}>
        <ThemedText type="defaultSemiBold">Native map requires a development build.</ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          Run `bunx expo run:android` and relaunch your dev client.
        </ThemedText>
        <KitFab
          icon={<IconSymbol name="location.fill" size={22} color={palette.text} />}
          onPress={onUseGps}
        />
      </KitSurface>
    );
  }

  if (!isMapRuntimeReady) {
    return (
      <KitSurface tone="elevated" style={styles.expoFallback}>
        <ThemedText type="defaultSemiBold">Map runtime unavailable.</ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          Rebuild and relaunch your dev client.
        </ThemedText>
      </KitSurface>
    );
  }

  if (mode === "instructorZone") {
    return (
      <View style={styles.wrap}>
        <InstructorZonesMap
          zoneMode
          selectedZoneIds={selectedZoneIds}
          previewZoneIds={previewZoneIds}
          focusZoneId={focusZoneId}
          onPressZone={onPressZone}
        />
        <KitFab
          icon={<IconSymbol name="location.fill" size={22} color={palette.text} />}
          onPress={onUseGps}
          style={styles.gpsFab}
        />
      </View>
    );
  }

  return (
    <StudioPinMap
      mapComponents={mapComponents}
      pin={pin}
      selectedZoneIds={selectedZoneIds}
      onPressMap={onPressMap}
      onUseGps={onUseGps}
    />
  );
}

type StudioPinMapProps = {
  mapComponents: MapComponents | null;
  pin: OnboardingLocationMapProps["pin"];
  selectedZoneIds: string[];
  onPressMap: OnboardingLocationMapProps["onPressMap"];
  onUseGps: OnboardingLocationMapProps["onUseGps"];
};

function StudioPinMap({
  mapComponents,
  pin,
  selectedZoneIds,
  onPressMap,
  onUseGps,
}: StudioPinMapProps) {
  const { resolvedScheme, stylePreference } = useThemePreference();
  const mapPalette = getMapBrandPalette(stylePreference, resolvedScheme);
  const [bundledPmtilesUrl, setBundledPmtilesUrl] = useState("");
  const mapReady = mapComponents !== null;
  const MapViewComponent = mapComponents?.MapViewComponent;
  const CameraComponent = mapComponents?.CameraComponent;
  const ShapeSourceComponent = mapComponents?.ShapeSourceComponent;
  const FillLayerComponent = mapComponents?.FillLayerComponent;
  const LineLayerComponent = mapComponents?.LineLayerComponent;
  const CircleLayerComponent = mapComponents?.CircleLayerComponent;

  useEffect(() => {
    let active = true;
    void Asset.loadAsync(BUNDLED_PM_TILES_MODULE)
      .then((assets) => {
        const asset = assets[0];
        if (!active || !asset) return;
        const uri = asset.localUri ?? asset.uri ?? "";
        setBundledPmtilesUrl(uri);
      })
      .catch(() => {
        if (active) {
          setBundledPmtilesUrl("");
        }
      });

    return () => {
      active = false;
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

  const selectedZonesShape = useMemo(
    () => buildZoneFeatureCollection(selectedZoneIds),
    [selectedZoneIds],
  );

  const pinShape = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!pin) {
      return { type: "FeatureCollection", features: [] };
    }

    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [pin.longitude, pin.latitude],
          },
        },
      ],
    };
  }, [pin]);

  const defaultCenter = pin
    ? ({ latitude: pin.latitude, longitude: pin.longitude } as const)
    : ({ latitude: 31.5, longitude: 34.85 } as const);

  const handleMapPress = (event: {
    geometry?: { type?: string; coordinates?: unknown };
    features?: { geometry?: { type?: string; coordinates?: unknown } }[];
  }) => {
    const geometry = event.geometry ?? event.features?.[0]?.geometry;
    if (!geometry || geometry.type !== "Point") {
      return;
    }

    const coordinates = geometry.coordinates as [number, number] | undefined;
    if (!coordinates || coordinates.length < 2) return;
    onPressMap({
      latitude: coordinates[1],
      longitude: coordinates[0],
    });
  };

  return (
    <View style={styles.wrap}>
      {mapReady &&
      MapViewComponent &&
      CameraComponent &&
      ShapeSourceComponent &&
      FillLayerComponent &&
      LineLayerComponent &&
      CircleLayerComponent ? (
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
          onPress={handleMapPress}
        >
          <CameraComponent
            maxBounds={ISRAEL_MAP_INTERACTION_BOUNDS}
            minZoomLevel={8}
            maxZoomLevel={effectiveMaxZoomLevel}
            defaultSettings={{
              centerCoordinate: [defaultCenter.longitude, defaultCenter.latitude],
              zoomLevel: pin ? 11.5 : 9.2,
            }}
          />

          <ShapeSourceComponent id="onboarding-zone-all-source" shape={PIKUD_ZONE_GEOJSON}>
            <LineLayerComponent
              id="onboarding-zone-outline"
              style={{
                lineColor: mapPalette.zoneOutline,
                lineWidth: 0.8,
                lineOpacity: 0.28,
                lineJoin: "round",
              }}
            />
          </ShapeSourceComponent>

          <ShapeSourceComponent id="onboarding-area-source" shape={PIKUD_AREA_GEOJSON}>
            <FillLayerComponent
              id="onboarding-area-fill"
              style={{
                fillColor: mapPalette.previewFill,
                fillOpacity: 0.08,
              }}
            />
          </ShapeSourceComponent>

          <ShapeSourceComponent id="onboarding-zone-selected-source" shape={selectedZonesShape}>
            <FillLayerComponent
              id="onboarding-zone-selected-fill"
              style={{
                fillColor: mapPalette.primary,
                fillOpacity: 0.28,
              }}
            />
            <LineLayerComponent
              id="onboarding-zone-selected-outline"
              style={{
                lineColor: mapPalette.selectedOutline,
                lineWidth: 1.2,
                lineOpacity: mapPalette.selectedOutlineOpacity,
                lineJoin: "round",
              }}
            />
          </ShapeSourceComponent>

          <ShapeSourceComponent id="onboarding-pin-source" shape={pinShape}>
            <CircleLayerComponent
              id="onboarding-pin-dot"
              style={{
                circleRadius: 6,
                circleColor: mapPalette.primary,
                circleStrokeColor: mapPalette.text,
                circleStrokeWidth: 2,
              }}
            />
            <CircleLayerComponent
              id="onboarding-pin-ring"
              style={{
                circleRadius: 17,
                circleColor: mapPalette.primary,
                circleOpacity: 0.16,
              }}
            />
          </ShapeSourceComponent>
        </MapViewComponent>
      ) : (
        <KitSurface tone="elevated" style={styles.expoFallback}>
          <ThemedText type="defaultSemiBold">Map runtime unavailable.</ThemedText>
          <ThemedText style={{ color: mapPalette.text }}>
            Rebuild and relaunch your dev client.
          </ThemedText>
        </KitSurface>
      )}

      <KitFab
        icon={<IconSymbol name="location.fill" size={22} color={mapPalette.text} />}
        onPress={onUseGps}
        style={styles.gpsFab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 320,
  },
  map: {
    flex: 1,
  },
  gpsFab: {
    position: "absolute",
    right: 12,
    bottom: 12,
  },
  expoFallback: {
    minHeight: 240,
    justifyContent: "center",
    gap: 12,
  },
});

