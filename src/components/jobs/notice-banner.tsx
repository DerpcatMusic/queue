import { memo } from "react";
import { type ColorValue, Pressable, View, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { IconSize } from "@/lib/design-system";

type NoticeBannerProps = {
  tone: "success" | "error";
  message: string;
  onDismiss: () => void;
  borderColor?: ColorValue;
  backgroundColor?: ColorValue;
  textColor?: ColorValue;
  iconColor?: ColorValue;
  style?: ViewStyle;
};

export const NoticeBanner = memo(function NoticeBanner({
  tone,
  message,
  onDismiss,
  borderColor,
  backgroundColor,
  textColor,
  iconColor,
  style,
}: NoticeBannerProps) {
  const { color: palette } = useTheme();
  const toneColors =
    tone === "success"
      ? {
          borderColor: palette.success,
          backgroundColor: palette.successSubtle,
          textColor: palette.success,
          iconColor: palette.success,
        }
      : {
          borderColor: palette.danger,
          backgroundColor: palette.dangerSubtle,
          textColor: palette.danger,
          iconColor: palette.danger,
        };

  const resolvedBorderColor = borderColor ?? toneColors.borderColor;
  const resolvedBackgroundColor = backgroundColor ?? toneColors.backgroundColor;
  const resolvedTextColor = textColor ?? toneColors.textColor;
  const resolvedIconColor = iconColor ?? toneColors.iconColor;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.container,
        { borderColor: resolvedBorderColor, backgroundColor: resolvedBackgroundColor },
        style,
      ]}
    >
      <IconSymbol
        name={tone === "success" ? "checkmark.circle.fill" : "exclamationmark.circle"}
        size={IconSize.md}
        color={resolvedIconColor}
      />
      <ThemedText selectable style={[styles.copy, { color: resolvedTextColor }]}>
        {message}
      </ThemedText>
      <Pressable
        hitSlop={8}
        onPress={onDismiss}
        accessibilityRole="button"
        style={({ pressed }) => [styles.dismiss, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
      >
        <IconSymbol name="xmark" size={IconSize.sm} color={String(resolvedTextColor)} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: BrandRadius.buttonSubtle,
    borderCurve: "continuous",
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: BrandSpacing.sm,
  },
  copy: {
    flex: 1,
  },
  dismiss: {
    minHeight: IconSize.md,
    minWidth: IconSize.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
