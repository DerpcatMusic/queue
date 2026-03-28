import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map as MapLibreMap,
} from "@maplibre/maplibre-react-native";
import Constants from "expo-constants";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { buildCustomMapStyle } from "@/components/maps/queue-custom-map-style";
import { APPLE_MAP_THEME } from "@/components/maps/queue-map-apple-theme";
import { QueueMapZonePolygons } from "@/components/maps/queue-map-zone-polygons";
import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing, getMapBrandPalette } from "@/constants/brand";
import { getZoneIndexEntry, ISRAEL_MAP_INTERACTION_BOUNDS } from "@/constants/zones-map";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { ActionButton } from "../ui/action-button";
import { IconSymbol } from "../ui/icon-symbol";
import { KitSurface } from "../ui/kit";
import {
  type AnyStyleSpec,
  createPinShape,
  createStudioMarkersGeoJson,
  createZoneFilter,
  ensureVectorOfflinePack,
  getStudioMarkerImageEntries,
  sanitizeZoom,
  toBounds,
} from "./queue-map.native.helpers";
import type { QueueMapProps } from "./queue-map.types";

type MapLoadState = "loading" | "ready" | "error";
const MAP_LOADING_OVERLAY_DELAY_MS = 180;

export const QueueMap = memo(function QueueMap({
  mode,
  pin,
  selectedZoneIds,
  focusZoneId,
  isEditing = mode === "zoneSelect",
  zoneGeoJson,
  zoneIdProperty = "id",
  studios,
  onPressStudio,
  onPressZone,
  onPressMap,
  onUseGps,
  showGpsButton = true,
  showAttributionButton = true,
  contentInset,
  cameraPadding,
}: QueueMapProps) {
  const { t } = useTranslation();
  const { resolvedScheme } = useThemePreference();
  const { color } = useTheme();
  const mapPalette = getMapBrandPalette(resolvedScheme);
  const [mapLoadState, setMapLoadState] = useState<MapLoadState>("loading");
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [mapErrorMessage, setMapErrorMessage] = useState<string | null>(null);

  // Self-contained custom map style — no network fetch required.
  // Regenerates whenever the scheme changes (light/dark).
  const customMapStyle = useMemo<AnyStyleSpec>(() => buildCustomMapStyle(mapPalette), [mapPalette]);
  const mapStyle = customMapStyle;
  const mapKey = resolvedScheme;

  const mapRef = useRef<{
    showAttribution?: () => void;
  } | null>(null);
  const mapLoadStateRef = useRef<MapLoadState>("loading");
  const cameraRef = useRef<{
    fitBounds: (
      bounds: [number, number, number, number],
      options?: {
        padding?: { top: number; right: number; bottom: number; left: number };
        duration?: number;
        easing?: string;
      },
    ) => void;
    flyTo: (coordinates: [number, number], animationDuration?: number) => void;
    zoomTo: (zoomLevel: number, animationDuration?: number) => void;
  } | null>(null);
  const selectedZoneFilter = useMemo(
    () => createZoneFilter(selectedZoneIds, zoneIdProperty),
    [selectedZoneIds, zoneIdProperty],
  );
  const pinShape = useMemo(() => createPinShape(pin), [pin]);
  const studioMarkersGeoJSON = useMemo(
    () => createStudioMarkersGeoJson(studios ?? [], "logo"),
    [studios],
  );
  const studioImageEntries = useMemo(() => getStudioMarkerImageEntries(studios ?? []), [studios]);
  const handleMapPress = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      const features = event?.nativeEvent?.features ?? [];
      const firstFeature = features[0];
      // Studio marker tapped — navigate to studio profile
      if (firstFeature?.properties?.studioId) {
        onPressStudio?.(firstFeature.properties.studioId);
        return;
      }
      // Pin-drop mode: record dropped pin coordinate
      if (mode !== "pinDrop") return;
      if (!onPressMap) return;
      const native = event?.nativeEvent ?? event;
      const coordinates = native?.lngLat as [number, number] | undefined;
      if (!coordinates) return;
      onPressMap({ latitude: coordinates[1], longitude: coordinates[0] });
    },
    [mode, onPressMap, onPressStudio],
  );

  const updateMapLoadState = useCallback(
    (nextState: MapLoadState, errorMessage?: string | null) => {
      const nextError = errorMessage ?? null;
      if (mapLoadStateRef.current === nextState) {
        if (nextState === "error") {
          setMapErrorMessage((current) => (current === nextError ? current : nextError));
        } else if (nextError === null) {
          setMapErrorMessage((current) => (current === null ? current : null));
        }
        return;
      }
      mapLoadStateRef.current = nextState;
      setMapLoadState(nextState);
      setMapErrorMessage(nextError);
    },
    [],
  );

  // Stable event handlers — extracted to avoid inline arrow recreation on every render
  const handleWillStartLoadingMap = useCallback(() => {
    updateMapLoadState("loading");
  }, [updateMapLoadState]);

  const handleDidFinishLoadingMap = useCallback(() => {
    updateMapLoadState("ready");
  }, [updateMapLoadState]);

  const handleDidFailLoadingMap = useCallback(() => {
    updateMapLoadState("error", t("mapTab.native.unavailableBody"));
  }, [updateMapLoadState, t]);

  useEffect(() => {
    if (mapLoadState !== "loading") {
      setShowLoadingOverlay(false);
      return;
    }

    const timeout = setTimeout(() => {
      setShowLoadingOverlay(true);
    }, MAP_LOADING_OVERLAY_DELAY_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [mapLoadState]);

  useEffect(() => {
    if (mapLoadState !== "ready") return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const scheduleBootstrap = () => {
      if (typeof globalThis.requestIdleCallback === "function") {
        idleId = globalThis.requestIdleCallback(() => {
          if (cancelled) return;
          void ensureVectorOfflinePack().catch(() => {});
        });
        return;
      }

      timeoutId = setTimeout(() => {
        if (cancelled) return;
        void ensureVectorOfflinePack().catch(() => {});
      }, 40);
    };

    timeoutId = setTimeout(scheduleBootstrap, 16);

    return () => {
      cancelled = true;
      if (idleId !== null && typeof globalThis.cancelIdleCallback === "function") {
        globalThis.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [mapLoadState]);

  useEffect(() => {
    if (!focusZoneId) return;
    const zone = getZoneIndexEntry(focusZoneId);
    if (!zone) return;

    const padding = cameraPadding ?? {
      top: APPLE_MAP_THEME.focusPadding.top,
      right: APPLE_MAP_THEME.focusPadding.right,
      bottom: APPLE_MAP_THEME.focusPadding.bottom,
      left: APPLE_MAP_THEME.focusPadding.left,
    };

    // MapLibre uses fitBounds([west, south, east, north]) — zone.bbox is [west, south, east, north]
    cameraRef.current?.fitBounds([zone.bbox[0], zone.bbox[1], zone.bbox[2], zone.bbox[3]], {
      padding,
      duration: 350,
      easing: "ease",
    });
  }, [cameraPadding, focusZoneId]);

  useEffect(() => {
    if (!pin) return;
    cameraRef.current?.flyTo([pin.longitude, pin.latitude], 800);
    cameraRef.current?.zoomTo(APPLE_MAP_THEME.defaultZoomWithPin, 800);
  }, [pin]);

  if (Constants.appOwnership === "expo") {
    return (
      <KitSurface
        tone="base"
        style={[
          styles.fallback,
          {
            backgroundColor: color.surfaceAlt,
            borderRadius: BrandRadius.soft,
            borderCurve: "continuous",
            margin: BrandSpacing.inset,
          },
        ]}
      >
        <ThemedText type="defaultSemiBold">{t("mapTab.devBuildRequiredTitle")}</ThemedText>
        <ThemedText style={{ color: color.textMuted }}>
          {t("mapTab.devBuildRequiredBody")}
        </ThemedText>
      </KitSurface>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: mapPalette.styleBackground }]}>
      <MapLibreMap
        ref={mapRef as any}
        key={mapKey}
        style={styles.map}
        mapStyle={mapStyle as any}
        {...(contentInset ? { contentInset } : {})}
        dragPan
        touchAndDoubleTapZoom
        touchRotate={false}
        touchPitch={false}
        compass={false}
        logo={false}
        attribution={false}
        onWillStartLoadingMap={handleWillStartLoadingMap}
        onDidFinishLoadingMap={handleDidFinishLoadingMap}
        onDidFailLoadingMap={handleDidFailLoadingMap}
        onPress={handleMapPress as any}
      >
        <Camera
          ref={cameraRef as any}
          maxBounds={toBounds(ISRAEL_MAP_INTERACTION_BOUNDS.sw, ISRAEL_MAP_INTERACTION_BOUNDS.ne)}
          minZoom={sanitizeZoom(APPLE_MAP_THEME.minZoom, 7.5)}
          maxZoom={sanitizeZoom(APPLE_MAP_THEME.maxZoom, 16)}
          initialViewState={{
            center: pin ? [pin.longitude, pin.latitude] : APPLE_MAP_THEME.defaultCenter,
            zoom: pin ? APPLE_MAP_THEME.defaultZoomWithPin : APPLE_MAP_THEME.defaultZoomWithoutPin,
          }}
        />

        <QueueMapZonePolygons
          mode={mode}
          isEditing={isEditing}
          showLabelLayers={mode !== "zoneSelect" || isEditing}
          selectedZoneFilter={selectedZoneFilter}
          zoneGeoJson={zoneGeoJson}
          zoneIdProperty={zoneIdProperty}
          mapPalette={mapPalette}
          onPressZone={onPressZone}
        />

        <GeoJSONSource id="queue-pin-source" data={pinShape}>
          <Layer
            id="queue-pin-dot"
            type="circle"
            paint={{
              "circle-radius": APPLE_MAP_THEME.overlay.pinRadius,
              "circle-color": mapPalette.primary,
              "circle-stroke-color": mapPalette.text,
              "circle-stroke-width": APPLE_MAP_THEME.overlay.pinStrokeWidth,
            }}
          />
        </GeoJSONSource>

        {Object.keys(studioImageEntries).length > 0 ? (
          <>
            <Images images={studioImageEntries} />
            <GeoJSONSource id="studio-markers" data={studioMarkersGeoJSON}>
              <Layer
                id="studio-markers-symbol"
                type="symbol"
                layout={{
                  "icon-image": ["case", ["get", "hasImage"], ["get", "imageKey"], ""],
                  "icon-size": 0.3,
                  "icon-anchor": "bottom",
                  "icon-allow-overlap": true,
                  "icon-offset": [0, -12],
                }}
                paint={{
                  "icon-opacity": 1,
                }}
              />
            </GeoJSONSource>
          </>
        ) : null}
      </MapLibreMap>

      {mapLoadState === "loading" && showLoadingOverlay ? (
        <View
          style={[
            styles.stateOverlay,
            {
              backgroundColor: color.appBg,
            },
          ]}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: color.surfaceElevated,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: color.borderStrong,
            }}
          >
            <ActivityIndicator color={color.primary} />
          </View>
        </View>
      ) : null}

      {mapLoadState === "error" ? (
        <View
          style={[
            styles.stateOverlay,
            {
              backgroundColor: color.appBg,
            },
          ]}
        >
          <KitSurface
            tone="sheet"
            style={[
              styles.stateCard,
              {
                backgroundColor: color.surface,
                borderColor: color.border,
              },
            ]}
          >
            <ThemedText type="cardTitle">{t("mapTab.native.unavailableTitle")}</ThemedText>
            <ThemedText type="meta" style={{ color: color.textMuted }}>
              {mapErrorMessage ?? t("mapTab.native.unavailableBody")}
            </ThemedText>
            <ActionButton
              label={t("tabsLayout.actions.retry")}
              onPress={() => updateMapLoadState("loading")}
              tone="secondary"
            />
          </KitSurface>
        </View>
      ) : null}

      {showGpsButton && onUseGps ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("mapTab.actions.useCurrentLocation")}
          onPress={onUseGps}
          style={({ pressed }) => [
            styles.gps,
            {
              width: 58,
              height: 58,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.2,
              borderRadius: BrandRadius.button,
              borderCurve: "continuous",
              backgroundColor: pressed ? color.surfaceAlt : color.surface,
              borderColor: color.borderStrong,
              overflow: "hidden",
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <IconSymbol name="location.fill" size={20} color={color.text} />
        </Pressable>
      ) : null}

      {showAttributionButton ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("mapTab.native.openAttribution")}
          onPress={() => {
            mapRef.current?.showAttribution?.();
          }}
          style={({ pressed }) => [
            styles.attributionButton,
            {
              backgroundColor: pressed ? color.surfaceAlt : color.surfaceElevated,
              borderColor: color.borderStrong,
              borderWidth: 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <IconSymbol name="info.circle.fill" size={15} color={color.text} />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  map: { flex: 1 },
  gps: {
    position: "absolute",
    right: BrandSpacing.lg,
    bottom: BrandSpacing.lg,
  },
  attributionButton: {
    position: "absolute",
    left: BrandSpacing.lg,
    bottom: BrandSpacing.lg,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: BrandSpacing.stackDense,
    paddingHorizontal: BrandSpacing.inset,
    paddingVertical: BrandSpacing.lg,
  },
  stateOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: BrandSpacing.inset,
  },
  stateCard: {
    width: "100%",
    maxWidth: BrandSpacing.shellPanel,
    alignItems: "center",
    gap: BrandSpacing.stackDense,
    paddingHorizontal: BrandSpacing.inset,
    paddingVertical: BrandSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
