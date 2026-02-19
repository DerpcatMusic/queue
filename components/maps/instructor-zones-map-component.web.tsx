import type { InstructorZonesMapProps } from "./instructor-zones-map.types";
import { ZonesMapWebBase } from "./zones-map-web-base";

export function InstructorZonesMap({
  zoneMode,
  selectedZoneIds,
  previewZoneIds,
  focusZoneId,
  onPressZone,
}: InstructorZonesMapProps) {
  return (
    <ZonesMapWebBase
      selectionEnabled={zoneMode}
      selectedZoneIds={selectedZoneIds}
      previewZoneIds={previewZoneIds}
      focusZoneId={focusZoneId}
      onPressZone={onPressZone}
      minHeight={520}
    />
  );
}
