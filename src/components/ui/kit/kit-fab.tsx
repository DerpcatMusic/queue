import { Text, View } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { KitPressable } from "./kit-pressable";
import type { KitFabProps } from "./types";
import { useKitTheme } from "./use-kit-theme";

export function KitFab({
  icon,
  onPress,
  badgeLabel,
  selected = false,
  disabled = false,
  style,
}: KitFabProps) {
  const { color, foreground, background, border, shadow, isCustomStyle } = useKitTheme();

  return (
    <KitPressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      haptic="impact"
      nativeFeedback={!isCustomStyle}
      pressStyle={disabled ? undefined : { transform: [{ scale: 0.985 }] }}
      style={[
        {
          width: 58,
          height: 58,
          borderWidth: 1.2,
          borderRadius: BrandRadius.button,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? color.primary : background.glass,
          borderColor: selected ? color.primaryPressed : border.secondary,
          opacity: disabled ? 0.55 : 1,
          boxShadow: selected ? shadow.primaryLift : undefined,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {icon}
      {badgeLabel ? (
        <View
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 4,
            borderWidth: 1,
            borderColor: selected ? color.primaryPressed : color.primary,
            backgroundColor: selected ? foreground.primary : color.primary,
          }}
        >
          <Text
            style={{
              color: selected ? color.primary : foreground.primary,
              fontSize: 10,
              fontWeight: "700",
              includeFontPadding: false,
            }}
          >
            {badgeLabel}
          </Text>
        </View>
      ) : null}
    </KitPressable>
  );
}
