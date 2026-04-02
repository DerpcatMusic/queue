import { computeAvailableHeight, computeStepHeights } from "./top-sheet-sizing";
import {
  DEFAULT_STEPS,
  HANDLE_HEIGHT,
  HANDLE_PILL_HEIGHT,
  HANDLE_PILL_WIDTH,
  SHEET_SPRING,
} from "./top-sheet-constants";

export {
  DEFAULT_STEPS,
  HANDLE_HEIGHT,
  HANDLE_PILL_HEIGHT,
  HANDLE_PILL_WIDTH,
  SHEET_SPRING,
};

export function getTopSheetAvailableHeight(sceneViewportHeight: number) {
  return computeAvailableHeight(sceneViewportHeight);
}

export function getTopSheetStepHeights(
  steps: readonly number[],
  sceneViewportHeight: number,
  minHeight?: number,
) {
  const availableHeight = computeAvailableHeight(sceneViewportHeight);
  return computeStepHeights(steps, availableHeight, minHeight ?? 0);
}
