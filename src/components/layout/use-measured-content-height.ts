/**
 * Reusable hook for measuring content height via `onLayout`.
 *
 * Returns stable measured height state and a memoized `onLayout` handler that
 * ignores sub-pixel noise using a configurable threshold (default: 1px).
 * Suitable for sticky header / footer / body height measurement in later phases.
 *
 * @example
 * const { measuredHeight, onLayout } = useMeasuredContentHeight();
 * return <View onLayout={onLayout}>{children}</View>;
 */
import { useCallback, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

const DEFAULT_THRESHOLD = 1;

export function useMeasuredContentHeight(threshold: number = DEFAULT_THRESHOLD) {
  const [measuredHeight, setMeasuredHeight] = useState<number>(0);
  const measuredHeightRef = useRef<number>(0);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h <= 0) return;
      if (Math.abs(measuredHeightRef.current - h) < threshold) return;
      measuredHeightRef.current = h;
      setMeasuredHeight(h);
    },
    [threshold],
  );

  return { measuredHeight, onLayout };
}
