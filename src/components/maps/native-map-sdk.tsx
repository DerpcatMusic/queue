import type React from "react";

type GenericLayerProps = {
  id: string;
  filter?: unknown;
  minzoom?: number;
  maxzoom?: number;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  sourceLayer?: string;
  sourceID?: string;
  sourceLayerID?: string;
  aboveLayerID?: string;
  belowLayerID?: string;
  layerIndex?: number;
  children?: React.ReactNode;
};

export type MapRef = {
  getBounds: () => Promise<[number, number, number, number]>;
  getZoom: () => Promise<number>;
  showAttribution: () => void;
};

export type CameraRef = {
  fitBounds: (
    bounds: [number, number, number, number],
    options?: {
      padding?: { top: number; right: number; bottom: number; left: number };
      duration?: number;
      easing?: string;
    },
  ) => void;
  flyTo: (coordinates: [number, number], animationDuration?: number) => void;
  zoomTo: (zoomLevel: number, animationDuration?: number) => void;
};

function createNoopComponent<TProps>() {
  return function NoopComponent(_props: TProps) {
    return null;
  };
}

export const MapView = createNoopComponent<Record<string, unknown>>();
export const Camera = createNoopComponent<Record<string, unknown>>();
export const GeoJSONSource = createNoopComponent<Record<string, unknown>>();
export const VectorSource = createNoopComponent<Record<string, unknown>>();
export const Marker = createNoopComponent<Record<string, unknown>>();
export const Images = createNoopComponent<Record<string, unknown>>();
export const StyleImport = createNoopComponent<Record<string, unknown>>();
export const FillLayer = createNoopComponent<GenericLayerProps>();
export const LineLayer = createNoopComponent<GenericLayerProps>();
export const SymbolLayer = createNoopComponent<GenericLayerProps>();
export const CircleLayer = createNoopComponent<GenericLayerProps>();
export const StyleURL = {
  Light: "mapbox://styles/mapbox/light-v10",
  Dark: "mapbox://styles/mapbox/dark-v10",
} as const;

export const OfflineManager = {
  async getPacks() {
    return [] as Array<{ metadata?: Record<string, unknown> }>;
  },
  setProgressEventThrottle(_throttleValue: number) {},
  async createPack(
    _options: Record<string, unknown>,
    _progressListener: () => void,
    _errorListener?: () => void,
  ) {},
};

export function LayerGroup({ children }: { children: React.ReactNode }) {
  return children ?? null;
}
