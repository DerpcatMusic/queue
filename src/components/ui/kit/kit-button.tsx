import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type ColorValue,
  type PressableProps,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { BrandRadius, BrandType } from "@/constants/brand";
import { AppSymbol } from "@/components/ui/app-symbol";
import { useKitTheme } from "./use-kit-theme";
import type { KitButtonProps } from "./types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const { color, background, foreground, border, shadow, isCustomStyle } = theme;
  if (variant === "primary") {
    return {
      backgroundColor: color.primary,
      borderColor: color.primaryPressed,
      textColor: foreground.primary,
      iconColor: foreground.primary,
      highlight: border.highlight,
      shadow: shadow.primaryLift,
    };
  }
  if (variant === "danger") {
    return {
      backgroundColor: color.danger,
      borderColor: color.danger,
      textColor: foreground.primary,
      iconColor: foreground.primary,
      highlight: border.highlight,
      shadow: shadow.surface,
    };
  }
  if (variant === "secondary") {
    return {
      backgroundColor: background.glass,
      borderColor: border.secondary,
      textColor: foreground.secondary,
      iconColor: color.primary,
      highlight: border.primary,
      shadow: isCustomStyle ? shadow.surface : undefined,
    };
  }
  return {
    backgroundColor: background.transparent,
    borderColor: border.secondary,
    textColor: color.primary,
    iconColor: color.primary,
    highlight: border.transparent,
  };
}

function getButtonSize(size: NonNullable<KitButtonProps["size"]>) {
  if (size === "sm") {
    return { minHeight: 44, horizontal: 14, fontSize: 14 };
  }
  if (size === "lg") {
    return { minHeight: 58, horizontal: 18, fontSize: 17 };
  }
  return { minHeight: 52, horizontal: 16, fontSize: 15 };
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
  const { interaction, isCustomStyle } = theme;
  const scale = useSharedValue(1);
  const colors = getButtonColors(variant, theme);
  const sizing = getButtonSize(size);
  const isDisabled = disabled || loading;
  const symbolTint = toSymbolTint(colors.iconColor, theme.symbol.defaultTint);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pressableProps: PressableProps = !isCustomStyle
    ? { android_ripple: { color: interaction.ripple as string } }
    : {};

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPressIn={() => {
        scale.value = withSpring(0.965, { damping: 14, stiffness: 340 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 18, stiffness: 280 });
      }}
      onPress={(event) => {
        if (!isDisabled && process.env.EXPO_OS === "ios") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress(event);
      }}
      style={[
        animatedStyle,
        {
          minHeight: sizing.minHeight,
          borderWidth: variant === "ghost" ? 1 : 1.2,
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
      {...pressableProps}
    >
      {variant !== "ghost" ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 1,
            right: 1,
            height: "48%",
            borderTopLeftRadius: BrandRadius.button,
            borderTopRightRadius: BrandRadius.button,
            borderTopWidth: 1,
            borderColor: colors.highlight,
            opacity: 0.8,
          }}
        />
      ) : null}
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
          ...BrandType.bodyStrong,
          color: colors.textColor,
          fontSize: sizing.fontSize,
          letterSpacing: 0.22,
          includeFontPadding: false,
        }}
      >
        {label}
      </Text>
      {trailingIcon ? <View>{trailingIcon}</View> : null}
    </AnimatedPressable>
  );
}
