import { Text } from "react-native";

import { BrandRadius } from "@/constants/brand";
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
  const { color, foreground, background, border, shadow, isCustomStyle } = useKitTheme();

  return (
    <KitPressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      nativeFeedback={!isCustomStyle}
      haptic="selection"
      onPress={onPress}
      pressStyle={disabled ? undefined : { transform: [{ scale: 0.985 }] }}
      style={[
        {
          minHeight: 44,
          borderWidth: 1,
          borderRadius: BrandRadius.pill,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderColor: selected ? color.primary : border.secondary,
          backgroundColor: selected ? background.primarySubtle : background.glass,
          opacity: disabled ? 0.55 : 1,
          boxShadow: selected ? shadow.surface : undefined,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: selected ? color.primary : foreground.secondary,
          fontWeight: "700",
          fontSize: 13,
          includeFontPadding: false,
        }}
      >
        {label}
      </Text>
    </KitPressable>
  );
}
