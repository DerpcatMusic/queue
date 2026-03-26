import { MIN_BOTTOM_CHROME_ESTIMATE, TAB_BAR_ESTIMATE } from "./top-sheet-constants";
import { computeAvailableHeight, computeStepHeights } from "./top-sheet-sizing";

export {
  DEFAULT_STEPS,
  HANDLE_HEIGHT,
  HANDLE_PILL_HEIGHT,
  HANDLE_PILL_WIDTH,
  SHEET_SPRING,
} from "./top-sheet-constants";

export function getTopSheetAvailableHeight(
  screenHeight: number,
  safeTop: number,
  safeBottom: number,
) {
  const bottomChromeEstimate = Math.max(MIN_BOTTOM_CHROME_ESTIMATE, safeBottom + TAB_BAR_ESTIMATE);
  return screenHeight - safeTop - bottomChromeEstimate;
}

export function getTopSheetStepHeights(
  steps: readonly number[],
  screenHeight: number,
  safeTop: number,
  safeBottom: number,
  minHeight?: number,
) {
  const availableHeight = computeAvailableHeight(screenHeight, safeTop, safeBottom);
  return computeStepHeights(steps, availableHeight, minHeight ?? 0);
}
