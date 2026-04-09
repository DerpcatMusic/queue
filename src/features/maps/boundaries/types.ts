import type { FeatureCollection, Geometry } from "geojson";

export type BoundaryId = string;

export type BoundaryGeometrySource =
  | {
      kind: "geojson";
      featureCollection: FeatureCollection;
      idProperty: string;
    }
  | {
      kind: "remoteGeojson";
      sourceId: string;
      idProperty: string;
      loadFeatureCollection: (args: {
        bbox: {
          sw: [number, number];
          ne: [number, number];
        } | null;
        signal?: AbortSignal;
      }) => Promise<FeatureCollection>;
    }
  | {
      kind: "vectorTiles";
      sourceId: string;
      sourceLayer: string;
      tilesetUrl?: string;
      tileUrlTemplates?: string[];
      promoteId?: string;
      worldview?: string;
    };

export type BoundaryFeatureProperties = {
  id: BoundaryId;
  name: string;
  countryCode: string;
  postcode?: string;
  city?: string;
  parentId?: BoundaryId;
  worldview?: string;
  source?: string;
};

export type BoundaryFeatureCollection = FeatureCollection<Geometry, BoundaryFeatureProperties>;

export type BoundaryViewportTarget = {
  countryCode?: string;
  bbox?: {
    sw: [number, number];
    ne: [number, number];
  };
  zoom?: number;
};

export type ResolvedBoundary = {
  boundaryId: BoundaryId;
  boundaryName: string;
  countryCode: string;
  postcode?: string;
  city?: string;
};

export type BoundarySelectionMode = "polygon" | "postcode" | "search" | "mixed";

export type BoundaryProviderCapabilities = {
  supportsPolygonSelection: boolean;
  supportsPostcodeSelection: boolean;
  supportsSearch: boolean;
  supportsGpsResolution: boolean;
  supportsVectorTiles: boolean;
  supportsOffline?: boolean;
};

export type BoundarySelectionStorageMode = "legacyZones" | "boundaries";

export type BoundaryProviderDefinition = {
  id: string;
  label: string;
  countryCode?: string;
  geometry: BoundaryGeometrySource;
  capabilities: BoundaryProviderCapabilities;
  selectionMode: BoundarySelectionMode;
  selectionStorage: BoundarySelectionStorageMode;
  viewport?: BoundaryViewportTarget;
  interactionBounds?: BoundaryViewportTarget["bbox"];
  labelPropertyCandidates?: string[];
};
