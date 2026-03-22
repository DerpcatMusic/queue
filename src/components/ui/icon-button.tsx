import { Pressable, View } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";

type IconButtonProps = {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: "primary" | "secondary" | "primarySubtle";
  size?: number;
  disabled?: boolean;
  backgroundColorOverride?: string;
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = "secondary",
  size = 54,
  disabled = false,
  backgroundColorOverride,
}: IconButtonProps) {
  const palette = useBrand();
  const backgroundColor =
    backgroundColorOverride ??
    (disabled
    ? tone === "primary" || tone === "primarySubtle"
      ? (palette.primarySubtle as string)
      : (palette.surface as string)
    : tone === "primary"
      ? (palette.primary as string)
      : tone === "primarySubtle"
        ? (palette.primarySubtle as string)
        : (palette.surfaceAlt as string));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: disabled ? 0.6 : pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: BrandRadius.button - 2,
          borderCurve: "continuous",
          backgroundColor,
          overflow: "hidden",
        }}
      >
        <View>{icon}</View>
      </View>
    </Pressable>
  );
}
