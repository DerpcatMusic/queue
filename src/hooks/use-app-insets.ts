/**
 * @deprecated Prefer layout-owned inset values from ScrollSheetProvider / screen scaffolds.
 */
import { useContext } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollSheetLayoutContext } from "@/components/layout/scroll-sheet-provider";
import { BrandSpacing } from "@/theme/theme";

export type AppInsets = {
  safeTop: number;
  safeBottom: number;
  overlayBottom: number;
};

export function useAppInsets(): AppInsets {
  const layoutInsets = useContext(ScrollSheetLayoutContext);
  const insets = useSafeAreaInsets();

  const safeTop = layoutInsets?.safeTop ?? insets.top;
  const safeBottom = layoutInsets?.safeBottom ?? insets.bottom;
  // Native tabs already account for bottom safe area. Floating controls should use the same
  // semantic gutter on both axes instead of double-counting the bottom inset.
  const overlayBottom = layoutInsets?.overlayBottom ?? BrandSpacing.lg;

  return {
    safeTop,
    safeBottom,
    overlayBottom,
  };
}
