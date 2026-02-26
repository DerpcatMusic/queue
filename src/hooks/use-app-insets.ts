import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const OVERLAY_GAP = Platform.OS === "ios" ? 16 : 18;

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
  // NativeTabs already manages tab bar exclusion. Keep this semantic value as safe-bottom only
  // so we don't double-apply nav spacing on screens.
  const tabContentBottom = safeBottom;
  const overlayBottom = safeBottom + OVERLAY_GAP;

  return {
    safeTop,
    safeBottom,
    tabContentBottom,
    overlayBottom,
  };
}
