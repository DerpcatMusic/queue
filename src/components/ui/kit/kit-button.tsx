import { ActivityIndicator, type ColorValue, Text, View } from "react-native";

import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandRadius, BrandType } from "@/constants/brand";
import { KitPressable } from "./kit-pressable";
import type { KitButtonProps } from "./types";
import { useKitTheme } from "./use-kit-theme";

type ButtonColors = {
  backgroundColor: ColorValue;
  borderColor: ColorValue;
  textColor: ColorValue;
  iconColor: ColorValue;
  highlight: ColorValue;
  shadow?: string | undefined;
};

function toSymbolTint(color: ColorValue, fallback?: string) {
  if (typeof color === "string") return color;
  return fallback;
}

function getButtonColors(
  variant: NonNullable<KitButtonProps["variant"]>,
  theme: ReturnType<typeof useKitTheme>,
): ButtonColors {
  const { color, background, foreground, border, shadow } = theme;
  if (variant === "primary") {
    return {
      backgroundColor: color.primary,
      borderColor: "transparent",
      textColor: foreground.primary,
      iconColor: foreground.primary,
      highlight: border.highlight,
      shadow: shadow.primaryLift,
    };
  }
  if (variant === "danger") {
    return {
      backgroundColor: color.danger,
      borderColor: "transparent",
      textColor: foreground.primary,
      iconColor: foreground.primary,
      highlight: border.highlight,
      shadow: "none",
    };
  }
  if (variant === "secondary") {
    return {
      backgroundColor: background.panel,
      borderColor: "transparent",
      textColor: foreground.secondary,
      iconColor: color.primary,
      highlight: border.primary,
      shadow: undefined,
    };
  }
  return {
    backgroundColor: background.transparent,
    borderColor: "transparent",
    textColor: color.primary,
    iconColor: color.primary,
    highlight: border.transparent,
  };
}

function getButtonSize(size: NonNullable<KitButtonProps["size"]>) {
  if (size === "sm") {
    return { minHeight: 42, horizontal: 14, fontSize: 13 };
  }
  if (size === "lg") {
    return { minHeight: 54, horizontal: 20, fontSize: 16 };
  }
  return { minHeight: 48, horizontal: 18, fontSize: 14 };
}

export function KitButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = true,
  icon,
  leadingIcon,
  trailingIcon,
  style,
}: KitButtonProps) {
  const theme = useKitTheme();
  const colors = getButtonColors(variant, theme);
  const sizing = getButtonSize(size);
  const isDisabled = disabled || loading;
  const symbolTint = toSymbolTint(colors.iconColor, theme.symbol.defaultTint);

  return (
    <KitPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={(event) => onPress(event)}
      haptic="impact"
      nativeFeedback
      pressStyle={isDisabled ? undefined : { transform: [{ scale: 0.985 }] }}
      style={[
        {
          minHeight: sizing.minHeight,
          borderWidth: 0,
          borderRadius: BrandRadius.button,
          borderCurve: "continuous",
          borderColor: colors.borderColor,
          backgroundColor: colors.backgroundColor,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: sizing.horizontal,
          gap: 8,
          opacity: isDisabled ? 0.56 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          boxShadow: colors.shadow,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {/* Removed the fake 3D highlight View for a flatter editorial aesthetic */}
      {loading ? (
        <ActivityIndicator color={colors.iconColor} />
      ) : icon ? (
        <AppSymbol
          name={icon}
          size={18}
          {...(symbolTint ? { tintColor: symbolTint } : {})}
        />
      ) : leadingIcon ? (
        <View>{leadingIcon}</View>
      ) : null}
      <Text
        style={{
          ...BrandType.bodyMedium,
          color: colors.textColor,
          fontSize: sizing.fontSize,
          letterSpacing: -0.1,
          includeFontPadding: false,
        }}
      >
        {label}
      </Text>
      {trailingIcon ? <View>{trailingIcon}</View> : null}
    </KitPressable>
  );
}
