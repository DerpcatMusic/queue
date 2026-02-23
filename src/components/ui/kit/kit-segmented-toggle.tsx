import { Pressable, Text, View } from "react-native";

import { BrandRadius } from "@/constants/brand";
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
  const { palette, primaryLiftShadow, transparent } = useKitTheme();

  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: BrandRadius.button,
        borderCurve: "continuous",
        borderColor: palette.borderStrong,
        backgroundColor: palette.surfaceAlt,
        padding: 4,
        flexDirection: "row",
        gap: 4,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            disabled={option.disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 38,
              borderWidth: 1,
              borderRadius: BrandRadius.button - 4,
              borderCurve: "continuous",
              borderColor: selected ? palette.primaryPressed : transparent,
              backgroundColor: selected ? palette.primary : palette.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
              opacity: option.disabled ? 0.5 : pressed ? 0.86 : 1,
              boxShadow: selected ? primaryLiftShadow : undefined,
            })}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: selected ? palette.onPrimary : palette.textMuted,
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
