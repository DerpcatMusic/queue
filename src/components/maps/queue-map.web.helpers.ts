import {
  getSelectableBoundary,
  SELECTABLE_BOUNDARY_OPTIONS,
} from "@/features/maps/boundaries/catalog";

export type CoverageSlot = {
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: number;
};

export type CoverageNode = CoverageSlot & {
  zoneId: string;
  label: string;
  seconds: number;
  selected: boolean;
  focused: boolean;
};

const COVERAGE_SLOTS: readonly CoverageSlot[] = [
  { left: 5, top: 10, width: 24, height: 16, rotate: -7 },
  { left: 33, top: 8, width: 22, height: 14, rotate: 4 },
  { left: 60, top: 12, width: 19, height: 18, rotate: -4 },
  { left: 72, top: 35, width: 20, height: 16, rotate: 6 },
  { left: 49, top: 34, width: 18, height: 14, rotate: -7 },
  { left: 22, top: 31, width: 21, height: 16, rotate: 5 },
  { left: 8, top: 50, width: 19, height: 15, rotate: -5 },
  { left: 31, top: 56, width: 22, height: 15, rotate: 7 },
  { left: 57, top: 57, width: 18, height: 14, rotate: -3 },
  { left: 74, top: 67, width: 16, height: 12, rotate: 5 },
  { left: 47, top: 75, width: 23, height: 12, rotate: -6 },
  { left: 16, top: 73, width: 22, height: 12, rotate: 4 },
] as const;

export function getZone(zoneId: string) {
  return getSelectableBoundary(zoneId);
}

export function buildCoverageNodes(
  selectedZoneIds: string[],
  focusZoneId: string | null,
): CoverageNode[] {
  const selectedSet = new Set(selectedZoneIds);
  const orderedSelected = selectedZoneIds
    .map((zoneId) => getZone(zoneId))
    .filter((zone): zone is NonNullable<typeof zone> => Boolean(zone));
  const focusIndex = orderedSelected.findIndex((zone) => zone.id === focusZoneId);
  if (focusIndex > 0) {
    const focusedZone = orderedSelected[focusIndex];
    if (focusedZone === undefined) return [];
    orderedSelected.splice(focusIndex, 1);
    orderedSelected.unshift(focusedZone);
  }
  const previewZones = SELECTABLE_BOUNDARY_OPTIONS.filter((zone) => !selectedSet.has(zone.id)).slice(
    0,
    Math.max(0, COVERAGE_SLOTS.length - orderedSelected.length),
  );
  const visibleZones = [...orderedSelected, ...previewZones].slice(0, COVERAGE_SLOTS.length);

  return visibleZones.reduce<CoverageNode[]>((nodes, zone, index) => {
    const slot = COVERAGE_SLOTS[index];
    if (!slot) return nodes;
    const { left, top, width, height, rotate } = slot;

    nodes.push({
      left,
      top,
      width,
      height,
      rotate,
      zoneId: zone.id,
      label: zone.label.en,
      seconds: zone.seconds ?? 0,
      selected: selectedSet.has(zone.id),
      focused: zone.id === focusZoneId,
    });
    return nodes;
  }, []);
}

export function getResponseLabel(
  seconds: number,
  labels: Record<"instant" | "thirtySeconds" | "oneMinute" | "ninetySeconds", string>,
) {
  if (seconds <= 0) return labels.instant;
  if (seconds <= 30) return labels.thirtySeconds;
  if (seconds <= 60) return labels.oneMinute;
  return labels.ninetySeconds;
}
