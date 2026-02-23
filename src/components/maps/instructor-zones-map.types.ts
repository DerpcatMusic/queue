export type InstructorZonesMapProps = {
  zoneMode: boolean;
  selectedZoneIds: string[];
  previewZoneIds: string[];
  focusZoneId: string | null;
  onPressZone: (zoneId: string) => void;
  onPressCity?: (zoneIds: string[]) => void;
  onSelectionLevelChange?: (level: "city" | "zone") => void;
  onZoomLevelChange?: (zoomLevel: number) => void;
  userLocation?: { latitude: number; longitude: number } | null;
};
