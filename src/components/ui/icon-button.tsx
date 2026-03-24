import { Pressable, View } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { getSurfaceElevationStyle } from "./surface-elevation";

type IconButtonProps = {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: "primary" | "secondary" | "primarySubtle";
  size?: number;
  disabled?: boolean;
  backgroundColorOverride?: string;
  floating?: boolean;
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = "secondary",
  size = 54,
  disabled = false,
  backgroundColorOverride,
  floating = false,
}: IconButtonProps) {
  const palette = useBrand();
  const raisedStyle = floating ? getSurfaceElevationStyle(palette, "floating") : undefined;
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
  const pressedBackgroundColor =
    tone === "primary"
      ? (palette.primaryPressed as string)
      : tone === "primarySubtle"
        ? (palette.surfaceElevated as string)
        : (palette.surfaceElevated as string);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: BrandRadius.buttonSubtle,
          borderCurve: "continuous",
          backgroundColor: disabled
            ? backgroundColor
            : pressed
              ? pressedBackgroundColor
              : backgroundColor,
          ...(raisedStyle ?? {}),
        },
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: BrandRadius.buttonSubtle,
          borderCurve: "continuous",
          backgroundColor: disabled ? backgroundColor : undefined,
          overflow: "hidden",
        }}
      >
        <View>{icon}</View>
      </View>
    </Pressable>
  );
}
