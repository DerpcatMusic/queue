import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type ColorValue, Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";

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

export function NoticeBanner({
  tone,
  message,
  onDismiss,
  borderColor,
  backgroundColor,
  textColor,
  iconColor,
  style,
}: NoticeBannerProps) {
  const palette = useBrand();
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
      <MaterialIcons
        name={tone === "success" ? "check-circle" : "error-outline"}
        size={18}
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
        <MaterialIcons name="close" size={16} color={String(resolvedTextColor)} />
      </Pressable>
    </View>
  );
}

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
    minHeight: 20,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
