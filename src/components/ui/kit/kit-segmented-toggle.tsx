import { Text, View } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { KitPressable } from "./kit-pressable";
import { getNativeShadowStyle } from "./native-shadow";
import { useKitTheme } from "./use-kit-theme";

type Option<T extends string> = {
  label: string;
  value: T;
  disabled?: boolean;
};

type KitSegmentedToggleProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly Option<T>[];
};

export function KitSegmentedToggle<T extends string>({
  value,
  onChange,
  options,
}: KitSegmentedToggleProps<T>) {
  const { color, foreground, border, background } = useKitTheme();

  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: BrandRadius.button,
        borderCurve: "continuous",
        borderColor: border.secondary,
        backgroundColor: background.surfaceSecondary,
        padding: 4,
        flexDirection: "row",
        gap: 4,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <KitPressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ disabled: option.disabled, selected }}
            disabled={option.disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 38,
              borderWidth: 1,
              borderRadius: BrandRadius.button - 4,
              borderCurve: "continuous",
              borderColor: selected ? color.primaryPressed : border.transparent,
              backgroundColor: selected ? color.primary : background.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
              opacity: option.disabled ? 0.5 : pressed ? 0.86 : 1,
              ...(selected ? getNativeShadowStyle("surface") : {}),
            })}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "500",
                color: selected ? foreground.primary : foreground.muted,
                includeFontPadding: false,
              }}
            >
              {option.label}
            </Text>
          </KitPressable>
        );
      })}
    </View>
  );
}
