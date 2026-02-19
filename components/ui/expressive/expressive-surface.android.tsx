import { StyleSheet, View } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { useExpressivePalette } from "./use-expressive-palette";
import type { ExpressiveSurfaceProps } from "./types";

export function ExpressiveSurface({
  tone = "default",
  padding = 16,
  gap = 10,
  style,
  children,
  ...rest
}: ExpressiveSurfaceProps) {
  const { palette } = useExpressivePalette();

  const backgroundColor =
    tone === "elevated"
      ? palette.surfaceElevated
      : tone === "glass"
        ? palette.surfaceAlt
        : palette.surface;

  return (
    <View
      style={[
        styles.base,
        {
          padding,
          gap,
          backgroundColor,
          borderColor: palette.borderStrong,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    elevation: 3,
  },
});
