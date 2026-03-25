import { Text } from "react-native";

import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

import { KitPressable } from "./kit-pressable";
import { triggerSelectionHaptic } from "./native-interaction";
import type { KitChipProps } from "./types";

export function KitChip({
  label,
  selected = false,
  disabled = false,
  onPress,
  style,
}: KitChipProps) {
  const theme = useTheme();

  const backgroundColor = disabled
    ? selected
      ? theme.color.primarySubtle
      : theme.color.surface
    : selected
      ? theme.color.primary
      : theme.color.surfaceAlt;
  const pressedBackgroundColor = disabled
    ? backgroundColor
    : selected
      ? theme.color.primaryPressed
      : theme.color.surfaceElevated;
  const labelColor = disabled
    ? selected
      ? theme.color.primary
      : theme.color.textMuted
    : selected
      ? theme.color.onPrimary
      : theme.color.text;

  return (
    <KitPressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      containerStyle={style}
      disabled={disabled}
      haptic={false}
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      style={{
        tone: selected ? "primary" : "surface",
        variant: "solid",
        size: {
          minHeight: BrandSpacing.controlSm,
          borderRadius: BrandRadius.buttonSubtle,
        },
        padding: {
          horizontal: BrandSpacing.controlX,
          vertical: BrandSpacing.sm,
        },
        backgroundColor,
        pressedBackgroundColor,
        disabledBackgroundColor: backgroundColor,
      }}
    >
      <Text style={[BrandType.micro, { color: labelColor, includeFontPadding: false }]}>
        {label}
      </Text>
    </KitPressable>
  );
}
