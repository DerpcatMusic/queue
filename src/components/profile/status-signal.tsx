import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { type BrandPalette, BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";

type StatusSignalTone = "surface" | "accent";

export type StatusSignalProps = {
  label: string;
  value: string;
  palette: BrandPalette;
  tone?: StatusSignalTone;
  icon?: ReactNode;
};

export function StatusSignal({ label, value, palette, tone = "surface", icon }: StatusSignalProps) {
  const backgroundColor =
    tone === "accent" ? (palette.primarySubtle as string) : (palette.surfaceElevated as string);
  const labelColor =
    tone === "accent" ? (palette.primary as string) : (palette.textMuted as string);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inner,
          {
            backgroundColor,
            borderRadius: BrandRadius.cardSubtle,
            borderCurve: "continuous",
          },
        ]}
      >
        <View style={styles.content}>
          <Text
            style={[
              BrandType.micro,
              styles.label,
              {
                color: labelColor,
                letterSpacing: BrandType.micro.letterSpacing,
                textTransform: "uppercase",
              },
            ]}
          >
            {label}
          </Text>
          <Text
            numberOfLines={1}
            style={[BrandType.bodyStrong, styles.value, { color: palette.text as string }]}
          >
            {value}
          </Text>
        </View>
        {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: BrandSpacing.componentPadding,
    paddingVertical: BrandSpacing.md,
    gap: BrandSpacing.sm,
  },
  content: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  label: {
    // textTransform: uppercase and letterSpacing applied inline
  },
  value: {
    // bodyStrong already has correct styling
  },
  iconSlot: {
    flexShrink: 0,
  },
});
