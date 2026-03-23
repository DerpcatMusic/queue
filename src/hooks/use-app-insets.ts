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
  // Native tabs already reserve baseline content space. Only floating overlays/buttons should
  // clear the bottom chrome manually.
  const overlayBottom = safeBottom + BrandSpacing.lg;

  return {
    safeTop,
    safeBottom,
    overlayBottom,
  };
}
