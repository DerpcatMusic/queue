import type { StyleProp, ViewStyle } from "react-native";

export type SheetInsetArgs = {
  collapsedSheetHeight: number;
  safeBottom: number;
  topSpacing?: number | undefined;
  bottomSpacing?: number | undefined;
  horizontalPadding?: number | undefined;
};

export function createSheetInsetStyle({
  collapsedSheetHeight: _collapsedSheetHeight,
  safeBottom,
  topSpacing = 0,
  bottomSpacing = 0,
  horizontalPadding,
}: SheetInsetArgs): StyleProp<ViewStyle> {
  return {
    paddingTop: topSpacing,
    paddingBottom: safeBottom + bottomSpacing,
    ...(horizontalPadding !== undefined ? { paddingHorizontal: horizontalPadding } : {}),
  };
}

export function getSheetProgressViewOffset({
  collapsedSheetHeight: _collapsedSheetHeight,
  topSpacing = 0,
}: Pick<SheetInsetArgs, "collapsedSheetHeight" | "topSpacing">) {
  return topSpacing;
}
