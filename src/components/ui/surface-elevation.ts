import { Platform, type ViewStyle } from "react-native";

import { type BrandPalette, BrandSpacing } from "@/constants/brand";

export function getSurfaceElevationStyle(
  palette: BrandPalette,
  tone: "sheet" | "floating",
): ViewStyle {
  const shadowColor =
    tone === "sheet"
      ? (palette.onPrimaryShadowStrong as string)
      : (palette.onPrimaryShadowSoft as string);
  const elevation = tone === "sheet" ? BrandSpacing.md : BrandSpacing.sm;
  const shadowRadius = tone === "sheet" ? BrandSpacing.lg : BrandSpacing.sm;
  const shadowOffsetHeight = tone === "sheet" ? BrandSpacing.sm : BrandSpacing.xs;

  return Platform.select<ViewStyle>({
    ios: {
      shadowColor,
      shadowOpacity: 1,
      shadowRadius,
      shadowOffset: { width: 0, height: shadowOffsetHeight },
    },
    android: {
      elevation,
      shadowColor,
    },
    default: {},
  }) as ViewStyle;
}
