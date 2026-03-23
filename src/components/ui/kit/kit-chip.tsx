import { Pressable, Text } from "react-native";

import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { triggerSelectionHaptic } from "./native-interaction";
import type { KitChipProps } from "./types";

export function KitChip({
  label,
  selected = false,
  disabled = false,
  onPress,
  style,
}: KitChipProps) {
  const palette = useBrand();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: BrandSpacing.iconContainer,
          borderRadius: BrandRadius.buttonSubtle,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: BrandSpacing.componentPadding,
          paddingVertical: BrandSpacing.sm,
          backgroundColor: selected ? (palette.primary as string) : (palette.surfaceAlt as string),
          opacity: disabled ? 0.72 : 1,
          transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <Text
        style={{
          ...BrandType.micro,
          color: selected ? (palette.onPrimary as string) : (palette.text as string),
          includeFontPadding: false,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
