import { I18nManager, Pressable, type StyleProp, Text, View, type ViewStyle } from "react-native";

import { BrandRadius, BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";

type ChoicePillProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ChoicePill({
  label,
  selected = false,
  disabled = false,
  icon,
  onPress,
  style,
}: ChoicePillProps) {
  const palette = useBrand();
  const backgroundColor = selected ? (palette.primary as string) : (palette.surfaceAlt as string);
  const labelColor = selected ? (palette.onPrimary as string) : (palette.text as string);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: "100%",
          alignSelf: "stretch",
          opacity: disabled ? 0.64 : pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      <View
        style={{
          minHeight: 74,
          width: "100%",
          borderRadius: BrandRadius.button - 2,
          borderCurve: "continuous",
          backgroundColor,
          paddingHorizontal: 16,
          paddingVertical: 14,
          alignItems: "center",
          justifyContent: "flex-start",
          flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
          gap: icon ? 10 : 0,
          overflow: "hidden",
        }}
      >
        {icon ? <View>{icon}</View> : null}
        <Text
          style={{
            ...BrandType.bodyStrong,
            color: labelColor,
            includeFontPadding: false,
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
