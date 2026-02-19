import { Pressable, StyleSheet, Text, View } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { useExpressivePalette } from "./use-expressive-palette";
import type { ExpressiveButtonProps } from "./types";

export function ExpressiveButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  style,
  leadingIcon,
}: ExpressiveButtonProps) {
  const { palette } = useExpressivePalette();

  const colors =
    variant === "primary"
      ? {
          backgroundColor: palette.primary,
          borderColor: palette.primaryPressed,
          textColor: palette.onPrimary,
        }
      : variant === "secondary"
        ? {
            backgroundColor: palette.surfaceElevated,
            borderColor: palette.borderStrong,
            textColor: palette.text,
          }
        : {
            backgroundColor: "transparent",
            borderColor: palette.border,
            textColor: palette.text,
          };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      android_ripple={{ color: palette.primarySubtle }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          opacity: disabled ? 0.52 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        style,
      ]}
    >
      {leadingIcon ? <View style={styles.iconWrap}>{leadingIcon}</View> : null}
      <Text style={[styles.label, { color: colors.textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    elevation: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.22,
  },
  iconWrap: {
    marginRight: 8,
  },
});
