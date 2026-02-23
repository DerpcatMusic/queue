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
  const { palette, isCustomStyle, glassBackground, surfaceShadow } = useKitTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      {...(!isCustomStyle ? { android_ripple: { color: palette.primarySubtle as string } } : {})}
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
          borderColor: selected ? palette.primary : palette.borderStrong,
          backgroundColor: selected ? palette.primarySubtle : glassBackground,
          opacity: disabled ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          boxShadow: selected ? surfaceShadow : undefined,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: selected ? palette.primary : palette.text,
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
