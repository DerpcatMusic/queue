/**
 * Temporary QA instrumentation — DEVELOPMENT ONLY.
 *
 * Exposes sheet internals (step, height, overflow state) for manual QA verification
 * during the top-sheet sizing refactor. Stripped entirely from production builds via
 * `__DEV__` guard; consumers must always handle the `null` case.
 *
 * Phase 2 (intrinsic sizing) will populate `measuredMinHeight`, `maxHeight`, and
 * `bodyOverflowing` from `useMeasuredContentHeight`.
 */
import { createContext, useContext } from "react";

export type SheetDebugState = {
  /** Current resolved step index (0 = most collapsed). */
  activeStep: number;
  /** Minimum sheet height in pixels (Phase 2 — currently always 0). */
  measuredMinHeight: number;
  /** Maximum allowable sheet height in pixels (Phase 2 — currently always 0). */
  maxHeight: number;
  /** Whether the body content overflows the max height (Phase 2 — currently always false). */
  bodyOverflowing: boolean;
};

/** Internal React context — prefer `useSheetDebug()` below. */
export const SheetDebugContext = createContext<SheetDebugState | null>(null);

/**
 * Read QA debug state for the nearest parent sheet (development builds only).
 *
 * Returns `null` when:
 * - Not mounted inside a `<TopSheet>` (check SheetDebugContext provider chain)
 * - Running in a production build (`__sheetDebug` is never set outside `__DEV__`)
 *
 * Usage:
 * ```ts
 * const debug = useSheetDebug();
 * if (debug) {
 *   console.debug('[QA] sheet step=', debug.activeStep, 'overflow=', debug.bodyOverflowing);
 * }
 * ```
 */
export function useSheetDebug(): SheetDebugState | null {
  // Never break production — context value is null in prod builds.
  return useContext(SheetDebugContext);
}
