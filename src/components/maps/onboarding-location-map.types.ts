export type MapPin = {
  latitude: number;
  longitude: number;
};

export type OnboardingLocationMapMode = "instructorZone" | "studioPin";

export type OnboardingLocationMapProps = {
  mode: OnboardingLocationMapMode;
  pin: MapPin | null;
  selectedZoneIds: string[];
  previewZoneIds: string[];
  focusZoneId: string | null;
  onPressMap: (pin: MapPin) => void;
  onPressZone: (zoneId: string) => void;
  onUseGps: () => void;
};
