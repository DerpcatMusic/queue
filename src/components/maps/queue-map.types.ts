import type { FeatureCollection } from "geojson";
import type {
  BoundaryGeometrySource,
  BoundaryViewportTarget,
} from "@/features/maps/boundaries/types";

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
  selectedBoundaryIds?: string[];
  focusBoundaryId?: string | null;
  isEditing?: boolean;
  zoneGeoJson?: FeatureCollection;
  zoneIdProperty?: string;
  boundarySource?: BoundaryGeometrySource;
  boundaryIdProperty?: string;
  boundaryLabelPropertyCandidates?: string[];
  boundaryInteractionBounds?: QueueMapBounds | null;
  focusBoundaryBounds?: QueueMapBounds | null;
  initialBoundaryViewport?: BoundaryViewportTarget | null;
  visibleBounds?: QueueMapBounds | null;
  /** Current map zoom level, updated on each map idle event. */
  currentZoom?: number;
  onPressZone?: (zoneId: string) => void;
  onPressBoundary?: (boundaryId: string) => void;
  onPressMap?: (pin: QueueMapPin) => void;
  onPressStudio?: (studioId: string) => void;
  onUseGps?: () => void;
  showGpsButton?: boolean;
  showAttributionButton?: boolean;
  radiusKm?: number;
  contentInset?: QueueMapViewPadding;
  cameraPadding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  radiusKm?: number;
};
