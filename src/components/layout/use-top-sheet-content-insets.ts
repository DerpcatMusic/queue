import { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { useAppInsets } from "@/hooks/use-app-insets";

type TopSheetContentInsetOptions = {
  topSpacing?: number;
  bottomSpacing?: number;
  horizontalPadding?: number;
};

/**
 * @deprecated Prefer layout-owned sheet inset props on TabScreenScrollView / TabScreenRoot.
 */
export function useTopSheetContentInsets({
  topSpacing = 0,
  bottomSpacing = 0,
  horizontalPadding,
}: TopSheetContentInsetOptions = {}) {
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const { safeBottom } = useAppInsets();

  const contentContainerStyle = useMemo<StyleProp<ViewStyle>>(
    () => ({
      paddingTop: collapsedSheetHeight + topSpacing,
      paddingBottom: bottomSpacing + safeBottom,
      ...(horizontalPadding !== undefined ? { paddingHorizontal: horizontalPadding } : {}),
    }),
    [bottomSpacing, collapsedSheetHeight, horizontalPadding, safeBottom, topSpacing],
  );

  return {
    collapsedSheetHeight,
    progressViewOffset: collapsedSheetHeight,
    contentContainerStyle,
  };
}
