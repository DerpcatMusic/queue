import {
  FillLayer,
  LineLayer,
  ShapeSource,
  SymbolLayer,
} from "@maplibre/maplibre-react-native";
import { memo, useCallback } from "react";

import { APPLE_MAP_THEME } from "@/components/maps/queue-map-apple-theme";
import type { getMapBrandPalette } from "@/constants/brand";
import { PIKUD_ZONE_GEOJSON } from "@/constants/zones-map";
import type { QueueMapProps } from "./queue-map.types";

type Expression = unknown;

type QueueMapZonePolygonsProps = {
  mode: QueueMapProps["mode"];
  isEditing: boolean;
  showLabelLayers: boolean;
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

  return (
    <ShapeSource
      id="queue-zone-source"
      shape={zoneGeoJson ?? PIKUD_ZONE_GEOJSON}
      onPress={handlePress}
    >
      <FillLayer
        id="queue-zone-touch"
        style={{
          fillColor: mapPalette.previewFill,
          fillOpacity: previewFillOpacity,
        }}
      />
      <LineLayer
        id="queue-zone-outline"
        style={{
          lineColor: mapPalette.zoneOutline,
          lineWidth: [
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
          lineOpacity: previewOutlineOpacity,
          lineJoin: "round",
        }}
      />
      <FillLayer
        id="queue-zone-selected-fill"
        filter={selectedZoneFilter as any}
        style={{
          fillColor: mapPalette.primary,
          fillOpacity: APPLE_MAP_THEME.overlay.selectionFillOpacity,
        }}
      />
      <LineLayer
        id="queue-zone-selected-outline"
        filter={selectedZoneFilter as any}
        style={{
          lineColor: mapPalette.selectedOutline,
          lineWidth: selectedOutlineWidth,
          lineOpacity: selectedOutlineOpacity,
          lineJoin: "round",
        }}
      />
      <SymbolLayer
        id="queue-zone-selected-labels"
        filter={selectedZoneFilter as any}
        minZoomLevel={6}
        style={{
          symbolPlacement: "point",
          textField: [
            "format",
            ["coalesce", ["get", "engName"], ["get", "hebName"], ["get", "id"]],
            {},
          ] as any,
          textSize: ["interpolate", ["linear"], ["zoom"], 6, 10, 9.5, 11, 12, 13, 14, 14] as any,
          textAllowOverlap: true,
          textIgnorePlacement: true,
          textFont: ["literal", ["Noto Sans Regular"]] as any,
          textColor: mapPalette.text,
          textHaloColor: mapPalette.surfaceAlt,
          textHaloWidth: 1.2,
          textOpacity: selectedLabelOpacity,
        }}
      />
      <SymbolLayer
        id="queue-zone-all-labels"
        minZoomLevel={9.5}
        style={{
          symbolPlacement: "point",
          textField: [
            "format",
            ["coalesce", ["get", "engName"], ["get", "hebName"], ["get", "id"]],
            {},
          ] as any,
          textSize: ["interpolate", ["linear"], ["zoom"], 9.5, 10, 11, 12, 14, 14] as any,
          textAllowOverlap: false,
          textFont: ["literal", ["Noto Sans Regular"]] as any,
          textColor: mapPalette.text,
          textHaloColor: mapPalette.surfaceAlt,
          textHaloWidth: 1.1,
          textOpacity: allZonesLabelOpacity,
        }}
      />
    </ShapeSource>
  );
});
