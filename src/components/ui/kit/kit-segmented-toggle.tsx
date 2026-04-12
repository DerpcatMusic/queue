import { Pressable, type StyleProp, Text, View, type ViewStyle } from "react-native";

import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
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
  const theme = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          overflow: "hidden",
          borderRadius: BrandRadius.md,
          padding: BrandSpacing.xs,
          gap: BrandSpacing.xs,
          backgroundColor: theme.color.primarySubtle,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ disabled: option.disabled, checked: selected }}
            disabled={option.disabled}
            onPress={() => {
              triggerSelectionHaptic();
              onChange(option.value);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: BrandSpacing.controlMd,
              borderRadius: BrandRadius.md,
              borderCurve: "continuous",
              backgroundColor: option.disabled
                ? theme.color.surface
                : pressed
                  ? selected
                    ? theme.color.primaryPressed
                    : theme.color.surfaceElevated
                  : selected
                    ? theme.color.primary
                    : theme.color.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <Text
              style={{
                fontFamily: BrandType.micro.fontFamily,
                fontSize: BrandType.micro.fontSize,
                color: selected ? theme.color.onPrimary : theme.color.primary,
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
