import type { FeatureCollection } from "geojson";

export type QueueMapPin = {
  latitude: number;
  longitude: number;
};

export type QueueMapMode = "zoneSelect" | "pinDrop";

export type QueueMapProps = {
  mode: QueueMapMode;
  pin: QueueMapPin | null;
  selectedZoneIds: string[];
  focusZoneId: string | null;
  zoneGeoJson?: FeatureCollection;
  zoneIdProperty?: string;
  onPressZone?: (zoneId: string) => void;
  onPressMap?: (pin: QueueMapPin) => void;
  onUseGps?: () => void;
  showGpsButton?: boolean;
};

