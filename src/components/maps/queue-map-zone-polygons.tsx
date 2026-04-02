import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { memo, useCallback, useMemo } from "react";

import { APPLE_MAP_THEME } from "@/components/maps/queue-map-apple-theme";
import type { getMapBrandPalette } from "@/constants/brand";
import { PIKUD_ZONE_GEOJSON } from "@/constants/zones-map";
import type { QueueMapProps } from "./queue-map.types";

type Expression = unknown;

type QueueMapZonePolygonsProps = {
  mode: QueueMapProps["mode"];
  isEditing: boolean;
  showLabelLayers: boolean;
  selectedZoneIds: QueueMapProps["selectedZoneIds"];
  selectedZoneFilter: Expression;
  zoneGeoJson: QueueMapProps["zoneGeoJson"];
  zoneIdProperty: string;
  mapPalette: ReturnType<typeof getMapBrandPalette>;
  onPressZone: ((zoneId: string) => void) | undefined;
};

function getPressedZoneId(
  event: { features?: { properties?: Record<string, unknown> }[] },
  propertyName: string,
) {
  const value = event.features?.[0]?.properties?.[propertyName];
  return typeof value === "string" ? value : null;
}

export const QueueMapZonePolygons = memo(function QueueMapZonePolygons({
  mode,
  isEditing,
  showLabelLayers,
  selectedZoneIds,
  selectedZoneFilter,
  zoneGeoJson,
  zoneIdProperty,
  mapPalette,
  onPressZone,
}: QueueMapZonePolygonsProps) {
  // Stable press handler — extracted to avoid inline arrow recreation on every render
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePress = useCallback(
    (event: any) => {
      if (mode !== "zoneSelect" || !isEditing) return;
      if (!onPressZone) return;
      const native = event?.nativeEvent ?? event;
      const zoneId = getPressedZoneId(native, zoneIdProperty);
      if (!zoneId) return;
      onPressZone(zoneId);
    },
    [mode, isEditing, onPressZone, zoneIdProperty],
  );

  const showAllZones = mode === "zoneSelect" && isEditing;
  const zoneOutlineWidth = showAllZones
    ? Math.max(APPLE_MAP_THEME.overlay.baseOutlineWidth, 1.35)
    : APPLE_MAP_THEME.overlay.baseOutlineWidth;
  const selectedLabelOpacity = showLabelLayers ? 1 : 0;
  const previewFillOpacity = showAllZones
    ? Math.max(APPLE_MAP_THEME.overlay.touchFillOpacity, 0.1)
    : 0;
  const previewOutlineOpacity = showAllZones
    ? Math.max(APPLE_MAP_THEME.overlay.baseOutlineOpacity, 0.72)
    : 0;
  const allZonesLabelOpacity = showAllZones && showLabelLayers ? 0.78 : 0;
  const selectedOutlineOpacity = Math.min(APPLE_MAP_THEME.overlay.selectionOutlineOpacity, 0.82);
  const selectedOutlineWidth = Math.max(APPLE_MAP_THEME.overlay.selectionOutlineWidth - 0.35, 1.4);
  const selectionTransition = useMemo(
    () => ({
      duration: APPLE_MAP_THEME.overlay.selectionTransitionDuration,
      delay: 0,
    }),
    [],
  );
  const selectedZoneIdsLiteral = useMemo(() => ["literal", selectedZoneIds] as const, [selectedZoneIds]);
  const isSelectedExpression = useMemo(
    () => ["in", ["get", zoneIdProperty], selectedZoneIdsLiteral] as const,
    [selectedZoneIdsLiteral, zoneIdProperty],
  );
  const selectedFillOpacityExpression = useMemo(
    () => ["case", isSelectedExpression, APPLE_MAP_THEME.overlay.selectionFillOpacity, 0] as const,
    [isSelectedExpression],
  );
  const selectedOutlineOpacityExpression = useMemo(
    () => ["case", isSelectedExpression, selectedOutlineOpacity, 0] as const,
    [isSelectedExpression, selectedOutlineOpacity],
  );
  const selectedOutlineWidthExpression = useMemo(
    () => ["case", isSelectedExpression, selectedOutlineWidth, 0.6] as const,
    [isSelectedExpression, selectedOutlineWidth],
  );

  return (
    <GeoJSONSource
      id="queue-zone-source"
      data={zoneGeoJson ?? PIKUD_ZONE_GEOJSON}
      onPress={handlePress}
    >
      <Layer
        id="queue-zone-touch"
        type="fill"
        paint={{
          "fill-color": mapPalette.previewFill,
          "fill-opacity": previewFillOpacity,
        }}
      />
      <Layer
        id="queue-zone-outline"
        type="line"
        paint={{
          "line-color": mapPalette.zoneOutline,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            Math.max(1, zoneOutlineWidth * 0.85),
            10,
            zoneOutlineWidth,
            14,
            zoneOutlineWidth * 1.2,
          ] as any,
          "line-opacity": previewOutlineOpacity,
        }}
        layout={{
          "line-join": "round",
        }}
      />
      <Layer
        id="queue-zone-selected-fill"
        type="fill"
        paint={{
          "fill-color": mapPalette.primary,
          "fill-opacity": selectedFillOpacityExpression as any,
          "fill-opacity-transition": selectionTransition as any,
          "fill-color-transition": selectionTransition as any,
        }}
      />
      <Layer
        id="queue-zone-selected-outline"
        type="line"
        paint={{
          "line-color": mapPalette.selectedOutline,
          "line-width": selectedOutlineWidthExpression as any,
          "line-opacity": selectedOutlineOpacityExpression as any,
          "line-opacity-transition": selectionTransition as any,
          "line-color-transition": selectionTransition as any,
          "line-width-transition": selectionTransition as any,
        }}
        layout={{
          "line-join": "round",
        }}
      />
      <Layer
        id="queue-zone-selected-labels"
        type="symbol"
        filter={selectedZoneFilter as any}
        minzoom={6 as any}
        layout={{
          "symbol-placement": "point",
          "text-field": [
            "format",
            ["coalesce", ["get", "engName"], ["get", "hebName"], ["get", "id"]],
            {},
          ] as any,
          "text-size": ["interpolate", ["linear"], ["zoom"], 6, 10, 9.5, 11, 12, 13, 14, 14] as any,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-font": ["literal", ["Noto Sans Regular"]] as any,
        }}
        paint={{
          "text-color": mapPalette.text,
          "text-halo-color": mapPalette.surfaceAlt,
          "text-halo-width": 1.2,
          "text-opacity": selectedLabelOpacity,
        }}
      />
      <Layer
        id="queue-zone-all-labels"
        type="symbol"
        minzoom={9.5 as any}
        layout={{
          "symbol-placement": "point",
          "text-field": [
            "format",
            ["coalesce", ["get", "engName"], ["get", "hebName"], ["get", "id"]],
            {},
          ] as any,
          "text-size": ["interpolate", ["linear"], ["zoom"], 9.5, 10, 11, 12, 14, 14] as any,
          "text-allow-overlap": false,
          "text-font": ["literal", ["Noto Sans Regular"]] as any,
        }}
        paint={{
          "text-color": mapPalette.text,
          "text-halo-color": mapPalette.surfaceAlt,
          "text-halo-width": 1.1,
          "text-opacity": allZonesLabelOpacity,
        }}
      />
    </GeoJSONSource>
  );
});
