import { useWindowDimensions } from "react-native";

export const LAYOUT_BREAKPOINTS = {
  desktopFrame: 1100,
  desktopWide: 1180,
  desktopExpanded: 1380,
} as const;

export function useLayoutBreakpoint() {
  const { width } = useWindowDimensions();
  const isWeb = process.env.EXPO_OS === "web";

  return {
    isWideFrame: isWeb && width >= LAYOUT_BREAKPOINTS.desktopFrame,
    isDesktopWeb: isWeb && width >= LAYOUT_BREAKPOINTS.desktopWide,
    isExpandedWeb: isWeb && width >= LAYOUT_BREAKPOINTS.desktopExpanded,
    screenWidth: width,
    isWeb,
  };
}
