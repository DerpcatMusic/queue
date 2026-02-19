import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import { Brand, BrandRadius, BrandShadow } from "@/constants/brand";
import { useColorScheme } from "@/hooks/use-color-scheme";

type BrandSurfaceProps = PropsWithChildren<
  ViewProps & {
    tone?: "default" | "alt" | "elevated";
  }
>;

export function BrandSurface({
  children,
  tone = "default",
  style,
  ...rest
}: BrandSurfaceProps) {
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];

  const backgroundColor =
    tone === "alt"
      ? palette.surfaceAlt
      : tone === "elevated"
        ? palette.surfaceElevated
        : palette.surface;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor,
          borderColor: palette.border,
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
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 16,
    gap: 10,
    boxShadow: BrandShadow.soft,
  },
});
