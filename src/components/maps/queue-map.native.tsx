import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  OfflineManager,
} from "@maplibre/maplibre-react-native";
import Constants from "expo-constants";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, InteractionManager, Pressable, StyleSheet, View } from "react-native";

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
import type { QueueMapPin, QueueMapProps } from "./queue-map.types";

type Expression = unknown;
type AnyStyleLayer = Record<string, any>;
type AnyStyleSpec = {
  version: number;
  sources: Record<string, unknown>;
  layers: AnyStyleLayer[];
  [key: string]: unknown;
};
type MapLoadState = "loading" | "ready" | "error";

const NO_MATCH_ZONE_FILTER: Expression = ["==", ["get", "id"], "__none__"];
let offlinePackBootstrapPromise: Promise<void> | null = null;

function sanitizeZoom(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(22, value));
}

function createZoneFilter(zoneIds: readonly string[], propertyName: string): Expression {
  if (zoneIds.length === 0) return NO_MATCH_ZONE_FILTER;
  return ["in", ["get", propertyName], ["literal", zoneIds as string[]]] as Expression;
}

function toBounds(sw: [number, number], ne: [number, number]): [number, number, number, number] {
  return [sw[0], sw[1], ne[0], ne[1]];
}

function isRoadNumberLayer(layer: AnyStyleLayer) {
  const id = String(layer?.id ?? "").toLowerCase();
  const sourceLayer = String(layer?.["source-layer"] ?? "").toLowerCase();
  if (id.includes("shield")) return true;
  if (id.includes("road-number")) return true;
  if (id.includes("highway-number")) return true;
  if (id.includes("route-number")) return true;
  if (sourceLayer.includes("shield")) return true;
  const textField = JSON.stringify(layer?.layout?.["text-field"] ?? "").toLowerCase();
  if (textField.includes("ref")) return true;
  return false;
}

function withMapPersonality(
  style: AnyStyleSpec,
  palette: ReturnType<typeof getMapBrandPalette>,
  showBaseLabels: boolean,
) {
  const layers = (style.layers ?? [])
    .filter((layer) => !isRoadNumberLayer(layer))
    .filter((layer) => (showBaseLabels ? true : String(layer?.type ?? "") !== "symbol"))
    .map((layer) => {
      const nextLayer = { ...layer };
      const id = String(nextLayer.id ?? "").toLowerCase();
      const sourceLayer = String(nextLayer["source-layer"] ?? "").toLowerCase();
      const paint = { ...(nextLayer.paint ?? {}) };
      const layerType = String(nextLayer.type ?? "");

      if (layerType === "background") {
        paint["background-color"] = palette.styleBackground;
      }
      if ((sourceLayer.includes("water") || id.includes("water")) && layerType === "fill") {
        paint["fill-color"] = palette.waterFill;
      }
      if ((sourceLayer.includes("water") || id.includes("water")) && layerType === "line") {
        paint["line-color"] = palette.waterLine;
      }
      if (
        (sourceLayer.includes("park") ||
          sourceLayer.includes("landuse") ||
          sourceLayer.includes("landcover") ||
          sourceLayer.includes("forest") ||
          sourceLayer.includes("wood") ||
          sourceLayer.includes("grass") ||
          sourceLayer.includes("green") ||
          id.includes("forest") ||
          id.includes("green") ||
          id.includes("park")) &&
        layerType === "fill"
      ) {
        paint["fill-color"] = palette.landcover;
      }
      if (sourceLayer.includes("road") && layerType === "line") {
        paint["line-color"] = palette.roadLine;
      }
      if ((sourceLayer.includes("building") || id.includes("building")) && layerType === "fill") {
        paint["fill-color"] = palette.buildingFill;
      }
      if (layerType === "symbol") {
        paint["text-color"] = palette.text;
        paint["text-halo-color"] = palette.textHalo;
        paint["text-halo-width"] = 1;
      }

      nextLayer.paint = paint;
      return nextLayer;
    });

  return { ...style, layers };
}

async function ensureVectorOfflinePack() {
  if (!APPLE_MAP_THEME.offlinePack.enabled) return;
  if (offlinePackBootstrapPromise) {
    await offlinePackBootstrapPromise;
    return;
  }

  const minZoom = sanitizeZoom(APPLE_MAP_THEME.offlinePack.minZoom, 8);
  const maxZoom = sanitizeZoom(APPLE_MAP_THEME.offlinePack.maxZoom, 11);
  const zoomStart = Math.min(minZoom, maxZoom);
  const zoomEnd = Math.max(minZoom, maxZoom);

  offlinePackBootstrapPromise = (async () => {
    try {
      const existingPacks = await OfflineManager.getPacks();
      const existingPack = existingPacks.find(
        (pack) =>
          typeof pack.metadata?.name === "string" &&
          pack.metadata.name === APPLE_MAP_THEME.offlinePack.name,
      );
      if (existingPack) return;

      OfflineManager.setProgressEventThrottle(APPLE_MAP_THEME.offlinePack.progressThrottleMs);
      await OfflineManager.createPack(
        {
          mapStyle: APPLE_MAP_THEME.mapStyleLightUrl,
          bounds: toBounds(ISRAEL_MAP_INTERACTION_BOUNDS.sw, ISRAEL_MAP_INTERACTION_BOUNDS.ne),
          minZoom: zoomStart,
          maxZoom: zoomEnd,
          metadata: {
            name: APPLE_MAP_THEME.offlinePack.name,
            createdAt: Date.now(),
            source: "queue_map_bootstrap",
          },
        },
        () => {},
        () => {},
      );
    } finally {
      offlinePackBootstrapPromise = null;
    }
  })();

  await offlinePackBootstrapPromise;
}

function createPinShape(pin: QueueMapPin | null): GeoJSON.FeatureCollection {
  if (!pin) return { type: "FeatureCollection", features: [] };
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
}

export function QueueMap({
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
  const [retryNonce, setRetryNonce] = useState(0);
  const [mapErrorMessage, setMapErrorMessage] = useState<string | null>(null);
  const [baseMapStyle, setBaseMapStyle] = useState<AnyStyleSpec | null>(null);
  const preferredStyleUrl =
    resolvedScheme === "dark" ? APPLE_MAP_THEME.mapStyleDarkUrl : APPLE_MAP_THEME.mapStyleLightUrl;
  const styleFetchUrl =
    retryNonce === 0
      ? preferredStyleUrl
      : `${preferredStyleUrl}${preferredStyleUrl.includes("?") ? "&" : "?"}queueRetry=${String(retryNonce)}`;
  const themedMapStyle = useMemo(() => {
    if (!baseMapStyle) return null;
    return withMapPersonality(baseMapStyle, mapPalette, mode !== "zoneSelect");
  }, [baseMapStyle, mapPalette, mode]);
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
    setRetryNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    if (mapLoadState !== "ready") return;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      void ensureVectorOfflinePack().catch(() => {});
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [mapLoadState]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      if (!cancelled) {
        setBaseMapStyle(null);
      }
      try {
        const response = await fetch(styleFetchUrl, {
          signal: controller.signal,
        });
        if (!response.ok) {
          if (!cancelled) {
            setBaseMapStyle(null);
          }
          return;
        }
        const baseStyle = (await response.json()) as AnyStyleSpec;
        if (!cancelled) {
          setBaseMapStyle(baseStyle);
        }
      } catch {
        if (!cancelled) {
          setBaseMapStyle(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
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

      {mapLoadState === "loading" ? (
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
          accessibilityLabel={t("mapTab.native.openAttribution", {
            defaultValue: "Open map attribution",
          })}
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
}

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
