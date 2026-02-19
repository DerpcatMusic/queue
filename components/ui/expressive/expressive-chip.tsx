import { Pressable, StyleSheet, Text } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { useExpressivePalette } from "./use-expressive-palette";
import type { ExpressiveChipProps } from "./types";

export function ExpressiveChip({
  label,
  selected = false,
  onPress,
  disabled = false,
}: ExpressiveChipProps) {
  const { palette } = useExpressivePalette();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          borderColor: selected ? palette.primary : palette.border,
          backgroundColor: selected ? palette.primarySubtle : palette.surface,
          opacity: disabled ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Text
        style={{
          color: selected ? palette.primary : palette.text,
          fontWeight: "700",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
