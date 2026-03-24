import {
  Camera,
  GeoJSONSource,
  type GeoJSONSourceRef,
  Images,
  Layer,
  Map as MapLibreMap,
  type MapRef,
} from "@maplibre/maplibre-react-native";
import Constants from "expo-constants";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { APPLE_MAP_THEME } from "@/components/maps/queue-map-apple-theme";
import { QueueMapZonePolygons } from "@/components/maps/queue-map-zone-polygons";
import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing, getMapBrandPalette } from "@/constants/brand";
import { getZoneIndexEntry, ISRAEL_MAP_INTERACTION_BOUNDS } from "@/constants/zones-map";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { ActionButton } from "../ui/action-button";
import { IconSymbol } from "../ui/icon-symbol";
import { KitSurface } from "../ui/kit";
import {
  type AnyStyleSpec,
  createFallbackMapStyle,
  createPinShape,
  createZoneFilter,
  ensureVectorOfflinePack,
  fetchMapStyleSpec,
  getCachedMapStyleSpec,
  resolveThemedMapStyle,
  sanitizeZoom,
  toBounds,
  warmMapStyleSpec,
} from "./queue-map.native.helpers";
import type { QueueMapProps } from "./queue-map.types";

// Map native controls - GPS and attribution buttons
const GPS_BUTTON_SIZE = BrandSpacing.iconContainer + BrandSpacing.lg;
const GPS_ICON_SIZE = BrandSpacing.md + BrandSpacing.xs;
const ATTRIBUTION_SIZE = BrandSpacing.iconContainer - BrandSpacing.xs;
const ATTRIBUTION_ICON_SIZE = BrandSpacing.sm + BrandSpacing.xs;
const LOADING_ICON_SIZE = BrandSpacing.iconContainer + BrandSpacing.sm;
const LOADING_ICON_RADIUS = LOADING_ICON_SIZE / 2;
const STUDIO_MARKER_MIN_ZOOM = 11.35;
const STUDIO_CLUSTER_MAX_ZOOM = 13;
const STUDIO_PIN_ICON_KEY_PREFIX = "studio-pin:";
const STUDIO_PIN_LABEL_MIN_ZOOM = 14;
const STUDIO_PIN_SHELL_IMAGE = require("../../../assets/images/map/studio-pin-shell-sdf.png");

type MapLoadState = "loading" | "ready" | "error";
const MAP_LOADING_OVERLAY_DELAY_MS = 180;

export const QueueMap = memo(function QueueMap({
  mode,
  pin,
  studios = [],
  selectedZoneIds,
  focusZoneId,
  isEditing = mode === "zoneSelect",
  zoneGeoJson,
  zoneIdProperty = "id",
  onPressZone,
  onPressMap,
  onPressStudio,
  onUseGps,
  showGpsButton = true,
  showAttributionButton = true,
  contentInset,
  cameraPadding,
}: QueueMapProps) {
  const { t } = useTranslation();
  const palette = useBrand();
  const { resolvedScheme } = useThemePreference();
  const mapPalette = getMapBrandPalette(resolvedScheme);
  const [mapLoadState, setMapLoadState] = useState<MapLoadState>("loading");
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [mapErrorMessage, setMapErrorMessage] = useState<string | null>(null);
  const [baseMapStyle, setBaseMapStyle] = useState<AnyStyleSpec | null>(null);
  const [showLabelLayers, setShowLabelLayers] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(
    pin ? APPLE_MAP_THEME.defaultZoomWithPin : APPLE_MAP_THEME.defaultZoomWithoutPin,
  );
  const preferredStyleUrl =
    resolvedScheme === "dark" ? APPLE_MAP_THEME.mapStyleDarkUrl : APPLE_MAP_THEME.mapStyleLightUrl;
  const styleFetchUrl =
    retryNonce === 0
      ? preferredStyleUrl
      : `${preferredStyleUrl}${preferredStyleUrl.includes("?") ? "&" : "?"}queueRetry=${String(retryNonce)}`;
  const alternateStyleUrl =
    resolvedScheme === "dark" ? APPLE_MAP_THEME.mapStyleLightUrl : APPLE_MAP_THEME.mapStyleDarkUrl;
  const themedStyleCacheKey = `${styleFetchUrl}:${resolvedScheme}:${mode === "zoneSelect" ? "edit" : "browse"}`;
  const themedMapStyle = useMemo(() => {
    return resolveThemedMapStyle(
      themedStyleCacheKey,
      baseMapStyle,
      mapPalette,
      mode !== "zoneSelect",
    );
  }, [baseMapStyle, mapPalette, mode, themedStyleCacheKey]);
  const fallbackMapStyle = useMemo(() => createFallbackMapStyle(mapPalette), [mapPalette]);
  const mapStyle = themedMapStyle ?? fallbackMapStyle;
  const mapKey = `${resolvedScheme}:${retryNonce}`;

  const mapRef = useRef<MapRef | null>(null);
  const studioSourceRef = useRef<GeoJSONSourceRef | null>(null);
  const mapLoadStateRef = useRef<MapLoadState>("loading");
  const cameraRef = useRef<{
    setStop: (config: unknown) => void;
    flyTo: (options: { center: [number, number]; zoom?: number; duration?: number }) => void;
  } | null>(null);
  const selectedZoneFilter = useMemo(
    () => createZoneFilter(selectedZoneIds, zoneIdProperty),
    [selectedZoneIds, zoneIdProperty],
  );
  const pinShape = useMemo(() => createPinShape(pin), [pin]);
  const showStudioMarkers = studios.length > 0 && currentZoom >= STUDIO_MARKER_MIN_ZOOM;
  const studioMarkerImages = useMemo(
    () => ({
      [`${STUDIO_PIN_ICON_KEY_PREFIX}shell`]: { source: STUDIO_PIN_SHELL_IMAGE, sdf: true },
    }),
    [],
  );
  const studioMarkerSource = useMemo(
    () => ({
      type: "FeatureCollection",
      features: studios.map((studio) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [studio.longitude, studio.latitude],
        },
        properties: {
          studioId: studio.studioId,
          studioName: studio.studioName,
          iconKey: `${STUDIO_PIN_ICON_KEY_PREFIX}shell`,
          ...(studio.mapMarkerColor ? { markerColor: studio.mapMarkerColor } : {}),
        },
      })),
    }),
    [studios],
  );
  const handleRetry = useCallback(() => {
    setBaseMapStyle(null);
    setMapErrorMessage(null);
    setMapLoadState("loading");
    mapLoadStateRef.current = "loading";
    setShowLoadingOverlay(false);
    setRetryNonce((current) => current + 1);
  }, []);
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
    if (mapLoadState !== "ready") {
      setShowLabelLayers(false);
      return;
    }

    const timeout = setTimeout(() => {
      setShowLabelLayers(true);
    }, 180);

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
    warmMapStyleSpec(styleFetchUrl);
    warmMapStyleSpec(alternateStyleUrl);
  }, [alternateStyleUrl, styleFetchUrl]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cachedStyle = getCachedMapStyleSpec(styleFetchUrl);
      if (!cancelled && cachedStyle !== undefined) {
        setBaseMapStyle((current) => (current === cachedStyle ? current : cachedStyle));
        return;
      }

      const baseStyle = await fetchMapStyleSpec(styleFetchUrl);
      if (!cancelled) {
        setBaseMapStyle((current) => (current === baseStyle ? current : baseStyle));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [styleFetchUrl]);

  useEffect(() => {
    if (!focusZoneId) return;
    const zone = getZoneIndexEntry(focusZoneId);
    if (!zone) return;

    cameraRef.current?.setStop({
      bounds: [zone.bbox[0], zone.bbox[1], zone.bbox[2], zone.bbox[3]],
      padding: cameraPadding ?? {
        top: APPLE_MAP_THEME.focusPadding.top,
        right: APPLE_MAP_THEME.focusPadding.right,
        bottom: APPLE_MAP_THEME.focusPadding.bottom,
        left: APPLE_MAP_THEME.focusPadding.left,
      },
      duration: 350,
      easing: "ease",
    });
  }, [cameraPadding, focusZoneId]);

  useEffect(() => {
    if (!pin) return;
    cameraRef.current?.flyTo({
      center: [pin.longitude, pin.latitude],
      zoom: APPLE_MAP_THEME.defaultZoomWithPin,
      duration: 800,
    });
  }, [pin]);

  if (Constants.appOwnership === "expo") {
    return (
      <KitSurface
        tone="base"
        style={[
          styles.fallback,
          {
            backgroundColor: palette.surfaceAlt as string,
            borderRadius: BrandRadius.soft,
            borderCurve: "continuous",
            margin: BrandSpacing.lg,
          },
        ]}
      >
        <ThemedText type="defaultSemiBold">{t("mapTab.devBuildRequiredTitle")}</ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
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
        onWillStartLoadingMap={() => {
          updateMapLoadState("loading");
        }}
        onDidFinishLoadingMap={() => {
          updateMapLoadState("ready");
        }}
        onDidFailLoadingMap={() => {
          updateMapLoadState("error", t("mapTab.native.unavailableBody"));
        }}
        onRegionDidChange={(event) => {
          const nextZoom = sanitizeZoom(event.nativeEvent.zoom, currentZoom);
          setCurrentZoom((current) => (Math.abs(current - nextZoom) < 0.05 ? current : nextZoom));
        }}
        onPress={(event: any) => {
          if (mode !== "pinDrop") return;
          if (!onPressMap) return;
          const native = event?.nativeEvent ?? event;
          const coordinates = native?.lngLat as [number, number] | undefined;
          if (!coordinates) return;
          onPressMap({ latitude: coordinates[1], longitude: coordinates[0] });
        }}
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
          showLabelLayers={showLabelLayers}
          selectedZoneFilter={selectedZoneFilter}
          zoneGeoJson={zoneGeoJson}
          zoneIdProperty={zoneIdProperty}
          mapPalette={mapPalette}
          onPressZone={onPressZone}
        />

        {showStudioMarkers ? <Images images={studioMarkerImages} /> : null}
        {showStudioMarkers ? (
          <GeoJSONSource
            ref={studioSourceRef as any}
            id="queue-studio-marker-source"
            data={studioMarkerSource as any}
            cluster
            clusterRadius={44}
            clusterMinPoints={2}
            clusterMaxZoom={STUDIO_CLUSTER_MAX_ZOOM}
            onPress={(event: any) => {
              const native = event?.nativeEvent ?? event;
              const feature = native?.features?.[0];
              const clusterId = feature?.properties?.cluster_id;
              if (typeof clusterId === "number") {
                void studioSourceRef.current?.getClusterExpansionZoom(clusterId).then((zoom) => {
                  const coordinates = feature?.geometry?.coordinates;
                  if (!Array.isArray(coordinates) || coordinates.length < 2) return;
                  cameraRef.current?.flyTo({
                    center: [coordinates[0], coordinates[1]],
                    zoom,
                    duration: 280,
                  });
                });
                return;
              }
              const studioId = feature?.properties?.studioId;
              if (typeof studioId === "string") {
                onPressStudio?.(studioId);
              }
            }}
          >
            <Layer
              id="queue-studio-cluster-bubble"
              type="circle"
              filter={["has", "point_count"] as any}
              maxzoom={STUDIO_CLUSTER_MAX_ZOOM as any}
              paint={{
                "circle-color": mapPalette.markerAccent,
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  20,
                  10,
                  24,
                  25,
                  28,
                  75,
                  32,
                ] as any,
                "circle-stroke-color": palette.surface as string,
                "circle-stroke-width": 3,
              }}
            />
            <Layer
              id="queue-studio-cluster-count"
              type="symbol"
              filter={["has", "point_count"] as any}
              maxzoom={STUDIO_CLUSTER_MAX_ZOOM as any}
              layout={{
                "text-field": ["get", "point_count_abbreviated"] as any,
                "text-size": 13 as any,
                "text-font": ["Noto Sans Bold"] as any,
                "text-allow-overlap": true,
              }}
              paint={{
                "text-color": palette.onPrimary as string,
              }}
            />
            <Layer
              id="queue-studio-marker-layer"
              type="symbol"
              minzoom={STUDIO_MARKER_MIN_ZOOM as any}
              filter={["!", ["has", "point_count"]] as any}
              layout={{
                "icon-image": ["get", "iconKey"] as any,
                "icon-anchor": "bottom",
                "icon-size": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  STUDIO_MARKER_MIN_ZOOM,
                  0.24,
                  13.5,
                  0.31,
                  16,
                  0.39,
                ] as any,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              }}
              paint={{
                "icon-opacity": 1,
                "icon-color": ["coalesce", ["get", "markerColor"], mapPalette.markerAccent] as any,
              }}
            />
            <Layer
              id="queue-studio-name-layer"
              type="symbol"
              minzoom={STUDIO_PIN_LABEL_MIN_ZOOM as any}
              filter={["!", ["has", "point_count"]] as any}
              layout={{
                "text-field": ["get", "studioName"] as any,
                "text-size": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  STUDIO_PIN_LABEL_MIN_ZOOM,
                  10,
                  16,
                  12,
                ] as any,
                "text-anchor": "bottom",
                "text-offset": [0, -1.45] as any,
                "text-max-width": 8 as any,
                "text-allow-overlap": false,
              }}
              paint={{
                "text-color": palette.text as string,
                "text-halo-color": palette.surface as string,
                "text-halo-width": 1.4,
                "text-opacity": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  STUDIO_PIN_LABEL_MIN_ZOOM,
                  0,
                  14.8,
                  0.82,
                ] as any,
              }}
            />
          </GeoJSONSource>
        ) : null}

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
      </MapLibreMap>

      {mapLoadState === "loading" && showLoadingOverlay ? (
        <View
          style={[
            styles.stateOverlay,
            {
              backgroundColor: palette.appBg as string,
            },
          ]}
        >
          <View
            style={{
              width: LOADING_ICON_SIZE,
              height: LOADING_ICON_SIZE,
              borderRadius: LOADING_ICON_RADIUS,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palette.surfaceElevated as string,
            }}
          >
            <ActivityIndicator color={palette.primary as string} />
          </View>
        </View>
      ) : null}

      {mapLoadState === "error" ? (
        <View
          style={[
            styles.stateOverlay,
            {
              backgroundColor: palette.appBg as string,
            },
          ]}
        >
          <KitSurface
            tone="sheet"
            style={[
              styles.stateCard,
              {
                backgroundColor: palette.surface as string,
                borderColor: palette.border as string,
              },
            ]}
          >
            <ThemedText type="cardTitle">{t("mapTab.native.unavailableTitle")}</ThemedText>
            <ThemedText type="meta" style={{ color: palette.textMuted }}>
              {mapErrorMessage ?? t("mapTab.native.unavailableBody")}
            </ThemedText>
            <ActionButton
              label={t("tabsLayout.actions.retry")}
              onPress={handleRetry}
              palette={palette}
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
              width: GPS_BUTTON_SIZE,
              height: GPS_BUTTON_SIZE,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: BrandRadius.button,
              borderCurve: "continuous",
              backgroundColor: palette.surface as string,
              borderColor: palette.borderStrong as string,
              overflow: "hidden",
              opacity: pressed ? 0.84 : 1,
            },
          ]}
        >
          <IconSymbol name="location.fill" size={GPS_ICON_SIZE} color={palette.text} />
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
              backgroundColor: palette.surfaceElevated as string,
              borderColor: palette.borderStrong as string,
              borderWidth: StyleSheet.hairlineWidth,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <IconSymbol name="info.circle.fill" size={ATTRIBUTION_ICON_SIZE} color={palette.text} />
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
    width: ATTRIBUTION_SIZE,
    height: ATTRIBUTION_SIZE,
    borderRadius: BrandRadius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: BrandSpacing.sm,
    paddingHorizontal: BrandSpacing.lg,
    paddingVertical: BrandSpacing.lg,
  },
  stateOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: BrandSpacing.lg,
  },
  stateCard: {
    width: "100%",
    maxWidth: BrandSpacing.shellCommandPanel,
    alignItems: "center",
    gap: BrandSpacing.sm,
    paddingHorizontal: BrandSpacing.lg,
    paddingVertical: BrandSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
