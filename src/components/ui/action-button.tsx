import type { ReactNode } from "react";
import { ActivityIndicator, I18nManager, Pressable, Text, View } from "react-native";

import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandType } from "@/constants/brand";

type ActionButtonTone = "primary" | "secondary";
type ActionButtonShape = "pill" | "square";
type ActionButtonSize = "md" | "lg";

type ActionButtonProps = {
  label?: string;
  onPress: () => void;
  palette: BrandPalette;
  tone?: ActionButtonTone;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  shape?: ActionButtonShape;
  size?: ActionButtonSize;
};

export function ActionButton({
  label,
  onPress,
  palette,
  tone = "primary",
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  accessibilityLabel,
  shape = "pill",
  size = "md",
}: ActionButtonProps) {
  if (!label && !icon) {
    throw new Error("ActionButton requires a label, an icon, or both.");
  }

  const isDisabled = disabled || loading;
  const isIconOnly = Boolean(icon) && !label;
  const minHeight = size === "lg" ? 54 : 42;
  const minWidth = shape === "square" ? minHeight : 96;
  const backgroundColor = isDisabled
    ? tone === "primary"
      ? (palette.primaryPressed as string)
      : (palette.surface as string)
    : tone === "primary"
      ? (palette.primary as string)
      : (palette.surfaceAlt as string);
  const textColor = isDisabled
    ? tone === "primary"
      ? (palette.onPrimary as string)
      : (palette.textMuted as string)
    : tone === "primary"
      ? (palette.onPrimary as string)
      : (palette.text as string);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight,
        minWidth,
        width: fullWidth && shape === "pill" ? "100%" : undefined,
        alignSelf: fullWidth ? "stretch" : "flex-start",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
        gap: icon && label ? 8 : 0,
        paddingHorizontal: shape === "square" ? 0 : 14,
        paddingVertical: shape === "square" ? 0 : 10,
        borderRadius: shape === "square" ? BrandRadius.card - 4 : BrandRadius.button,
        borderCurve: "continuous",
        backgroundColor,
        overflow: "hidden",
        opacity: pressed && !isDisabled ? 0.94 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          {label ? (
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                ...BrandType.bodyMedium,
                color: textColor,
                includeFontPadding: false,
                textAlign: isIconOnly ? "center" : "left",
                flexShrink: 1,
              }}
            >
              {label}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}
