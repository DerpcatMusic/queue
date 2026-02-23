import type { InstructorZonesMapProps } from "./instructor-zones-map.types";
import { ZonesMapWebBase } from "./zones-map-web-base";

export function InstructorZonesMap({
  zoneMode,
  selectedZoneIds,
  previewZoneIds,
  focusZoneId,
  onPressZone,
  onPressCity,
  onSelectionLevelChange,
  onZoomLevelChange,
  userLocation,
}: InstructorZonesMapProps) {
  return (
    <ZonesMapWebBase
      selectionEnabled={zoneMode}
      selectedZoneIds={selectedZoneIds}
      previewZoneIds={previewZoneIds}
      focusZoneId={focusZoneId}
      onPressZone={onPressZone}
      {...(onPressCity ? { onPressCity } : {})}
      {...(onSelectionLevelChange ? { onSelectionLevelChange } : {})}
      {...(onZoomLevelChange ? { onZoomLevelChange } : {})}
      userLocation={userLocation}
      minHeight={520}
    />
  );
}
