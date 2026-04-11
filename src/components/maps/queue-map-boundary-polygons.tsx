import { memo } from "react";

import type { getMapBrandPalette } from "@/constants/brand";
import type { BoundaryGeometrySource } from "@/features/maps/boundaries/types";
import { QueueMapBoundaryGeneric } from "./queue-map-boundary-generic";
import { QueueMapBoundaryIsrael } from "./queue-map-boundary-israel";
import type { QueueMapProps } from "./queue-map.types";

type Expression = unknown;

type QueueMapBoundaryPolygonsProps = {
  mode: QueueMapProps["mode"];
  isEditing: boolean;
  showLabelLayers: boolean;
  selectedBoundaryIds: string[];
  selectedBoundaryFilter: Expression;
  boundarySource: BoundaryGeometrySource | undefined;
  boundaryIdProperty: string;
  boundaryLabelPropertyCandidates: string[];
  visibleBounds?: QueueMapProps["visibleBounds"];
  /** Live map zoom level used for zoom-tier selection. */
  currentZoom?: number | undefined;
  mapPalette: ReturnType<typeof getMapBrandPalette>;
  onPressBoundary: ((boundaryId: string) => void) | undefined;
};

function isLegacyIsraelZoneSource(boundarySource: BoundaryGeometrySource | undefined) {
  if (!boundarySource || boundarySource.kind !== "geojson") {
    return false;
  }

  if (boundarySource.idProperty !== "id") {
    return false;
  }

  const firstFeature = boundarySource.featureCollection.features?.[0];
  const properties = firstFeature?.properties ?? {};
  return "hebName" in properties || "engName" in properties || "cityHeb" in properties;
}

export const QueueMapBoundaryPolygons = memo(function QueueMapBoundaryPolygons(
  props: QueueMapBoundaryPolygonsProps,
) {
  const { boundarySource } = props;
  if (!boundarySource) {
    return null;
  }

  if (isLegacyIsraelZoneSource(boundarySource)) {
    return (
      <QueueMapBoundaryIsrael
        {...props}
        boundarySource={boundarySource as Extract<BoundaryGeometrySource, { kind: "geojson" }>}
      />
    );
  }

  return (
    <QueueMapBoundaryGeneric
      {...props}
      boundarySource={boundarySource}
      currentZoom={props.currentZoom}
    />
  );
});
