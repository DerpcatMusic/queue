import { MIN_BOTTOM_CHROME_ESTIMATE, TAB_BAR_ESTIMATE } from "./top-sheet-constants";

export function computeStepHeights(
  steps: readonly number[],
  availableHeight: number,
  minHeight: number = 0,
): number[] {
  const safeAvailableHeight = Math.max(0, availableHeight);
  const safeMinHeight = Math.max(0, Math.ceil(minHeight));
  return steps.map((s) => Math.max(Math.round(s * safeAvailableHeight), safeMinHeight));
}

export function computeAvailableHeight(
  screenHeight: number,
  safeTop: number,
  safeBottom: number,
  bottomChromeEstimate?: number,
): number {
  const chrome =
    bottomChromeEstimate ?? Math.max(MIN_BOTTOM_CHROME_ESTIMATE, safeBottom + TAB_BAR_ESTIMATE);
  return screenHeight - safeTop - chrome;
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
  minHeight: number = 0,
  maxHeight: number = Number.POSITIVE_INFINITY,
): number {
  const safeIntrinsicHeight = Math.max(0, intrinsicHeight);
  const safeMinHeight = Math.max(0, minHeight);
  const safeMaxHeight = Math.max(0, maxHeight);
  return Math.min(
    safeMaxHeight,
    Math.max(Math.ceil(safeIntrinsicHeight), Math.ceil(safeMinHeight)),
  );
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
