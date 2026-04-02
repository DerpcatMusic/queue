import type { FeatureCollection } from "geojson";

export type QueueMapPin = {
  latitude: number;
  longitude: number;
};

export type StudioMapMarker = {
  studioId: string;
  studioName: string;
  zone: string;
  latitude: number;
  longitude: number;
  address?: string;
  logoImageUrl?: string;
  mapMarkerColor?: string;
};

export type QueueMapBounds = {
  sw: [number, number];
  ne: [number, number];
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
  studios?: StudioMapMarker[];
  selectedStudioId?: string | null;
  selectedZoneIds: string[];
  focusZoneId: string | null;
  isEditing?: boolean;
  zoneGeoJson?: FeatureCollection;
  zoneIdProperty?: string;
  onPressZone?: (zoneId: string) => void;
  onPressMap?: (pin: QueueMapPin) => void;
  onPressStudio?: (studioId: string) => void;
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
