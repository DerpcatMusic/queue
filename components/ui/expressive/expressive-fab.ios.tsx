import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { useExpressivePalette } from "./use-expressive-palette";
import type { ExpressiveFabProps } from "./types";

export function ExpressiveFab({
  icon,
  onPress,
  badgeLabel,
  selected = false,
  disabled = false,
  style,
}: ExpressiveFabProps) {
  const { palette, glassOverlay } = useExpressivePalette();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected ? palette.primary : glassOverlay,
          borderColor: selected ? palette.primaryPressed : palette.border,
          opacity: disabled ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {icon}
      {badgeLabel ? (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: selected ? palette.onPrimary : palette.primary,
            },
          ]}
        >
          <Text
            style={{
              color: selected ? palette.primary : palette.onPrimary,
              fontSize: 10,
              fontWeight: "700",
            }}
          >
            {badgeLabel}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});
