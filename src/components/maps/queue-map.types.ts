import type { FeatureCollection } from "geojson";

export type QueueMapPin = {
  latitude: number;
  longitude: number;
};

/** A studio shown as a marker on the map with its logo avatar. */
export type StudioMarker = {
  studioId: string;
  studioName: string;
  latitude: number;
  longitude: number;
  profileImageUrl?: string;
  sport?: string;
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
  studios?: StudioMarker[];
  onPressStudio?: (studioId: string) => void;
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
