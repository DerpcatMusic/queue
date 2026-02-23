import * as Haptics from "expo-haptics";
import { Pressable, Text } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { useKitTheme } from "./use-kit-theme";
import type { KitChipProps } from "./types";

export function KitChip({
  label,
  selected = false,
  disabled = false,
  onPress,
  style,
}: KitChipProps) {
  const { color, foreground, background, border, interaction, shadow, isCustomStyle } =
    useKitTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      {...(!isCustomStyle ? { android_ripple: { color: interaction.ripple as string } } : {})}
      onPress={() => {
        if (process.env.EXPO_OS === "ios") {
          void Haptics.selectionAsync();
        }
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: 36,
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
          transform: [{ scale: pressed ? 0.985 : 1 }],
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
    </Pressable>
  );
}
