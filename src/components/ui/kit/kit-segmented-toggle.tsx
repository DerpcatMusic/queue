import { Pressable, type StyleProp, Text, View, type ViewStyle } from "react-native";

import { BrandRadius, BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { triggerSelectionHaptic } from "./native-interaction";

type Option<T extends string> = {
  label: string;
  value: T;
  disabled?: boolean;
};

type KitSegmentedToggleProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly Option<T>[];
  style?: StyleProp<ViewStyle>;
};

export function KitSegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  style,
}: KitSegmentedToggleProps<T>) {
  const palette = useBrand();

  return (
    <View
      style={[
        {
          borderRadius: BrandRadius.button,
          borderCurve: "continuous",
          backgroundColor: palette.primarySubtle as string,
          padding: 4,
          flexDirection: "row",
          gap: 4,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ disabled: option.disabled, selected }}
            disabled={option.disabled}
            onPress={() => {
              triggerSelectionHaptic();
              onChange(option.value);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 48,
              borderRadius: BrandRadius.button - 8,
              borderCurve: "continuous",
              backgroundColor: selected
                ? (palette.primary as string)
                : (palette.surfaceAlt as string),
              alignItems: "center",
              justifyContent: "center",
              opacity: option.disabled ? 0.72 : pressed ? 0.86 : 1,
            })}
          >
            <Text
              style={{
                ...BrandType.micro,
                color: selected ? (palette.onPrimary as string) : (palette.primary as string),
                fontSize: 14,
                fontWeight: "700",
                includeFontPadding: false,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
