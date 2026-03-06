import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const OVERLAY_GAP = Platform.OS === "ios" ? 16 : 18;
const ESTIMATED_NATIVE_TAB_BAR_HEIGHT = Platform.OS === "ios" ? 52 : 64;

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
  // NativeTabs applies safe-area handling, but floating UI and manual content padding still need
  // to stay visually above the persistent native tab bar.
  const tabContentBottom = safeBottom + ESTIMATED_NATIVE_TAB_BAR_HEIGHT;
  const overlayBottom = tabContentBottom + OVERLAY_GAP;

  return {
    safeTop,
    safeBottom,
    tabContentBottom,
    overlayBottom,
  };
}
