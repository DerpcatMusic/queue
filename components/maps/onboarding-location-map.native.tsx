import {
  Camera,
  CircleLayer,
  FillLayer,
  LineLayer,
  MapView,
  ShapeSource,
} from "@maplibre/maplibre-react-native";
import Constants from "expo-constants";
import { Asset } from "expo-asset";
import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ExpressiveFab, ExpressiveSurface } from "@/components/ui/expressive";
import { Brand } from "@/constants/brand";
import {
  getFallbackMapStyle,
  getMapStyle,
  toPmtilesSourceUrl,
} from "@/constants/map-style";
import {
  buildZoneFeatureCollection,
  ISRAEL_MAP_INTERACTION_BOUNDS,
  PIKUD_AREA_GEOJSON,
  PIKUD_ZONE_GEOJSON,
} from "@/constants/zones-map";
import { useColorScheme } from "@/hooks/use-color-scheme";
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
const BUNDLED_PM_TILES_MODULE = require("../../assets/maps/israel-z11.pmtiles");

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
  const scheme = useColorScheme() ?? "light";
  const palette = Brand[scheme];

  if (Constants.appOwnership === "expo") {
    return (
      <ExpressiveSurface tone="elevated" style={styles.expoFallback}>
        <ThemedText type="defaultSemiBold">Native map requires a development build.</ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          Run `bunx expo run:android` and relaunch your dev client.
        </ThemedText>
        <ExpressiveFab
          icon={<IconSymbol name="location.fill" size={22} color={palette.text} />}
          onPress={onUseGps}
        />
      </ExpressiveSurface>
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
        <ExpressiveFab
          icon={<IconSymbol name="location.fill" size={22} color={palette.text} />}
          onPress={onUseGps}
          style={styles.gpsFab}
        />
      </View>
    );
  }

  return (
    <StudioPinMap
      pin={pin}
      selectedZoneIds={selectedZoneIds}
      onPressMap={onPressMap}
      onUseGps={onUseGps}
    />
  );
}

type StudioPinMapProps = {
  pin: OnboardingLocationMapProps["pin"];
  selectedZoneIds: string[];
  onPressMap: OnboardingLocationMapProps["onPressMap"];
  onUseGps: OnboardingLocationMapProps["onUseGps"];
};

function StudioPinMap({ pin, selectedZoneIds, onPressMap, onUseGps }: StudioPinMapProps) {
  const scheme = useColorScheme() ?? "light";
  const palette = Brand[scheme];
  const mapPalette = palette.map;
  const [bundledPmtilesUrl, setBundledPmtilesUrl] = useState("");

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
      return getMapStyle(scheme === "dark" ? "dark" : "light", pmtilesSourceUrl, MAP_GLYPHS_URL);
    }

    if (FALLBACK_STYLE_URL) {
      return FALLBACK_STYLE_URL;
    }

    return getFallbackMapStyle(scheme === "dark" ? "dark" : "light", MAP_GLYPHS_URL);
  }, [pmtilesInputUrl, scheme]);

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

  const handleMapPress = (feature: GeoJSON.Feature) => {
    if (feature.geometry.type !== "Point") {
      return;
    }

    const coordinates = feature.geometry.coordinates as [number, number];
    onPressMap({
      latitude: coordinates[1],
      longitude: coordinates[0],
    });
  };

  return (
    <View style={styles.wrap}>
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
        onPress={handleMapPress}
      >
        <Camera
          maxBounds={ISRAEL_MAP_INTERACTION_BOUNDS}
          minZoomLevel={8}
          maxZoomLevel={effectiveMaxZoomLevel}
          defaultSettings={{
            centerCoordinate: [defaultCenter.longitude, defaultCenter.latitude],
            zoomLevel: pin ? 11.5 : 9.2,
          }}
        />

        <ShapeSource id="onboarding-zone-all-source" shape={PIKUD_ZONE_GEOJSON}>
          <LineLayer
            id="onboarding-zone-outline"
            style={{
              lineColor: mapPalette.zoneOutline,
              lineWidth: 0.8,
              lineOpacity: 0.28,
              lineJoin: "round",
            }}
          />
        </ShapeSource>

        <ShapeSource id="onboarding-area-source" shape={PIKUD_AREA_GEOJSON}>
          <FillLayer
            id="onboarding-area-fill"
            style={{
              fillColor: mapPalette.previewFill,
              fillOpacity: 0.08,
            }}
          />
        </ShapeSource>

        <ShapeSource id="onboarding-zone-selected-source" shape={selectedZonesShape}>
          <FillLayer
            id="onboarding-zone-selected-fill"
            style={{
              fillColor: palette.primary,
              fillOpacity: 0.28,
            }}
          />
          <LineLayer
            id="onboarding-zone-selected-outline"
            style={{
              lineColor: mapPalette.selectedOutline,
              lineWidth: 1.2,
              lineOpacity: mapPalette.selectedOutlineOpacity,
              lineJoin: "round",
            }}
          />
        </ShapeSource>

        <ShapeSource id="onboarding-pin-source" shape={pinShape}>
          <CircleLayer
            id="onboarding-pin-dot"
            style={{
              circleRadius: 6,
              circleColor: palette.primary,
              circleStrokeColor: palette.onPrimary,
              circleStrokeWidth: 2,
            }}
          />
          <CircleLayer
            id="onboarding-pin-ring"
            style={{
              circleRadius: 17,
              circleColor: palette.primary,
              circleOpacity: 0.16,
            }}
          />
        </ShapeSource>
      </MapView>

      <ExpressiveFab
        icon={<IconSymbol name="location.fill" size={22} color={palette.text} />}
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
