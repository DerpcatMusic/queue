import type { FeatureCollection } from "geojson";

export type QueueMapPin = {
  latitude: number;
  longitude: number;
};

export type QueueMapMode = "zoneSelect" | "pinDrop";

export type QueueMapViewPadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type QueueMapProps = {
  mode: QueueMapMode;
  pin: QueueMapPin | null;
  selectedZoneIds: string[];
  focusZoneId: string | null;
  isEditing?: boolean;
  zoneGeoJson?: FeatureCollection;
  zoneIdProperty?: string;
  onPressZone?: (zoneId: string) => void;
  onPressMap?: (pin: QueueMapPin) => void;
  onUseGps?: () => void;
  showGpsButton?: boolean;
  showAttributionButton?: boolean;
  contentInset?: QueueMapViewPadding;
  cameraPadding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
};
