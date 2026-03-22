import { MIN_BOTTOM_CHROME_ESTIMATE, TAB_BAR_ESTIMATE } from "./top-sheet-constants";

export function computeStepHeights(steps: readonly number[], availableHeight: number): number[] {
  return steps.map((s) => Math.round(s * availableHeight));
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

export type OverflowMode = "fit" | "overflow";

export function resolveOverflowMode(
  _mode: "content-min" | "content-min-overflow",
  measuredHeight: number,
  maxHeight: number,
): OverflowMode {
  if (_mode === "content-min") return "fit";
  return measuredHeight > maxHeight ? "overflow" : "fit";
}
