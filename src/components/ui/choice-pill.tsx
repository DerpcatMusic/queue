import {
  type ColorValue,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useTranslation } from "react-i18next";

import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

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
  const { color: palette } = useTheme();
  const { i18n } = useTranslation();
  const isRtl = (i18n.resolvedLanguage ?? i18n.language ?? "en").toLowerCase().startsWith("he");
  const resolvedBackgroundColor = selected
    ? (selectedBackgroundColor ?? palette.primary)
    : (backgroundColor ?? palette.surfaceMuted);
  const resolvedLabelColor = selected
    ? (selectedLabelColor ?? palette.onPrimary)
    : (labelColor ?? palette.text);
  const pressedBackgroundColor = selected
    ? (palette.primaryPressed as ColorValue)
    : (palette.surfaceElevated as ColorValue);
  const disabledBackgroundColor = selected
    ? (palette.primarySubtle as ColorValue)
    : (palette.surface as ColorValue);
  const disabledLabelColor = selected
    ? (palette.primary as ColorValue)
    : (palette.textMuted as ColorValue);

  const compactTextStyle = BrandType.micro;
  const defaultTextStyle = BrandType.bodyMedium;

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
          minHeight: compact ? BrandSpacing.controlMd : BrandSpacing.controlLg,
          borderRadius: compact ? BrandRadius.button : BrandRadius.card,
          borderCurve: "continuous",
          backgroundColor: disabled
            ? disabledBackgroundColor
            : pressed
              ? pressedBackgroundColor
              : resolvedBackgroundColor,
          paddingHorizontal: compact ? BrandSpacing.sm : BrandSpacing.lg,
          paddingVertical: compact ? BrandSpacing.sm : BrandSpacing.md,
          alignItems: "center",
          justifyContent: "flex-start",
          flexDirection: isRtl ? "row-reverse" : "row",
          gap: icon ? (compact ? BrandSpacing.sm : BrandSpacing.md) : 0,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {icon ? <View>{icon}</View> : null}
      <Text
        style={{
          ...(compact ? compactTextStyle : defaultTextStyle),
          color: (disabled ? disabledLabelColor : resolvedLabelColor) as string,
          includeFontPadding: false,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
