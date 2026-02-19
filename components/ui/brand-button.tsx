import * as Haptics from "expo-haptics";
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Brand, BrandRadius, BrandShadow } from "@/constants/brand";
import { useColorScheme } from "@/hooks/use-color-scheme";

type BrandButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function BrandButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  style,
}: BrandButtonProps) {
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      android_ripple={{ color: palette.primarySubtle }}
      disabled={disabled}
      onPress={() => {
        if (process.env.EXPO_OS === "ios") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isPrimary ? palette.primary : palette.surfaceElevated,
          borderColor: isPrimary ? palette.primaryPressed : palette.borderStrong,
          boxShadow: disabled
            ? "none"
            : isPrimary
              ? BrandShadow.raised
              : BrandShadow.soft,
          opacity: disabled ? 0.55 : 1,
          transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: isPrimary ? palette.onPrimary : palette.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
