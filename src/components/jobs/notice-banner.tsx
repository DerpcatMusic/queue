import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, type ColorValue, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";

type NoticeBannerProps = {
  tone: "success" | "error";
  message: string;
  onDismiss: () => void;
  borderColor: ColorValue;
  backgroundColor: ColorValue;
  textColor: ColorValue;
  iconColor: ColorValue;
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
  return (
    <Pressable
      accessibilityRole="alert"
      style={[styles.container, { borderColor, backgroundColor }, style]}
    >
      <MaterialIcons
        name={tone === "success" ? "check-circle" : "error-outline"}
        size={18}
        color={iconColor}
      />
      <ThemedText selectable style={[styles.copy, { color: textColor }]}>
        {message}
      </ThemedText>
      <Pressable
        hitSlop={8}
        onPress={onDismiss}
        style={styles.dismiss}
        accessibilityRole="button"
      >
        <MaterialIcons name="close" size={16} color={textColor} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
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
