import Constants from "expo-constants";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { APPLE_MAP_THEME } from "@/components/maps/queue-map-apple-theme";
import { QueueMapBoundaryPolygons } from "@/components/maps/queue-map-boundary-polygons";
import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing, getMapBrandPalette } from "@/constants/brand";
import {
  buildZoneFeatureCollection,
  getZoneIndexEntry,
  ISRAEL_MAP_INTERACTION_BOUNDS,
  PIKUD_ZONE_GEOJSON,
} from "@/constants/zones-map";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { ActionButton } from "../ui/action-button";
import { IconSymbol } from "../ui/icon-symbol";
import { KitSurface } from "../ui/kit";
import {
  createPropertyInFilter,
  createRadiusCircleFeatureCollection,
  ensureVectorOfflinePack,
  sanitizeZoom,
  selectRenderableStudioMarkers,
  toBounds,
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
  selectedZoneIds,
  focusZoneId,
  selectedBoundaryIds,
  focusBoundaryId,
  isEditing = mode === "zoneSelect",
  zoneGeoJson,
  zoneIdProperty = "id",
  boundarySource,
  boundaryIdProperty,
  boundaryLabelPropertyCandidates,
  boundaryInteractionBounds,
  focusBoundaryBounds,
  initialBoundaryViewport,
  studios,
  selectedStudioId,
  onPressStudio: _onPressStudio,
  onPressZone,
  onPressBoundary,
  onPressMap,
  onUseGps,
  showGpsButton = true,
  showAttributionButton = false,
  contentInset,
  cameraPadding,
  radiusKm,
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
  const activeBoundaryIds = selectedBoundaryIds ?? selectedZoneIds;
  const activeFocusBoundaryId = focusBoundaryId ?? focusZoneId;
  const activeBoundaryIdProperty = boundaryIdProperty ?? zoneIdProperty;
  const defaultBoundarySource = useMemo(() => {
    const defaultGeoJson =
      zoneGeoJson ??
      (mode === "zoneSelect"
        ? isEditing
          ? PIKUD_ZONE_GEOJSON
          : selectedZoneIds.length > 0
            ? buildZoneFeatureCollection(selectedZoneIds)
            : PIKUD_ZONE_GEOJSON
        : null);

    if (!defaultGeoJson) {
      return undefined;
    }

    return {
      kind: "geojson" as const,
      featureCollection: defaultGeoJson,
      idProperty: zoneIdProperty,
    };
  }, [isEditing, mode, selectedZoneIds, zoneGeoJson, zoneIdProperty]);
  const activeBoundarySource = boundarySource ?? defaultBoundarySource;
  const activeBoundaryPressHandler = onPressBoundary ?? onPressZone;
  const activeBoundaryInteractionBounds =
    boundaryInteractionBounds ??
    (boundarySource ? null : zoneGeoJson ? ISRAEL_MAP_INTERACTION_BOUNDS : null);
  const activeBoundaryLabelPropertyCandidates = boundaryLabelPropertyCandidates ?? [
    "engName",
    "hebName",
    "name",
    "postcode",
    "postal_code",
    "id",
  ];
  const initialCenter = useMemo<[number, number]>(() => {
    if (pin) {
      return [pin.longitude, pin.latitude];
    }
    const viewportBounds = initialBoundaryViewport?.bbox;
    if (viewportBounds) {
      return [
        (viewportBounds.sw[0] + viewportBounds.ne[0]) / 2,
        (viewportBounds.sw[1] + viewportBounds.ne[1]) / 2,
      ];
    }
    return APPLE_MAP_THEME.defaultCenter;
  }, [initialBoundaryViewport?.bbox, pin]);
  const initialZoom = pin
    ? APPLE_MAP_THEME.defaultZoomWithPin
    : (initialBoundaryViewport?.zoom ?? APPLE_MAP_THEME.defaultZoomWithoutPin);

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
  const selectedBoundaryFilter = useMemo(
    () => createPropertyInFilter(activeBoundaryIds, activeBoundaryIdProperty),
    [activeBoundaryIdProperty, activeBoundaryIds],
  );
  const radiusShape = useMemo(() => {
    if (!pin || !Number.isFinite(radiusKm ?? Number.NaN)) {
      return null;
    }
    const km = Math.max(0, radiusKm ?? 0);
    if (km <= 0) {
      return null;
    }
    return createRadiusCircleFeatureCollection(pin, km * 1000);
  }, [pin, radiusKm]);
  const [markerZoomLevel, setMarkerZoomLevel] = useState<number | null>(null);
  /** Live zoom level fed into boundary polygons for zoom-tier selection. */
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
    const padding = cameraPadding ?? {
      top: APPLE_MAP_THEME.focusPadding.top,
      right: APPLE_MAP_THEME.focusPadding.right,
      bottom: APPLE_MAP_THEME.focusPadding.bottom,
      left: APPLE_MAP_THEME.focusPadding.left,
    };

    const nextBounds: [number, number, number, number] | null = focusBoundaryBounds
      ? [
          focusBoundaryBounds.sw[0],
          focusBoundaryBounds.sw[1],
          focusBoundaryBounds.ne[0],
          focusBoundaryBounds.ne[1],
        ]
      : activeFocusBoundaryId
        ? (getZoneIndexEntry(activeFocusBoundaryId)?.bbox ?? null)
        : null;

    if (!nextBounds) return;

    cameraRef.current?.fitBounds(nextBounds, {
      padding,
      duration: 350,
      easing: "ease",
    });
  }, [activeFocusBoundaryId, cameraPadding, focusBoundaryBounds]);

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
          {...(activeBoundaryInteractionBounds
            ? {
                maxBounds: toBounds(
                  activeBoundaryInteractionBounds.sw,
                  activeBoundaryInteractionBounds.ne,
                ),
              }
            : {})}
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
                    "fill-opacity": 0.22,
                  }}
                />
                <LineLayer
                  id="queue-radius-line"
                  paint={{
                    "line-color": accentColor,
                    "line-width": 3,
                    "line-opacity": 0.9,
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
            {mode === "zoneSelect" || activeBoundarySource ? (
              <QueueMapBoundaryPolygons
                mode={mode}
                isEditing={isEditing}
                showLabelLayers
                selectedBoundaryIds={activeBoundaryIds}
                selectedBoundaryFilter={selectedBoundaryFilter}
                boundarySource={activeBoundarySource}
                boundaryIdProperty={activeBoundaryIdProperty}
                boundaryLabelPropertyCandidates={activeBoundaryLabelPropertyCandidates}
                visibleBounds={markerBounds}
                currentZoom={currentZoom}
                mapPalette={mapPalette}
                onPressBoundary={activeBoundaryPressHandler}
              />
            ) : null}
          </>
        ) : null}

        {pin ? (
          <Marker
            id="queue-pin-marker"
            lngLat={[pin.longitude, pin.latitude]}
            anchor="center"
          >
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
