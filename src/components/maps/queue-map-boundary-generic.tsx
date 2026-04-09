import Mapbox from "@rnmapbox/maps";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { APPLE_MAP_THEME } from "@/components/maps/queue-map-apple-theme";
import type { getMapBrandPalette } from "@/constants/brand";
import type { BoundaryGeometrySource } from "@/features/maps/boundaries/types";
import type { QueueMapProps } from "./queue-map.types";

type Expression = unknown;

type QueueMapBoundaryGenericProps = {
  mode: QueueMapProps["mode"];
  isEditing: boolean;
  showLabelLayers: boolean;
  selectedBoundaryIds: string[];
  selectedBoundaryFilter: Expression;
  boundarySource: BoundaryGeometrySource;
  boundaryIdProperty: string;
  boundaryLabelPropertyCandidates: string[];
  visibleBounds?: QueueMapProps["visibleBounds"];
  mapPalette: ReturnType<typeof getMapBrandPalette>;
  onPressBoundary: ((boundaryId: string) => void) | undefined;
};

const remoteBoundaryCache = new Map<string, GeoJSON.FeatureCollection>();

function roundCoord(value: number) {
  return Math.round(value * 1000) / 1000;
}

function createBoundsCacheKey(sourceId: string, bounds: QueueMapProps["visibleBounds"]) {
  if (!bounds) return `${sourceId}:full`;
  return [
    sourceId,
    roundCoord(bounds.sw[0]),
    roundCoord(bounds.sw[1]),
    roundCoord(bounds.ne[0]),
    roundCoord(bounds.ne[1]),
  ].join(":");
}

export const QueueMapBoundaryGeneric = memo(function QueueMapBoundaryGeneric({
  mode,
  isEditing,
  showLabelLayers,
  selectedBoundaryIds,
  selectedBoundaryFilter,
  boundarySource,
  boundaryIdProperty,
  boundaryLabelPropertyCandidates,
  visibleBounds,
  mapPalette,
  onPressBoundary,
}: QueueMapBoundaryGenericProps) {
  const handlePress = useCallback(
    (event: unknown) => {
      if (mode !== "zoneSelect" || !isEditing) return;
      if (!onPressBoundary) return;
      const native = (event as { nativeEvent?: unknown } | undefined)?.nativeEvent ?? event;
      const pressedEvent = native as { features?: { properties?: Record<string, unknown> }[] };
      const feature = pressedEvent.features?.[0];
      if (!feature?.properties) return;
      const boundaryId = String(feature.properties[boundaryIdProperty] ?? "");
      if (!boundaryId) return;
      onPressBoundary(boundaryId);
    },
    [mode, isEditing, onPressBoundary, boundaryIdProperty],
  );

  const showAllBoundaries = mode === "zoneSelect" && isEditing;

  const [remoteFeatureCollection, setRemoteFeatureCollection] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const remoteRequestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (boundarySource.kind !== "remoteGeojson") {
      setRemoteFeatureCollection(null);
      remoteRequestKeyRef.current = null;
      return;
    }

    const cacheKey = createBoundsCacheKey(boundarySource.sourceId, visibleBounds ?? null);
    remoteRequestKeyRef.current = cacheKey;
    const cached = remoteBoundaryCache.get(cacheKey);
    if (cached) {
      setRemoteFeatureCollection(cached);
      return;
    }

    const controller = new AbortController();
    void boundarySource
      .loadFeatureCollection({
        bbox: visibleBounds ?? null,
        signal: controller.signal,
      })
      .then((featureCollection) => {
        if (controller.signal.aborted) return;
        remoteBoundaryCache.set(cacheKey, featureCollection);
        if (remoteRequestKeyRef.current === cacheKey) {
          setRemoteFeatureCollection(featureCollection);
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
      });

    return () => {
      controller.abort();
    };
  }, [boundarySource, visibleBounds]);

  const sourceData = useMemo(() => {
    if (boundarySource.kind === "remoteGeojson") return remoteFeatureCollection;
    if (boundarySource.kind === "geojson") return boundarySource.featureCollection;
    return null;
  }, [boundarySource, remoteFeatureCollection]);

  // Build the label expression from candidates
  const labelExpression = useMemo(() => {
    const candidates = boundaryLabelPropertyCandidates ?? ["name", "id"];
    if (candidates.length === 0) return "";
    if (candidates.length === 1) return ["coalesce", ["get", candidates[0]], ""] as any;
    return ["coalesce", ...candidates.map((c) => ["get", c]), ""] as any;
  }, [boundaryLabelPropertyCandidates]);

  // ─── Vector tiles source (raw @rnmapbox/maps) ───
  if (boundarySource.kind === "vectorTiles") {
    return (
      <Mapbox.VectorSource
        id="queue-boundary-generic-vector"
        {...(boundarySource.tilesetUrl ? { url: boundarySource.tilesetUrl } : {})}
        {...(boundarySource.tileUrlTemplates
          ? { tileUrlTemplates: boundarySource.tileUrlTemplates }
          : {})}
        onPress={handlePress as any}
        hitbox={{ width: 28, height: 28 }}
      >
        <Mapbox.FillLayer
          id="queue-boundary-generic-base-fill"
          sourceLayerID={boundarySource.sourceLayer}
          style={{
            fillColor: mapPalette.primary,
            fillOpacity: showAllBoundaries ? 0.1 : 0,
          }}
        />
        <Mapbox.LineLayer
          id="queue-boundary-generic-base-outline"
          sourceLayerID={boundarySource.sourceLayer}
          style={{
            lineColor: mapPalette.selectedOutline,
            lineWidth: showAllBoundaries
              ? ["interpolate", ["linear"], ["zoom"], 4, 1.1, 7, 1.35, 10, 1.7, 14, 2.1]
              : 0,
            lineOpacity: showAllBoundaries ? 0.96 : 0,
            lineJoin: "round",
          }}
        />
        <Mapbox.FillLayer
          id="queue-boundary-generic-selected-fill"
          sourceLayerID={boundarySource.sourceLayer}
          style={{
            fillColor: mapPalette.primary,
            fillOpacity: [
              "case",
              ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
              showAllBoundaries ? 0.28 : 0.24,
              0,
            ],
          }}
        />
        <Mapbox.LineLayer
          id="queue-boundary-generic-selected-outline"
          sourceLayerID={boundarySource.sourceLayer}
          style={{
            lineColor: mapPalette.selectedOutline,
            lineWidth: [
              "case",
              ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
              showAllBoundaries ? 2.8 : 2.2,
              0,
            ],
            lineOpacity: [
              "case",
              ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
              APPLE_MAP_THEME.overlay.selectionOutlineOpacity,
              0,
            ],
            lineJoin: "round",
          }}
        />
        <Mapbox.SymbolLayer
          id="queue-boundary-generic-labels"
          sourceLayerID={boundarySource.sourceLayer}
          filter={showAllBoundaries ? undefined : (selectedBoundaryFilter as any)}
          minZoomLevel={5}
          style={{
            visibility: showLabelLayers ? "visible" : "none",
            textField: labelExpression as any,
            textSize: ["interpolate", ["linear"], ["zoom"], 5, 10, 8, 11, 11, 12, 14, 13],
            textAllowOverlap: showAllBoundaries,
            textIgnorePlacement: showAllBoundaries,
            textFont: ["Noto Sans Regular"],
            textColor: mapPalette.text,
            textHaloColor: mapPalette.surfaceAlt,
            textHaloWidth: 1.2,
            textOpacity: showAllBoundaries ? 1 : 0.86,
          }}
        />
      </Mapbox.VectorSource>
    );
  }

  // ─── Remote GeoJSON source (fetched on mount, raw @rnmapbox/maps) ───
  if (boundarySource.kind === "remoteGeojson") {
    if (!sourceData) return null;
    return (
      <Mapbox.ShapeSource
        id="queue-boundary-generic-remote"
        shape={sourceData}
        onPress={handlePress as any}
        hitbox={{ width: 28, height: 28 }}
      >
        <Mapbox.FillLayer
          id="queue-boundary-generic-base-fill"
          style={{ fillColor: mapPalette.primary, fillOpacity: showAllBoundaries ? 0.1 : 0 }}
        />
        <Mapbox.LineLayer
          id="queue-boundary-generic-base-outline"
          style={{
            lineColor: mapPalette.selectedOutline,
            lineWidth: showAllBoundaries
              ? ["interpolate", ["linear"], ["zoom"], 4, 1.1, 7, 1.35, 10, 1.7, 14, 2.1]
              : 0,
            lineOpacity: showAllBoundaries ? 0.96 : 0,
            lineJoin: "round",
          }}
        />
        <Mapbox.FillLayer
          id="queue-boundary-generic-selected-fill"
          style={{
            fillColor: mapPalette.primary,
            fillOpacity: [
              "case",
              ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
              showAllBoundaries ? 0.28 : 0.24,
              0,
            ],
          }}
        />
        <Mapbox.LineLayer
          id="queue-boundary-generic-selected-outline"
          style={{
            lineColor: mapPalette.selectedOutline,
            lineWidth: [
              "case",
              ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
              showAllBoundaries ? 2.8 : 2.2,
              0,
            ],
            lineOpacity: [
              "case",
              ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
              APPLE_MAP_THEME.overlay.selectionOutlineOpacity,
              0,
            ],
            lineJoin: "round",
          }}
        />
        <Mapbox.SymbolLayer
          id="queue-boundary-generic-labels"
          filter={showAllBoundaries ? undefined : (selectedBoundaryFilter as any)}
          minZoomLevel={5}
          style={{
            visibility: showLabelLayers ? "visible" : "none",
            textField: labelExpression as any,
            textSize: ["interpolate", ["linear"], ["zoom"], 5, 10, 8, 11, 11, 12, 14, 13],
            textAllowOverlap: showAllBoundaries,
            textIgnorePlacement: showAllBoundaries,
            textFont: ["Noto Sans Regular"],
            textColor: mapPalette.text,
            textHaloColor: mapPalette.surfaceAlt,
            textHaloWidth: 1.2,
            textOpacity: showAllBoundaries ? 1 : 0.86,
          }}
        />
      </Mapbox.ShapeSource>
    );
  }

  // ─── Inline GeoJSON source (bundled London data, raw @rnmapbox/maps) ───
  return (
    <Mapbox.ShapeSource
      id="queue-boundary-generic-geojson"
      shape={boundarySource.featureCollection}
      onPress={handlePress as any}
      hitbox={{ width: 28, height: 28 }}
    >
      <Mapbox.FillLayer
        id="queue-boundary-generic-base-fill"
        style={{ fillColor: mapPalette.primary, fillOpacity: showAllBoundaries ? 0.1 : 0 }}
      />
      <Mapbox.LineLayer
        id="queue-boundary-generic-base-outline"
        style={{
          lineColor: mapPalette.selectedOutline,
          lineWidth: showAllBoundaries
            ? ["interpolate", ["linear"], ["zoom"], 4, 1.1, 7, 1.35, 10, 1.7, 14, 2.1]
            : 0,
          lineOpacity: showAllBoundaries ? 0.96 : 0,
          lineJoin: "round",
        }}
      />
      <Mapbox.FillLayer
        id="queue-boundary-generic-selected-fill"
        style={{
          fillColor: mapPalette.primary,
          fillOpacity: [
            "case",
            ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
            showAllBoundaries ? 0.28 : 0.24,
            0,
          ],
        }}
      />
      <Mapbox.LineLayer
        id="queue-boundary-generic-selected-outline"
        style={{
          lineColor: mapPalette.selectedOutline,
          lineWidth: [
            "case",
            ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
            showAllBoundaries ? 2.8 : 2.2,
            0,
          ],
          lineOpacity: [
            "case",
            ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
            APPLE_MAP_THEME.overlay.selectionOutlineOpacity,
            0,
          ],
          lineJoin: "round",
        }}
      />
      <Mapbox.SymbolLayer
        id="queue-boundary-generic-labels"
        filter={showAllBoundaries ? undefined : (selectedBoundaryFilter as any)}
        minZoomLevel={5}
        style={{
          visibility: showLabelLayers ? "visible" : "none",
          textField: labelExpression as any,
          textSize: ["interpolate", ["linear"], ["zoom"], 5, 10, 8, 11, 11, 12, 14, 13],
          textAllowOverlap: showAllBoundaries,
          textIgnorePlacement: showAllBoundaries,
          textFont: ["Noto Sans Regular"],
          textColor: mapPalette.text,
          textHaloColor: mapPalette.surfaceAlt,
          textHaloWidth: 1.2,
          textOpacity: showAllBoundaries ? 1 : 0.86,
        }}
      />
    </Mapbox.ShapeSource>
  );
});
