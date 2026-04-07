export function computeStepHeights(
  steps: readonly number[],
  availableHeight: number,
  baseHeight: number = 0,
): number[] {
  const safeAvailableHeight = Math.max(0, availableHeight);
  const safeBaseHeight = Math.min(safeAvailableHeight, Math.max(0, Math.ceil(baseHeight)));
  const expandableRange = Math.max(0, safeAvailableHeight - safeBaseHeight);

  return steps.map((s) =>
    Math.min(safeAvailableHeight, safeBaseHeight + Math.round(Math.max(0, s) * expandableRange)),
  );
}

export function computeAvailableHeight(
  sceneViewportHeight: number,
): number {
  return Math.max(0, sceneViewportHeight);
}

export function computeIntrinsicMinHeight(
  stickyHeaderHeight: number,
  stickyFooterHeight: number,
  contentMinHeight: number,
): number {
  return stickyHeaderHeight + stickyFooterHeight + contentMinHeight;
}

export function computeCollapsedHeight(
  intrinsicHeight: number,
  maxHeight: number = Number.POSITIVE_INFINITY,
): number {
  const safeIntrinsicHeight = Math.max(0, intrinsicHeight);
  const safeMaxHeight = Math.max(0, maxHeight);
  return Math.min(safeMaxHeight, Math.ceil(safeIntrinsicHeight));
}

export type OverflowMode = "fit" | "overflow";

export function resolveOverflowMode(
  _mode: "content-min" | "content-min-overflow",
  measuredHeight: number,
  maxHeight: number,
): OverflowMode {
  if (_mode === "content-min") return "fit";
  return measuredHeight > maxHeight ? "overflow" : "fit";
}
