import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { BrandRadius } from "@/constants/brand";
import { useKitTheme } from "./use-kit-theme";
import type { KitFabProps } from "./types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function KitFab({
  icon,
  onPress,
  badgeLabel,
  selected = false,
  disabled = false,
  style,
}: KitFabProps) {
  const { palette, isCustomStyle, primaryLiftShadow, glassBackground } = useKitTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      {...(!isCustomStyle ? { android_ripple: { color: palette.primarySubtle as string } } : {})}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 14, stiffness: 340 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 18, stiffness: 280 });
      }}
      onPress={() => {
        if (process.env.EXPO_OS === "ios") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      style={[
        animatedStyle,
        {
          width: 58,
          height: 58,
          borderWidth: 1.2,
          borderRadius: BrandRadius.button,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? palette.primary : glassBackground,
          borderColor: selected ? palette.primaryPressed : palette.borderStrong,
          opacity: disabled ? 0.55 : 1,
          boxShadow: selected ? primaryLiftShadow : undefined,
          overflow: "visible",
        },
        style,
      ]}
    >
      {icon}
      {badgeLabel ? (
        <View
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 4,
            borderWidth: 1,
            borderColor: selected ? palette.primaryPressed : palette.primary,
            backgroundColor: selected ? palette.onPrimary : palette.primary,
          }}
        >
          <Text
            style={{
              color: selected ? palette.primary : palette.onPrimary,
              fontSize: 10,
              fontWeight: "700",
              includeFontPadding: false,
            }}
          >
            {badgeLabel}
          </Text>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

