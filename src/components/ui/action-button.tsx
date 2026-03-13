import { ActivityIndicator, Pressable, Text } from "react-native";

import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandType } from "@/constants/brand";

type ActionButtonTone = "primary" | "secondary";

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  palette: BrandPalette;
  tone?: ActionButtonTone;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
};

export function ActionButton({
  label,
  onPress,
  palette,
  tone = "primary",
  disabled = false,
  loading = false,
  fullWidth = false,
}: ActionButtonProps) {
  const isDisabled = disabled || loading;
  const backgroundColor =
    tone === "primary" ? (palette.primary as string) : (palette.surface as string);
  const borderColor = tone === "primary" ? "transparent" : (palette.borderStrong as string);
  const textColor = tone === "primary" ? (palette.onPrimary as string) : (palette.text as string);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 42,
        minWidth: 96,
        alignSelf: fullWidth ? "stretch" : "flex-start",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: tone === "primary" ? 0 : 1,
        borderRadius: BrandRadius.button,
        borderCurve: "continuous",
        borderColor,
        backgroundColor,
        opacity: isDisabled ? 0.6 : pressed ? 0.92 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          style={{
            ...BrandType.bodyMedium,
            color: textColor,
            includeFontPadding: false,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
