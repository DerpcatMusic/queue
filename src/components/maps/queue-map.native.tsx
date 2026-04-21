import Constants from "expo-constants";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { APPLE_MAP_THEME } from "@/components/maps/queue-map-apple-theme";
import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing, getMapBrandPalette } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { ActionButton } from "../ui/action-button";
import { IconSymbol } from "../ui/icon-symbol";
import { KitSurface } from "../ui/kit";
import {
  createCoverageFeatureCollection,
  ensureVectorOfflinePack,
  getFeatureCollectionBounds,
  sanitizeZoom,
  selectRenderableStudioMarkers,
} from "./queue-map.native.helpers";
import {
  Camera,
  GeoJSONSource,
  MapView,
  Marker,
  FillLayer,
  LineLayer,
  PointAnnotation,
  StyleImport,
  type MapRef,
} from "./native-map-sdk";
import type { QueueMapProps } from "./queue-map.types";
import { StudioMapMarkerView } from "./studio-map-marker-view";

type MapLoadState = "loading" | "ready" | "error";
const MAP_LOADING_OVERLAY_DELAY_MS = 80;
const MAP_LOADING_HARD_TIMEOUT_MS = 12000;

const StudioMarkerAnnotation = memo(function StudioMarkerAnnotation({
  studio,
  selected,
  onPressStudio,
  zoomLevel,
}: {
  studio: NonNullable<QueueMapProps["studios"]>[number];
  selected: boolean;
  onPressStudio: ((studioId: string) => void) | undefined;
  zoomLevel: number | undefined;
}) {
  const pointAnnotationRef = useRef<{ refresh?: () => void } | null>(null);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  const zoomScale = useMemo(() => {
    const zoom = zoomLevel ?? 0;
    const normalized = Math.max(0, Math.min(1, (zoom - 14.2) / 1.8));
    return 1 + normalized * 0.12;
  }, [zoomLevel]);
  const handleAvatarLoad = useCallback(() => {
    pointAnnotationRef.current?.refresh?.();
    setAvatarRefreshKey((current) => current + 1);
  }, []);

  const outerSize = Math.round((BrandSpacing.avatarSm + BrandSpacing.xs * 2) * zoomScale);

  return (
    <PointAnnotation
      ref={pointAnnotationRef as any}
      id={`queue-studio-${studio.studioId}`}
      coordinate={[studio.longitude, studio.latitude]}
      anchor={{ x: 0.5, y: 0.5 }}
      selected={selected}
      style={{ width: outerSize, height: outerSize }}
      onSelected={() => {
        onPressStudio?.(studio.studioId);
      }}
    >
      <StudioMapMarkerView
        key={`${studio.studioId}:${avatarRefreshKey}`}
        studio={studio}
        selected={selected}
        onAvatarLoad={handleAvatarLoad}
        scale={zoomScale}
      />
    </PointAnnotation>
  );
});

export const QueueMap = memo(function QueueMap({
  mode,
  pin,
  studios,
  selectedStudioId,
  onPressStudio: _onPressStudio,
  onPressMap,
  onUseGps,
  showGpsButton = true,
  showAttributionButton = false,
  contentInset,
  cameraPadding,
  radiusKm: _radiusKm,
  coveragePolygons,
  focusFrameKey,
  flyToCoordinate,
}: QueueMapProps) {
  const { t } = useTranslation();
  const { resolvedScheme } = useThemePreference();
  const { color } = useTheme();
  const mapPalette = getMapBrandPalette(resolvedScheme);
  const accentColor = color.primary;
  const studioAccentColor = color.primary;
  const [mapLoadState, setMapLoadState] = useState<MapLoadState>("loading");
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [mapErrorMessage, setMapErrorMessage] = useState<string | null>(null);
  const mapStyle =
    resolvedScheme === "dark" ? APPLE_MAP_THEME.mapStyleDarkUrl : APPLE_MAP_THEME.mapStyleLightUrl;
  const standardBasemapConfig = useMemo(
    () =>
      ({
        showPointOfInterestLabels: false,
        showTransitLabels: false,
        showPedestrianRoads: false,
        showAdminBoundaries: false,
        show3dObjects: false,
        showLandmarkIcons: false,
        showLandmarkIconLabels: false,
        showPlaceLabels: true,
        showRoadLabels: false,
        lightPreset: resolvedScheme === "dark" ? "night" : "day",
        theme: "default",
      }) as any,
    [resolvedScheme],
  );
  const mapKey = resolvedScheme;
  const initialCenter = useMemo<[number, number]>(() => {
    if (pin) {
      return [pin.longitude, pin.latitude];
    }
    return APPLE_MAP_THEME.defaultCenter;
  }, [pin]);
  const initialZoom = pin
    ? APPLE_MAP_THEME.defaultZoomWithPin
    : APPLE_MAP_THEME.defaultZoomWithoutPin;

  const mapRef = useRef<MapRef | null>(null);
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
  const focusRadiusBounds = useMemo(() => {
    if (!coveragePolygons || coveragePolygons.length === 0) {
      return null;
    }
    return getFeatureCollectionBounds(createCoverageFeatureCollection(coveragePolygons));
  }, [coveragePolygons]);
  const focusRadiusBoundsRef = useRef(focusRadiusBounds);
  useEffect(() => {
    focusRadiusBoundsRef.current = focusRadiusBounds;
  }, [focusRadiusBounds]);
  const radiusShape = useMemo(() => {
    if (!coveragePolygons || coveragePolygons.length === 0) {
      return null;
    }
    return createCoverageFeatureCollection(coveragePolygons);
  }, [coveragePolygons]);
  const [markerZoomLevel, setMarkerZoomLevel] = useState<number | null>(null);
  /** Live zoom level fed into studio marker scaling. */
  const [currentZoom, setCurrentZoom] = useState<number | undefined>(undefined);
  const [markerBounds, setMarkerBounds] = useState<{
    sw: [number, number];
    ne: [number, number];
  } | null>(null);
  const renderableStudios = useMemo(
    () =>
      selectRenderableStudioMarkers(studios ?? [], {
        bounds: markerBounds,
        zoomLevel: markerZoomLevel,
        selectedStudioId: selectedStudioId ?? null,
      }),
    [markerBounds, markerZoomLevel, selectedStudioId, studios],
  );
  const handleMapPress = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      // Pin-drop mode: record dropped pin coordinate
      if (mode !== "pinDrop") return;
      if (!onPressMap) return;
      const native = event?.nativeEvent ?? event;
      const coordinates = native?.lngLat as [number, number] | undefined;
      if (!coordinates) return;
      onPressMap({ latitude: coordinates[1], longitude: coordinates[0] });
    },
    [mode, onPressMap],
  );

  const syncMarkerViewport = useCallback(async () => {
    try {
      const [bounds, zoom] = await Promise.all([
        mapRef.current?.getBounds(),
        mapRef.current?.getZoom(),
      ]);

      if (bounds) {
        setMarkerBounds((current) => {
          const next = {
            sw: [bounds[0], bounds[1]] as [number, number],
            ne: [bounds[2], bounds[3]] as [number, number],
          };
          if (
            current &&
            current.sw[0] === next.sw[0] &&
            current.sw[1] === next.sw[1] &&
            current.ne[0] === next.ne[0] &&
            current.ne[1] === next.ne[1]
          ) {
            return current;
          }
          return next;
        });
      }

      if (typeof zoom === "number") {
        setMarkerZoomLevel((current) => (current === zoom ? current : zoom));
        setCurrentZoom(zoom);
      }
    } catch {
      // Ignore transient native errors while the map settles.
    }
  }, []);

  // Throttle syncMarkerViewport to ~60fps (16ms) to avoid flooding the JS thread during pan.
  const lastSyncTimeRef = useRef<number>(0);
  const rafHandleRef = useRef<number | null>(null);
  const syncMarkerViewportThrottled = useCallback(() => {
    const now = performance.now();
    const elapsed = now - lastSyncTimeRef.current;
    if (elapsed >= 16) {
      // Enough time has passed — execute immediately
      lastSyncTimeRef.current = now;
      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current);
        rafHandleRef.current = null;
      }
      void syncMarkerViewport();
      return;
    }
    // Within the 16ms window — cancel any pending and schedule a new one
    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
    }
    rafHandleRef.current = requestAnimationFrame(() => {
      rafHandleRef.current = null;
      lastSyncTimeRef.current = performance.now();
      void syncMarkerViewport();
    });
  }, [syncMarkerViewport]);

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

  const handleDidFinishLoadingStyle = useCallback(() => {
    updateMapLoadState("ready");
  }, [updateMapLoadState]);

  const handleDidFinishRenderingMapFully = useCallback(() => {
    updateMapLoadState("ready");
  }, [updateMapLoadState]);

  const handleDidFailLoadingMap = useCallback(() => {
    updateMapLoadState("error", t("mapTab.native.unavailableBody"));
  }, [updateMapLoadState, t]);

  // Handle flyToCoordinate prop — fly to given coordinates when GPS updates them
  const lastFlyTargetRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (mapLoadState !== "ready" || !cameraRef.current || flyToCoordinate === undefined) return;
    const target: [number, number] = flyToCoordinate;
    if (
      lastFlyTargetRef.current &&
      lastFlyTargetRef.current[0] === target[0] &&
      lastFlyTargetRef.current[1] === target[1]
    ) return;
    lastFlyTargetRef.current = target;
    cameraRef.current?.flyTo(target, 800);
  }, [flyToCoordinate, mapLoadState]);

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
    if (mapLoadState !== "loading") {
      return;
    }

    const timeout = setTimeout(() => {
      updateMapLoadState("error", t("mapTab.native.unavailableBody"));
    }, MAP_LOADING_HARD_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [mapLoadState, t, updateMapLoadState]);

  useEffect(() => {
    if (mapLoadState !== "ready") return;
    void syncMarkerViewport();

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
  }, [mapLoadState, syncMarkerViewport]);

  useEffect(() => {
    if (mapLoadState !== "ready" || !cameraRef.current) {
      return;
    }

    const nextBounds = focusRadiusBoundsRef.current;
    if (!nextBounds) {
      return;
    }

    const timeout = setTimeout(() => {
      cameraRef.current?.fitBounds(
        [nextBounds.sw[0], nextBounds.sw[1], nextBounds.ne[0], nextBounds.ne[1]],
        {
          padding: {
            top: (cameraPadding?.top ?? 0) + 32,
            right: (cameraPadding?.right ?? 0) + 32,
            bottom: (cameraPadding?.bottom ?? 0) + 32,
            left: (cameraPadding?.left ?? 0) + 32,
          },
          duration: 420,
        },
      );
    }, 24);

    return () => {
      clearTimeout(timeout);
    };
  }, [
    cameraPadding?.bottom,
    cameraPadding?.left,
    cameraPadding?.right,
    cameraPadding?.top,
    focusFrameKey,
    mapLoadState,
  ]);

  if (Constants.appOwnership === "expo") {
    return (
      <KitSurface
        tone="base"
        style={[
          styles.fallback,
          {
            backgroundColor: color.surfaceElevated,
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
      <MapView
        ref={mapRef as any}
        key={mapKey}
        style={styles.map}
        mapStyle={mapStyle as any}
        surfaceView
        preferredFramesPerSecond={60}
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
        onDidFinishLoadingStyle={handleDidFinishLoadingStyle}
        onDidFinishRenderingMapFully={handleDidFinishRenderingMapFully}
        onDidFailLoadingMap={handleDidFailLoadingMap}
        onMapIdle={() => {
          void syncMarkerViewportThrottled();
        }}
        onPress={handleMapPress as any}
      >
        {mapStyle === "mapbox://styles/mapbox/standard" ? (
          <StyleImport id="basemap" existing config={standardBasemapConfig} />
        ) : null}

        <Camera
          ref={cameraRef as any}
          minZoom={sanitizeZoom(APPLE_MAP_THEME.minZoom, 7.5)}
          maxZoom={sanitizeZoom(APPLE_MAP_THEME.maxZoom, 16)}
          initialViewState={{
            center: initialCenter,
            zoom: initialZoom,
          }}
        />

        {mapLoadState === "ready" ? (
          <>
            {radiusShape ? (
              <GeoJSONSource id="queue-radius-source" data={radiusShape}>
                <FillLayer
                  id="queue-radius-fill"
                  paint={{
                    "fill-color": accentColor,
                    "fill-opacity": 0.12,
                  }}
                />
                <LineLayer
                  id="queue-radius-line"
                  paint={{
                    "line-color": accentColor,
                    "line-width": 1.15,
                    "line-opacity": 0.78,
                  }}
                />
              </GeoJSONSource>
            ) : null}
            {renderableStudios.length > 0
              ? renderableStudios.map((studio) => (
                  <StudioMarkerAnnotation
                    key={studio.studioId}
                    studio={studio}
                    selected={selectedStudioId === studio.studioId}
                    onPressStudio={_onPressStudio}
                    zoomLevel={currentZoom}
                  />
                ))
              : null}
          </>
        ) : null}

        {pin ? (
          <Marker id="queue-pin-marker" lngLat={[pin.longitude, pin.latitude]} anchor="center">
            <View
              style={{
                width: APPLE_MAP_THEME.overlay.pinRadius * 2,
                height: APPLE_MAP_THEME.overlay.pinRadius * 2,
                borderRadius: APPLE_MAP_THEME.overlay.pinRadius,
                borderCurve: "continuous",
                backgroundColor: studioAccentColor,
                borderWidth: APPLE_MAP_THEME.overlay.pinStrokeWidth,
                borderColor: mapPalette.text,
              }}
            />
          </Marker>
        ) : null}
      </MapView>

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
              width: BrandSpacing.controlMd,
              height: BrandSpacing.controlMd,
              borderRadius: BrandRadius.mapMarker,
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
              width: BrandSpacing.controlLg,
              height: BrandSpacing.controlLg,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.2,
              borderRadius: BrandRadius.button,
              borderCurve: "continuous",
              backgroundColor: pressed ? color.surfaceElevated : color.surface,
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
              backgroundColor: pressed ? color.surface : color.surfaceElevated,
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
