import { Text } from "react-native";

import { BrandRadius, BrandType } from "@/constants/brand";
import { KitPressable } from "./kit-pressable";
import type { KitChipProps } from "./types";
import { useKitTheme } from "./use-kit-theme";

export function KitChip({
  label,
  selected = false,
  disabled = false,
  onPress,
  style,
}: KitChipProps) {
  const { color, foreground, background } = useKitTheme();

  return (
    <KitPressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      nativeFeedback
      haptic="selection"
      onPress={onPress}
      pressStyle={disabled ? undefined : { transform: [{ scale: 0.985 }] }}
      style={[
        {
          minHeight: 40,
          borderWidth: 0,
          borderRadius: BrandRadius.pill,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 14,
          paddingVertical: 8,
          backgroundColor: selected ? color.primary : background.panel,
          opacity: disabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          ...BrandType.micro,
          color: selected ? foreground.primary : foreground.secondary,
          letterSpacing: 0.15,
          includeFontPadding: false,
        }}
      >
        {label}
      </Text>
    </KitPressable>
  );
}
