import { Platform, type ViewStyle } from "react-native";

import { BrandSpacing } from "@/constants/brand";
import { getTheme } from "@/lib/design-system";

const DEFAULT_SHADOW_COLOR = getTheme("light").color.shadow;

export function getSurfaceElevationStyle(
  tone: "sheet" | "floating",
  shadowColor: string = DEFAULT_SHADOW_COLOR,
): ViewStyle {
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
