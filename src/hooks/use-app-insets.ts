import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandSpacing } from "@/constants/brand";

export type AppInsets = {
  safeTop: number;
  safeBottom: number;
  overlayBottom: number;
};

export function useAppInsets(): AppInsets {
  const insets = useSafeAreaInsets();

  const safeTop = insets.top;
  const safeBottom = insets.bottom;
  // Native tabs already account for bottom safe area. Floating controls should use the same
  // semantic gutter on both axes instead of double-counting the bottom inset.
  const overlayBottom = BrandSpacing.lg;

  return {
    safeTop,
    safeBottom,
    overlayBottom,
  };
}
