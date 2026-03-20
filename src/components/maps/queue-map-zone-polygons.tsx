import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { memo } from "react";

import { APPLE_MAP_THEME } from "@/components/maps/queue-map-apple-theme";
import type { getMapBrandPalette } from "@/constants/brand";
import { PIKUD_ZONE_GEOJSON } from "@/constants/zones-map";
import type { QueueMapProps } from "./queue-map.types";

type Expression = unknown;

type QueueMapZonePolygonsProps = {
  mode: QueueMapProps["mode"];
  isEditing: boolean;
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
  selectedZoneFilter,
  zoneGeoJson,
  zoneIdProperty,
  mapPalette,
  onPressZone,
}: QueueMapZonePolygonsProps) {
  const showAllZones = mode === "zoneSelect" && isEditing;
  const zoneOutlineWidth = showAllZones
    ? Math.max(APPLE_MAP_THEME.overlay.baseOutlineWidth, 1.35)
    : APPLE_MAP_THEME.overlay.baseOutlineWidth;
  const selectedLabelOpacity = 1;

  return (
    <GeoJSONSource
      id="queue-zone-source"
      data={zoneGeoJson ?? PIKUD_ZONE_GEOJSON}
      onPress={(event: any) => {
        if (mode !== "zoneSelect") return;
        if (!onPressZone) return;
        const native = event?.nativeEvent ?? event;
        const zoneId = getPressedZoneId(native, zoneIdProperty);
        if (!zoneId) return;
        onPressZone(zoneId);
      }}
    >
      {showAllZones ? (
        <>
          <Layer
            id="queue-zone-touch"
            type="fill"
            paint={{
              "fill-color": mapPalette.previewFill,
              "fill-opacity": Math.max(APPLE_MAP_THEME.overlay.touchFillOpacity, 0.1),
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
              "line-opacity": Math.max(APPLE_MAP_THEME.overlay.baseOutlineOpacity, 0.88),
            }}
            layout={{ "line-join": "round" }}
          />
        </>
      ) : null}
      <Layer
        id="queue-zone-selected-fill"
        type="fill"
        filter={selectedZoneFilter as any}
        paint={{
          "fill-color": mapPalette.primary,
          "fill-opacity": APPLE_MAP_THEME.overlay.selectionFillOpacity,
        }}
      />
      <Layer
        id="queue-zone-selected-outline"
        type="line"
        filter={selectedZoneFilter as any}
        paint={{
          "line-color": mapPalette.selectedOutline,
          "line-width": APPLE_MAP_THEME.overlay.selectionOutlineWidth,
          "line-opacity": APPLE_MAP_THEME.overlay.selectionOutlineOpacity,
        }}
        layout={{ "line-join": "round" }}
      />
      <Layer
        id="queue-zone-selected-labels"
        type="symbol"
        filter={selectedZoneFilter as any}
        minzoom={6 as any}
        layout={{
          "symbol-placement": "point",
          "text-field": ["coalesce", ["get", "engName"], ["get", "hebName"], ["get", "id"]] as any,
          "text-size": ["interpolate", ["linear"], ["zoom"], 6, 10, 9.5, 11, 12, 13, 14, 14] as any,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-font": ["Noto Sans Regular"] as any,
        }}
        paint={{
          "text-color": mapPalette.text,
          "text-halo-color": mapPalette.surfaceAlt,
          "text-halo-width": 1.2,
          "text-opacity": selectedLabelOpacity,
        }}
      />
      {showAllZones ? (
        <Layer
          id="queue-zone-all-labels"
          type="symbol"
          minzoom={9.5 as any}
          layout={{
            "symbol-placement": "point",
            "text-field": [
              "coalesce",
              ["get", "engName"],
              ["get", "hebName"],
              ["get", "id"],
            ] as any,
            "text-size": ["interpolate", ["linear"], ["zoom"], 9.5, 10, 11, 12, 14, 14] as any,
            "text-allow-overlap": false,
            "text-font": ["Noto Sans Regular"] as any,
          }}
          paint={{
            "text-color": mapPalette.text,
            "text-halo-color": mapPalette.surfaceAlt,
            "text-halo-width": 1.1,
            "text-opacity": 0.92,
          }}
        />
      ) : null}
    </GeoJSONSource>
  );
});
