import { ActivityIndicator, I18nManager, View } from "react-native";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Text } from "@/primitives";
import type { AppButtonProps } from "./app-button.types";
import { KitPressable } from "./kit/kit-pressable";

const BUTTON_HEIGHT_LG = BrandSpacing.iconContainer + BrandSpacing.md;
const BUTTON_HEIGHT_MD = BrandSpacing.iconContainer + BrandSpacing.xs;
const BUTTON_MIN_WIDTH = BrandSpacing.iconContainer * 2 + BrandSpacing.sm;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(color: string) {
  const value = color.trim();
  if (!value.startsWith("#")) return null;
  const hex = value.slice(1);

  if (hex.length === 3 || hex.length === 4) {
    return `#${hex
      .split("")
      .map((part) => `${part}${part}`)
      .join("")}`;
  }

  if (hex.length === 6 || hex.length === 8) {
    return `#${hex}`;
  }

  return null;
}

function shiftHexColor(color: string, amount: number) {
  const normalized = normalizeHex(color);
  if (!normalized) return color;

  const hex = normalized.slice(1);
  const hasAlpha = hex.length === 8;
  const rgbHex = hasAlpha ? hex.slice(0, 6) : hex;
  const alphaHex = hasAlpha ? hex.slice(6) : "";

  const r = clamp(Number.parseInt(rgbHex.slice(0, 2), 16) + amount, 0, 255);
  const g = clamp(Number.parseInt(rgbHex.slice(2, 4), 16) + amount, 0, 255);
  const b = clamp(Number.parseInt(rgbHex.slice(4, 6), 16) + amount, 0, 255);

  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}${alphaHex}`;
}

export function AppButtonFallback({
  label,
  onPress,
  tone = "primary",
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  accessibilityLabel,
  shape = "pill",
  size = "md",
  radius,
  dimension,
  colors,
  haptic = true,
  labelStyle,
}: AppButtonProps) {
  const theme = useTheme();

  if (!label && !icon) {
    throw new Error("AppButton requires a label, an icon, or both.");
  }

  const isDisabled = disabled || loading;
  const isIconOnly = Boolean(icon) && !label;
  const minHeight = dimension ?? (size === "lg" ? BUTTON_HEIGHT_LG : BUTTON_HEIGHT_MD);
  const minWidth = shape === "square" ? minHeight : BUTTON_MIN_WIDTH;
  const resolvedRadius = radius ?? BrandRadius.button;
  const backgroundColor =
    colors?.backgroundColor ?? (tone === "primary" ? theme.color.primary : theme.color.surfaceAlt);
  const pressedBackgroundColor =
    colors?.pressedBackgroundColor ??
    (colors?.backgroundColor
      ? shiftHexColor(colors.backgroundColor, tone === "primary" ? -24 : 14)
      : tone === "primary"
        ? theme.color.primaryPressed
        : theme.color.surfaceElevated);
  const disabledBackgroundColor =
    colors?.disabledBackgroundColor ??
    (tone === "primary" ? theme.color.primaryPressed : theme.color.surface);
  const textColor = isDisabled
    ? (colors?.disabledLabelColor ??
      (tone === "primary" ? theme.color.onPrimary : theme.color.textMuted))
    : (colors?.labelColor ?? (tone === "primary" ? theme.color.onPrimary : theme.color.text));

  return (
    <KitPressable
      accessibilityLabel={accessibilityLabel ?? label ?? undefined}
      disabled={isDisabled}
      loading={loading}
      haptic={haptic}
      onPress={onPress}
      style={{
        tone: tone === "primary" ? "primary" : "surface",
        variant: "solid",
        size: {
          minHeight,
          minWidth,
          borderRadius: resolvedRadius,
          width: fullWidth && shape === "pill" ? "100%" : undefined,
        },
        layout: {
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        padding: {
          horizontal: shape === "square" ? 0 : BrandSpacing.component,
          vertical: shape === "square" ? 0 : BrandSpacing.sm,
        },
        backgroundColor,
        pressedBackgroundColor,
        disabledBackgroundColor,
      }}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: icon && label ? BrandSpacing.sm : 0,
          }}
        >
          {icon ? <View>{icon}</View> : null}
          {label ? (
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                ...theme.typography.bodyMedium,
                color: textColor,
                includeFontPadding: false,
                textAlign: isIconOnly ? "center" : I18nManager.isRTL ? "right" : "left",
                flexShrink: 1,
                ...labelStyle,
              }}
            >
              {label}
            </Text>
          ) : null}
        </View>
      )}
    </KitPressable>
  );
}
