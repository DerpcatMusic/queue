import { useMemo } from "react";

export type BoundaryPressEvent = {
  nativeEvent?: unknown;
  features?: { properties?: Record<string, unknown>; id?: unknown }[];
  payload?: {
    features?: { properties?: Record<string, unknown>; id?: unknown }[];
  };
  properties?: Record<string, unknown>;
  id?: unknown;
};

export function getPressedBoundaryId(event: BoundaryPressEvent, propertyName: string) {
  const candidates = [
    event,
    event.nativeEvent as BoundaryPressEvent | undefined,
    event.payload as BoundaryPressEvent | undefined,
    (event.nativeEvent as BoundaryPressEvent | undefined)?.payload,
  ].filter(Boolean) as BoundaryPressEvent[];

  for (const candidate of candidates) {
    const feature = candidate.features?.[0] ?? candidate.payload?.features?.[0];
    const directValue = candidate.properties?.[propertyName];
    const nestedValue = feature?.properties?.[propertyName];
    const featureId = feature?.id ?? candidate.id;
    const resolved = nestedValue ?? directValue ?? featureId;
    if (typeof resolved === "string" && resolved.trim().length > 0) {
      return resolved;
    }
    if (typeof resolved === "number" && Number.isFinite(resolved)) {
      return String(resolved);
    }
  }

  return null;
}

export function useBoundaryTextFieldExpression(propertyCandidates: string[]) {
  return useMemo(() => {
    const fallbackCandidates =
      propertyCandidates.length > 0
        ? propertyCandidates
        : ["engName", "hebName", "name", "postcode", "city", "id"];
    const getExpressions = fallbackCandidates.map((propertyName) => ["get", propertyName]);
    return ["format", ["coalesce", ...getExpressions], {}] as const;
  }, [propertyCandidates]);
}
