import { Pressable, Text } from "react-native";

import { BrandType } from "@/constants/brand";
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
  const idleBackgroundColor = selected
    ? (palette.primary as string)
    : (palette.surfaceAlt as string);
  const pressedBackgroundColor = selected
    ? (palette.primaryPressed as string)
    : (palette.surfaceElevated as string);
  const disabledBackgroundColor = selected
    ? (palette.primarySubtle as string)
    : (palette.surface as string);
  const textColor = selected ? (palette.onPrimary as string) : (palette.text as string);
  const disabledTextColor = selected ? (palette.primary as string) : (palette.textMuted as string);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      className="items-center justify-center min-h-icon-container px-component-padding py-sm rounded-button-subtle"
      style={({ pressed }) => [
        {
          backgroundColor: disabled
            ? disabledBackgroundColor
            : pressed
              ? pressedBackgroundColor
              : idleBackgroundColor,
          transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <Text
        style={{
          ...BrandType.micro,
          color: disabled ? disabledTextColor : textColor,
          includeFontPadding: false,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
