import { Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const IOS_LEGACY_NATIVE_TAB_BAR_HEIGHT = 52;
const IOS_MODERN_NATIVE_TAB_BAR_HEIGHT = 64;
const ANDROID_NATIVE_TAB_BAR_HEIGHT = 64;
const BOTTOM_OVERLAY_GAP = 24;

function estimateNativeTabBarHeight() {
  if (Platform.OS === "ios") {
    // NativeTabs height is not exposed to JS in SDK 54, so we use a conservative estimate.
    const majorVersion = Number.parseInt(String(Platform.Version), 10);
    if (Number.isFinite(majorVersion) && majorVersion >= 26) {
      return IOS_MODERN_NATIVE_TAB_BAR_HEIGHT;
    }
    return IOS_LEGACY_NATIVE_TAB_BAR_HEIGHT;
  }

  if (Platform.OS === "android") {
    return ANDROID_NATIVE_TAB_BAR_HEIGHT;
  }

  return 0;
}

export function useNativeTabLayout() {
  const insets = useSafeAreaInsets();
  const androidStatusBarHeight =
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  const nativeTabBarHeight = estimateNativeTabBarHeight();
  const bottomInset = insets.bottom + nativeTabBarHeight;

  return {
    topInset: Math.max(insets.top, androidStatusBarHeight),
    safeBottomInset: insets.bottom,
    bottomInset,
    bottomOverlayInset: bottomInset + BOTTOM_OVERLAY_GAP,
  };
}
