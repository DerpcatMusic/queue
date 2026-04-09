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
  createPinShape,
  createPropertyInFilter,
  ensureVectorOfflinePack,
  sanitizeZoom,
  selectRenderableStudioMarkers,
  toBounds,
} from "./queue-map.native.helpers";
import {
  Camera,
  CircleLayer,
  GeoJSONSource,
  MapView,
  Marker,
  StyleImport,
  type MapRef,
} from "./native-map-sdk";
import type { QueueMapProps } from "./queue-map.types";
import { STUDIO_MAP_MARKER_OUTER_SIZE, StudioMapMarkerView } from "./studio-map-marker-view";

type MapLoadState = "loading" | "ready" | "error";
const MAP_LOADING_OVERLAY_DELAY_MS = 80;
const MAP_LOADING_HARD_TIMEOUT_MS = 12000;

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
  onPressStudio,
  onPressZone,
  onPressBoundary,
  onPressMap,
  onUseGps,
  showGpsButton = true,
  showAttributionButton = false,
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
  const pinShape = useMemo(() => createPinShape(pin), [pin]);
  const [markerZoomLevel, setMarkerZoomLevel] = useState<number | null>(null);
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
            mapPalette={mapPalette}
            onPressBoundary={activeBoundaryPressHandler}
          />
        ) : null}

        <GeoJSONSource id="queue-pin-source" data={pinShape}>
          <CircleLayer
            id="queue-pin-dot"
            paint={{
              "circle-radius": APPLE_MAP_THEME.overlay.pinRadius,
              "circle-color": mapPalette.primary,
              "circle-stroke-color": mapPalette.text,
              "circle-stroke-width": APPLE_MAP_THEME.overlay.pinStrokeWidth,
            }}
          />
        </GeoJSONSource>

        <StudioMarkerList
          studios={renderableStudios}
          selectedStudioId={selectedStudioId}
          onPressStudio={
            onPressStudio ??
            (() => {
              /* intentionally empty — tab switches can trigger a brief render before the callback is set */
            })
          }
        />
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

// ─── Studio Marker List ────────────────────────────────────────────────────────
// Extracted to prevent MapLibre native marker churn on every pan event.
// Only re-renders when renderableStudios or selectedStudioId actually change.
type StudioMarkerListProps = {
  studios: readonly import("./queue-map.types").StudioMapMarker[];
  selectedStudioId: string | null | undefined;
  onPressStudio: (studioId: string) => void;
};

const StudioMarkerList = memo(
  function StudioMarkerList({ studios, selectedStudioId, onPressStudio }: StudioMarkerListProps) {
    return (
      <>
        {studios.map((studio) => (
          <Marker
            key={studio.studioId}
            id={`studio-marker:${studio.studioId}`}
            lngLat={[studio.longitude, studio.latitude]}
            anchor="top-left"
            offset={[-STUDIO_MAP_MARKER_OUTER_SIZE / 2, -STUDIO_MAP_MARKER_OUTER_SIZE / 2]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={studio.studioName}
              onPress={() => onPressStudio(studio.studioId)}
              style={{ width: STUDIO_MAP_MARKER_OUTER_SIZE, height: STUDIO_MAP_MARKER_OUTER_SIZE }}
            >
              <StudioMapMarkerView
                studio={studio}
                selected={selectedStudioId === studio.studioId}
              />
            </Pressable>
          </Marker>
        ))}
      </>
    );
  },
  (prev, next) => {
    // Custom comparison: only re-render if studio list or selection actually changed
    if (prev.selectedStudioId !== next.selectedStudioId) return false;
    if (prev.studios.length !== next.studios.length) return false;
    for (let i = 0; i < prev.studios.length; i++) {
      const a = prev.studios[i]!;
      const b = next.studios[i]!;
      if (
        a.studioId !== b.studioId ||
        a.studioName !== b.studioName ||
        a.logoImageUrl !== b.logoImageUrl ||
        a.mapMarkerColor !== b.mapMarkerColor ||
        a.latitude !== b.latitude ||
        a.longitude !== b.longitude
      ) {
        return false;
      }
    }
    return true;
  },
);

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
