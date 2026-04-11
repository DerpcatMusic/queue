import type { FeatureCollection, Geometry } from "geojson";

/**
 * Describes a single zoom-aware rendering tier for a boundary geometry source.
 * Tiers are evaluated from most-coarse (lowest minZoom) to most-fine (highest
 * minZoom); the first tier whose [minZoom, maxZoom] range contains the
 * current map zoom is selected.  If no tiers are declared the source renders
 * at all zoom levels.
 */
export type BoundaryZoomTier = {
  /** Unique identifier for this tier (e.g. "coarse", "fine", "streets"). */
  tierId: string;
  /** Inclusive minimum zoom at which this tier is active. */
  minZoom: number;
  /** Inclusive maximum zoom at which this tier is active. */
  maxZoom: number;
  /**
   * For vector-tile sources: which sourceLayer to render at this tier.
   * If omitted the source's top-level sourceLayer is used.
   */
  sourceLayer?: string;
};

export type BoundaryId = string;

export type BoundaryGeometrySource =
  | {
      kind: "geojson";
      featureCollection: FeatureCollection;
      idProperty: string;
      /**
       * Optional zoom-aware rendering tiers.  If not provided the GeoJSON
       * renders at all zoom levels.  When tiers are declared the renderer
       * selects the first matching tier based on current map zoom.
       */
      zoomTiers?: BoundaryZoomTier[];
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
      /** Optional zoom-aware rendering tiers. */
      zoomTiers?: BoundaryZoomTier[];
    }
  | {
      kind: "vectorTiles";
      sourceId: string;
      sourceLayer: string;
      tilesetUrl?: string;
      tileUrlTemplates?: string[];
      promoteId?: string;
      worldview?: string;
      /**
       * Optional zoom-aware rendering tiers.  Allows a single VectorSource
       * to serve multiple source layers at different zoom levels (e.g.
       * coarse boundaries at z0-8, fine boundaries at z9+).
       */
      zoomTiers?: BoundaryZoomTier[];
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
