export type InstructorZonesMapProps = {
  zoneMode: boolean;
  selectedZoneIds: string[];
  previewZoneIds: string[];
  focusZoneId: string | null;
  onPressZone: (zoneId: string) => void;
};
