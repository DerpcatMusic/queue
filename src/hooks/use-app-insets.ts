import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandSpacing } from "@/constants/brand";

export type AppInsets = {
  safeTop: number;
  safeBottom: number;
  tabContentBottom: number;
  overlayBottom: number;
};

export function useAppInsets(): AppInsets {
  const insets = useSafeAreaInsets();

  const safeTop = insets.top;
  const safeBottom = insets.bottom;
  // Native tab bars handle most insetting for normal content. We only add a shared clearance
  // token for floating controls and screens that need breathing room above the bottom chrome.
  const tabContentBottom = safeBottom + BrandSpacing.xxl;
  const overlayBottom = tabContentBottom + BrandSpacing.sm;

  return {
    safeTop,
    safeBottom,
    tabContentBottom,
    overlayBottom,
  };
}
