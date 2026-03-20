import { Camera, GeoJSONSource, Layer, Map as MapLibreMap } from "@maplibre/maplibre-react-native";
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
  onPressZone,
  onPressMap,
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
  const mapStyle = themedMapStyle ?? preferredStyleUrl;
  const mapKey = `${resolvedScheme}:${retryNonce}:${themedMapStyle ? "themed" : "url"}`;

  const mapRef = useRef<{
    showAttribution?: () => void;
  } | null>(null);
  const cameraRef = useRef<{
    setStop: (config: unknown) => void;
    flyTo: (options: { center: [number, number]; zoom?: number; duration?: number }) => void;
  } | null>(null);
  const selectedZoneFilter = useMemo(
    () => createZoneFilter(selectedZoneIds, zoneIdProperty),
    [selectedZoneIds, zoneIdProperty],
  );
  const pinShape = useMemo(() => createPinShape(pin), [pin]);
  const handleRetry = useCallback(() => {
    setBaseMapStyle(null);
    setMapErrorMessage(null);
    setMapLoadState("loading");
    setShowLoadingOverlay(false);
    setRetryNonce((current) => current + 1);
  }, []);

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
    warmMapStyleSpec(styleFetchUrl);
    warmMapStyleSpec(alternateStyleUrl);
  }, [alternateStyleUrl, styleFetchUrl]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cachedStyle = getCachedMapStyleSpec(styleFetchUrl);
      if (!cancelled && cachedStyle !== undefined) {
        setBaseMapStyle(cachedStyle);
        return;
      }

      const baseStyle = await fetchMapStyleSpec(styleFetchUrl);
      if (!cancelled) {
        setBaseMapStyle(baseStyle);
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
            borderRadius: 28,
            borderCurve: "continuous",
            margin: 18,
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
          setMapLoadState("loading");
          setMapErrorMessage(null);
        }}
        onDidFinishLoadingMap={() => {
          setMapLoadState("ready");
          setMapErrorMessage(null);
        }}
        onDidFailLoadingMap={() => {
          setMapLoadState("error");
          setMapErrorMessage(t("mapTab.native.unavailableBody"));
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
            <ActivityIndicator color={palette.text as string} />
            <ThemedText type="cardTitle">{t("mapTab.loading")}</ThemedText>
            <ThemedText type="meta" style={{ color: palette.textMuted }}>
              {t("mapTab.native.loadingBody")}
            </ThemedText>
          </KitSurface>
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
              width: 58,
              height: 58,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.2,
              borderRadius: BrandRadius.button,
              borderCurve: "continuous",
              backgroundColor: palette.surface as string,
              borderColor: palette.borderStrong as string,
              overflow: "hidden",
              opacity: pressed ? 0.84 : 1,
            },
          ]}
        >
          <IconSymbol name="location.fill" size={20} color={palette.text} />
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
              borderWidth: 1,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <IconSymbol name="info.circle.fill" size={15} color={palette.text} />
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
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  stateOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  stateCard: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
