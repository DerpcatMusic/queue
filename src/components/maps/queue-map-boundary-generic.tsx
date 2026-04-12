import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { getMapBrandPalette } from "@/constants/brand";
import type { BoundaryGeometrySource, BoundaryZoomTier } from "@/features/maps/boundaries/types";
import { FillLayer, GeoJSONSource, LineLayer, SymbolLayer, VectorSource } from "./native-map-sdk";
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
  /** Live map zoom level used for zoom-tier selection. */
  currentZoom?: number | undefined;
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

/**
 * Selects the active BoundaryZoomTier for the given zoom level.
 * Tiers are evaluated in order (assumed most-coarse first to most-fine last);
 * the first tier whose [minZoom, maxZoom] range contains `zoom` is returned.
 * Returns null when no tiers are declared (caller should render at all zoom).
 */
function selectZoomTier(
  tiers: BoundaryZoomTier[] | undefined,
  zoom: number | undefined,
): BoundaryZoomTier | null {
  if (!tiers || tiers.length === 0) return null;
  const orderedTiers = [...tiers].sort((left, right) => left.minZoom - right.minZoom);

  // If zoom is unknown (map not ready), use the coarsest tier (first).
  if (zoom === undefined) return orderedTiers[0] ?? null;

  for (const tier of orderedTiers) {
    if (zoom >= tier.minZoom && zoom <= tier.maxZoom) {
      return tier;
    }
  }

  // Safety fallback: if tiers have gaps, choose the nearest tier instead of
  // rendering nothing. This avoids an accidental blank map when an env config
  // is slightly off.
  let closestTier: BoundaryZoomTier | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const tier of orderedTiers) {
    const distance =
      zoom < tier.minZoom ? tier.minZoom - zoom : zoom > tier.maxZoom ? zoom - tier.maxZoom : 0;
    if (distance < closestDistance) {
      closestDistance = distance;
      closestTier = tier;
    }
  }
  return closestTier;
}

/**
 * Returns the effective sourceLayer for a tier, falling back to the
 * source's top-level sourceLayer when the tier doesn't override it.
 */
function effectiveSourceLayer(tier: BoundaryZoomTier | null, defaultSourceLayer: string): string {
  return tier?.sourceLayer ?? defaultSourceLayer;
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
  currentZoom,
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

  const showAll = mode === "zoneSelect" && isEditing;

  const [remoteFeatureCollection, setRemoteFeatureCollection] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const remoteRequestKeyRef = useRef<string | null>(null);

  // ── Zoom-tier resolution (all hooks at top to satisfy React rules-of-hooks) ──
  const activeTier = useMemo(
    () => selectZoomTier(boundarySource.zoomTiers, currentZoom),
    [boundarySource.zoomTiers, currentZoom],
  );

  const hiddenByTier = useMemo(() => {
    if (!boundarySource.zoomTiers || boundarySource.zoomTiers.length === 0) {
      return false;
    }
    return activeTier === null;
  }, [boundarySource.zoomTiers, activeTier]);

  // ── Remote GeoJSON data fetching ──────────────────────────────────────────
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

  const labelExpression = useMemo(() => {
    const candidates = boundaryLabelPropertyCandidates ?? ["name", "id"];
    if (candidates.length === 0) return "";
    if (candidates.length === 1) return ["coalesce", ["get", candidates[0]], ""] as any;
    return ["coalesce", ...candidates.map((c) => ["get", c]), ""] as any;
  }, [boundaryLabelPropertyCandidates]);

  // ── Shared style values ──
  const baseFillColor = mapPalette.selectedOutline;
  const outlineColor = mapPalette.selectedOutline;
  const selectedFillColor = mapPalette.primary;

  const baseFillOpacity = showAll ? 0.25 : 0;
  const baseOutlineWidth = showAll
    ? (["interpolate", ["linear"], ["zoom"], 4, 1.1, 7, 1.35, 10, 1.7, 14, 2.1] as any)
    : 0;
  const baseOutlineOpacity = showAll ? 0.96 : 0;
  const selectedFillOpacity = [
    "case",
    ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
    0.45,
    0,
  ] as any;
  const selectedOutlineWidth = [
    "case",
    ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
    3,
    0,
  ] as any;
  const selectedOutlineOpacity = [
    "case",
    ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
    1,
    0,
  ] as any;

  // Label minzoom is driven by the active tier when tiers are declared,
  // otherwise defaults to 5 (preserving existing behaviour).
  const labelMinZoom = activeTier?.minZoom ?? 5;

  // Effective sourceLayer for vector-tile sources with zoom tiers.
  const effectiveSourceLayerForTier = useMemo(
    () =>
      effectiveSourceLayer(
        activeTier,
        boundarySource.kind === "vectorTiles" ? boundarySource.sourceLayer : "",
      ),
    [activeTier, boundarySource],
  );

  // ── Early exit when zoom is outside all declared tiers ─────────────────
  if (hiddenByTier) return null;

  // ─── Vector tiles source ───
  if (boundarySource.kind === "vectorTiles") {
    // For zoom-tiered vector sources, a single VectorSource can serve multiple
    // layers at different zoom levels via sourceLayer prop + minzoom/maxzoom.
    return (
      <VectorSource
        id="queue-boundary-generic-vector"
        {...(boundarySource.tilesetUrl ? { url: boundarySource.tilesetUrl } : {})}
        {...(boundarySource.tileUrlTemplates
          ? { tileUrlTemplates: boundarySource.tileUrlTemplates }
          : {})}
        onPress={handlePress as any}
      >
        <FillLayer
          id="queue-boundary-generic-base-fill"
          sourceLayer={effectiveSourceLayerForTier}
          {...(activeTier ? { minzoom: activeTier.minZoom, maxzoom: activeTier.maxZoom } : {})}
          paint={{
            "fill-color": baseFillColor,
            "fill-opacity": baseFillOpacity,
          }}
        />
        <LineLayer
          id="queue-boundary-generic-base-outline"
          sourceLayer={effectiveSourceLayerForTier}
          {...(activeTier ? { minzoom: activeTier.minZoom, maxzoom: activeTier.maxZoom } : {})}
          paint={{
            "line-color": outlineColor,
            "line-width": baseOutlineWidth,
            "line-opacity": baseOutlineOpacity,
          }}
          layout={{
            "line-join": "round",
          }}
        />
        <FillLayer
          id="queue-boundary-generic-selected-fill"
          sourceLayer={effectiveSourceLayerForTier}
          {...(activeTier ? { minzoom: activeTier.minZoom, maxzoom: activeTier.maxZoom } : {})}
          paint={{
            "fill-color": selectedFillColor,
            "fill-opacity": selectedFillOpacity,
          }}
        />
        <LineLayer
          id="queue-boundary-generic-selected-outline"
          sourceLayer={effectiveSourceLayerForTier}
          {...(activeTier ? { minzoom: activeTier.minZoom, maxzoom: activeTier.maxZoom } : {})}
          paint={{
            "line-color": outlineColor,
            "line-width": selectedOutlineWidth,
            "line-opacity": selectedOutlineOpacity,
          }}
          layout={{
            "line-join": "round",
          }}
        />
        {showLabelLayers ? (
          <SymbolLayer
            id="queue-boundary-generic-labels"
            sourceLayer={effectiveSourceLayerForTier}
            filter={showAll ? undefined : (selectedBoundaryFilter as any)}
            minzoom={labelMinZoom}
            {...(activeTier ? { maxzoom: activeTier.maxZoom } : {})}
            layout={{
              "symbol-placement": "point",
              "text-field": labelExpression as any,
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                5,
                10,
                8,
                11,
                11,
                12,
                14,
                13,
              ] as any,
              "text-allow-overlap": showAll,
              "text-ignore-placement": showAll,
              "text-font": ["literal", ["Noto Sans Regular"]] as any,
            }}
            paint={{
              "text-color": mapPalette.text,
              "text-halo-color": mapPalette.surface,
              "text-halo-width": 1.2,
              "text-opacity": showAll ? 1 : 0.86,
            }}
          />
        ) : null}
      </VectorSource>
    );
  }

  // ─── Remote GeoJSON source ───
  if (boundarySource.kind === "remoteGeojson") {
    if (!sourceData) return null;
    return (
      <GeoJSONSource
        id="queue-boundary-generic-remote"
        data={sourceData}
        onPress={handlePress as any}
      >
        <FillLayer
          id="queue-boundary-generic-base-fill"
          paint={{
            "fill-color": baseFillColor,
            "fill-opacity": baseFillOpacity,
          }}
        />
        <LineLayer
          id="queue-boundary-generic-base-outline"
          paint={{
            "line-color": outlineColor,
            "line-width": baseOutlineWidth,
            "line-opacity": baseOutlineOpacity,
          }}
          layout={{
            "line-join": "round",
          }}
        />
        <FillLayer
          id="queue-boundary-generic-selected-fill"
          paint={{
            "fill-color": selectedFillColor,
            "fill-opacity": selectedFillOpacity,
          }}
        />
        <LineLayer
          id="queue-boundary-generic-selected-outline"
          paint={{
            "line-color": outlineColor,
            "line-width": selectedOutlineWidth,
            "line-opacity": selectedOutlineOpacity,
          }}
          layout={{
            "line-join": "round",
          }}
        />
        {showLabelLayers ? (
          <SymbolLayer
            id="queue-boundary-generic-labels"
            filter={showAll ? undefined : (selectedBoundaryFilter as any)}
            minzoom={labelMinZoom}
            {...(activeTier ? { maxzoom: activeTier.maxZoom } : {})}
            layout={{
              "symbol-placement": "point",
              "text-field": labelExpression as any,
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                5,
                10,
                8,
                11,
                11,
                12,
                14,
                13,
              ] as any,
              "text-allow-overlap": showAll,
              "text-ignore-placement": showAll,
              "text-font": ["literal", ["Noto Sans Regular"]] as any,
            }}
            paint={{
              "text-color": mapPalette.text,
              "text-halo-color": mapPalette.surface,
              "text-halo-width": 1.2,
              "text-opacity": showAll ? 1 : 0.86,
            }}
          />
        ) : null}
      </GeoJSONSource>
    );
  }

  // ─── Inline GeoJSON source (bundled data — London boroughs etc.) ───
  return (
    <GeoJSONSource
      id="queue-boundary-generic-geojson"
      data={boundarySource.featureCollection}
      onPress={handlePress as any}
    >
      <FillLayer
        id="queue-boundary-generic-base-fill"
        paint={{
          "fill-color": baseFillColor,
          "fill-opacity": baseFillOpacity,
        }}
      />
      <LineLayer
        id="queue-boundary-generic-base-outline"
        paint={{
          "line-color": outlineColor,
          "line-width": baseOutlineWidth,
          "line-opacity": baseOutlineOpacity,
        }}
        layout={{
          "line-join": "round",
        }}
      />
      <FillLayer
        id="queue-boundary-generic-selected-fill"
        paint={{
          "fill-color": selectedFillColor,
          "fill-opacity": selectedFillOpacity,
        }}
      />
      <LineLayer
        id="queue-boundary-generic-selected-outline"
        paint={{
          "line-color": outlineColor,
          "line-width": selectedOutlineWidth,
          "line-opacity": selectedOutlineOpacity,
        }}
        layout={{
          "line-join": "round",
        }}
      />
      {showLabelLayers ? (
        <SymbolLayer
          id="queue-boundary-generic-labels"
          filter={showAll ? undefined : (selectedBoundaryFilter as any)}
          minzoom={labelMinZoom}
          {...(activeTier ? { maxzoom: activeTier.maxZoom } : {})}
          layout={{
            "symbol-placement": "point",
            "text-field": labelExpression as any,
            "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 8, 11, 11, 12, 14, 13] as any,
            "text-allow-overlap": showAll,
            "text-ignore-placement": showAll,
            "text-font": ["literal", ["Noto Sans Regular"]] as any,
          }}
          paint={{
            "text-color": mapPalette.text,
            "text-halo-color": mapPalette.surface,
            "text-halo-width": 1.2,
            "text-opacity": showAll ? 1 : 0.86,
          }}
        />
      ) : null}
    </GeoJSONSource>
  );
});
