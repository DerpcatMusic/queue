import type { StyleProp, ViewStyle } from "react-native";

export type SheetInsetArgs = {
  collapsedSheetHeight: number;
  safeBottom: number;
  topSpacing?: number | undefined;
  bottomSpacing?: number | undefined;
  horizontalPadding?: number | undefined;
};

export function createSheetInsetStyle({
  collapsedSheetHeight,
  safeBottom,
  topSpacing = 0,
  bottomSpacing = 0,
  horizontalPadding,
}: SheetInsetArgs): StyleProp<ViewStyle> {
  return {
    paddingTop: collapsedSheetHeight + topSpacing,
    paddingBottom: safeBottom + bottomSpacing,
    ...(horizontalPadding !== undefined ? { paddingHorizontal: horizontalPadding } : {}),
  };
}

export function getSheetProgressViewOffset({
  collapsedSheetHeight,
  topSpacing = 0,
}: Pick<SheetInsetArgs, "collapsedSheetHeight" | "topSpacing">) {
  return collapsedSheetHeight + topSpacing;
}
