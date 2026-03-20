import {
  type ColorValue,
  I18nManager,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { BrandRadius, BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";

type ChoicePillProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  compact?: boolean;
  backgroundColor?: ColorValue;
  selectedBackgroundColor?: ColorValue;
  labelColor?: ColorValue;
  selectedLabelColor?: ColorValue;
};

export function ChoicePill({
  label,
  selected = false,
  disabled = false,
  icon,
  onPress,
  style,
  fullWidth = false,
  compact = false,
  backgroundColor,
  selectedBackgroundColor,
  labelColor,
  selectedLabelColor,
}: ChoicePillProps) {
  const palette = useBrand();
  const resolvedBackgroundColor = selected
    ? (selectedBackgroundColor ?? palette.primary)
    : (backgroundColor ?? palette.surfaceAlt);
  const resolvedLabelColor = selected
    ? (selectedLabelColor ?? palette.onPrimary)
    : (labelColor ?? palette.text);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: fullWidth ? "100%" : undefined,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          opacity: disabled ? 0.64 : pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      <View
        style={{
          minHeight: compact ? 40 : 58,
          width: fullWidth ? "100%" : undefined,
          borderRadius: compact ? BrandRadius.card - 14 : BrandRadius.card - 10,
          borderCurve: "continuous",
          backgroundColor: resolvedBackgroundColor,
          paddingHorizontal: compact ? 10 : 16,
          paddingVertical: compact ? 8 : 12,
          alignItems: "center",
          justifyContent: "flex-start",
          flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
          gap: icon ? (compact ? 8 : 10) : 0,
          overflow: "hidden",
        }}
      >
        {icon ? <View>{icon}</View> : null}
        <Text
          style={{
            ...(compact ? BrandType.micro : BrandType.bodyMedium),
            color: resolvedLabelColor as string,
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
