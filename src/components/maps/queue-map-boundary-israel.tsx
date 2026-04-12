import { memo, useCallback, useMemo } from "react";

import { APPLE_MAP_THEME } from "@/components/maps/queue-map-apple-theme";
import type { getMapBrandPalette } from "@/constants/brand";
import { buildCityFeatureCollectionFromZoneIds } from "@/constants/zones-map";
import type { BoundaryGeometrySource } from "@/features/maps/boundaries/types";
import { FillLayer, GeoJSONSource, LineLayer, SymbolLayer } from "./native-map-sdk";
import { getPressedBoundaryId, useBoundaryTextFieldExpression } from "./queue-map-boundary-shared";
import type { QueueMapProps } from "./queue-map.types";

type Expression = unknown;

type QueueMapBoundaryIsraelProps = {
  mode: QueueMapProps["mode"];
  isEditing: boolean;
  showLabelLayers: boolean;
  selectedBoundaryIds: string[];
  selectedBoundaryFilter: Expression;
  boundarySource: Extract<BoundaryGeometrySource, { kind: "geojson" }>;
  boundaryIdProperty: string;
  boundaryLabelPropertyCandidates: string[];
  /** Live map zoom level; not used by Israel renderer but accepted for interface consistency. */
  currentZoom?: number | undefined;
  mapPalette: ReturnType<typeof getMapBrandPalette>;
  onPressBoundary: ((boundaryId: string) => void) | undefined;
};

export const QueueMapBoundaryIsrael = memo(function QueueMapBoundaryIsrael({
  mode,
  isEditing,
  showLabelLayers,
  selectedBoundaryIds,
  selectedBoundaryFilter,
  boundarySource,
  boundaryIdProperty,
  boundaryLabelPropertyCandidates,
  currentZoom: _currentZoom,
  mapPalette,
  onPressBoundary,
}: QueueMapBoundaryIsraelProps) {
  const handlePress = useCallback(
    (event: unknown) => {
      if (mode !== "zoneSelect" || !isEditing) return;
      if (!onPressBoundary) return;
      const native = (event as { nativeEvent?: unknown } | undefined)?.nativeEvent ?? event;
      const boundaryId = getPressedBoundaryId(native as any, boundaryIdProperty);
      if (!boundaryId) return;
      onPressBoundary(boundaryId);
    },
    [mode, isEditing, onPressBoundary, boundaryIdProperty],
  );

  const showAllBoundaries = mode === "zoneSelect" && isEditing;
  const textFieldExpression = useBoundaryTextFieldExpression(boundaryLabelPropertyCandidates);
  const selectedIsraelCityGeoJson = useMemo(() => {
    if (selectedBoundaryIds.length === 0) return null;
    return buildCityFeatureCollectionFromZoneIds(selectedBoundaryIds);
  }, [selectedBoundaryIds]);

  if (showAllBoundaries) {
    return (
      <GeoJSONSource
        id="queue-boundary-israel-edit-source"
        data={boundarySource.featureCollection}
        onPress={handlePress}
      >
        <FillLayer
          id="queue-boundary-israel-edit-fill"
          paint={{
            "fill-color": mapPalette.primary,
            "fill-opacity": 0.1,
          }}
        />
        <LineLayer
          id="queue-boundary-israel-edit-outline"
          paint={{
            "line-color": mapPalette.selectedOutline,
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              1.1,
              7,
              1.35,
              10,
              1.7,
              14,
              2.1,
            ] as any,
            "line-opacity": 0.96,
          }}
          layout={{
            "line-join": "round",
          }}
        />
        <FillLayer
          id="queue-boundary-israel-edit-selected-fill"
          paint={{
            "fill-color": mapPalette.primary,
            "fill-opacity": [
              "case",
              ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
              0.28,
              0,
            ] as any,
          }}
        />
        <LineLayer
          id="queue-boundary-israel-edit-selected-outline"
          paint={{
            "line-color": mapPalette.selectedOutline,
            "line-width": [
              "case",
              ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
              2.8,
              0,
            ] as any,
            "line-opacity": [
              "case",
              ["in", ["get", boundaryIdProperty], ["literal", selectedBoundaryIds]],
              APPLE_MAP_THEME.overlay.selectionOutlineOpacity,
              0,
            ] as any,
          }}
          layout={{
            "line-join": "round",
          }}
        />
        {showLabelLayers ? (
          <SymbolLayer
            id="queue-boundary-israel-edit-selected-labels"
            filter={selectedBoundaryFilter as any}
            minzoom={6 as any}
            layout={{
              "symbol-placement": "point",
              "text-field": textFieldExpression as any,
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                6,
                10,
                9.5,
                11,
                12,
                13,
                14,
                14,
              ] as any,
              "text-allow-overlap": true,
              "text-ignore-placement": true,
              "text-font": ["literal", ["Noto Sans Regular"]] as any,
            }}
            paint={{
              "text-color": mapPalette.text,
              "text-halo-color": mapPalette.surface,
              "text-halo-width": 1.2,
              "text-opacity": 1,
            }}
          />
        ) : null}
      </GeoJSONSource>
    );
  }

  if (!selectedIsraelCityGeoJson) {
    return null;
  }

  return (
    <GeoJSONSource id="queue-boundary-israel-browse-source" data={selectedIsraelCityGeoJson}>
      <FillLayer
        id="queue-boundary-israel-browse-fill"
        paint={{
          "fill-color": mapPalette.primary,
          "fill-opacity": 0.24,
        }}
      />
      <LineLayer
        id="queue-boundary-israel-browse-outline"
        paint={{
          "line-color": mapPalette.selectedOutline,
          "line-width": 2.2,
          "line-opacity": APPLE_MAP_THEME.overlay.selectionOutlineOpacity,
        }}
        layout={{
          "line-join": "round",
        }}
      />
      {showLabelLayers ? (
        <SymbolLayer
          id="queue-boundary-israel-browse-labels"
          minzoom={5 as any}
          layout={{
            "symbol-placement": "point",
            "text-field": textFieldExpression as any,
            "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 8, 11, 11, 12, 14, 13] as any,
            "text-allow-overlap": false,
            "text-font": ["literal", ["Noto Sans Regular"]] as any,
          }}
          paint={{
            "text-color": mapPalette.text,
            "text-halo-color": mapPalette.surfaceMuted,
            "text-halo-width": 1.1,
            "text-opacity": 0.86,
          }}
        />
      ) : null}
    </GeoJSONSource>
  );
});
