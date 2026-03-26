/**
 * @deprecated Use LayoutInsetsContext from scroll-sheet-provider or rely on
 * TabScreenRoot/TabScreenScrollView which provide sheet-aware content insets.
 *
 * INSET OWNERSHIP RULE (Expo 55 best practice):
 *   - Insets are owned by layouts and passed down through LayoutInsetsContext
 *   - For sheet-aware scroll content, prefer TabScreenRoot mode="scroll" which
 *     handles insets automatically
 *   - This hook is kept for backwards compatibility with existing consumers
 *
 * This hook is a convenience that combines:
 *   - collapsedSheetHeight from ScrollSheetProvider
 *   - safeBottom from LayoutInsetsContext (via useAppInsets)
 *
 * Consumers should migrate to using TabScreenRoot/TabScreenScrollView for
 * scroll modes, which handle the inset contract automatically.
 */
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
