import type { ImageSourcePropType } from "react-native";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

type CalendarConnectionRowProps = {
  iconSource: ImageSourcePropType;
  title: string;
  detail: string;
  connected: boolean;
  loading?: boolean;
  onPress: () => void;
  showDivider?: boolean;
};

export function CalendarConnectionRow({
  iconSource,
  title,
  detail,
  connected,
  loading = false,
  onPress,
  showDivider = false,
}: CalendarConnectionRowProps) {
  const { color: palette } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: palette.surfaceAlt } : null,
      ]}
    >
      <View
        style={[
          styles.rowInner,
          showDivider
            ? {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: palette.border,
              }
            : null,
        ]}
      >
        <Image source={iconSource} style={styles.icon} resizeMode="cover" />

        <View style={styles.copy}>
          <Text style={[styles.title]} className="text-brand">
            {title}
          </Text>
          <Text style={[styles.detail]} className="text-muted">
            {detail}
          </Text>
        </View>

        <View style={styles.trailing}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <AppSymbol
              name={connected ? "checkmark.circle.fill" : "chevron.right"}
              size={BrandSpacing.iconMd - BrandSpacing.xs / 2}
              tintColor={connected ? palette.primary : palette.textMuted}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 92,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.sm,
    paddingHorizontal: BrandSpacing.lg,
    paddingVertical: BrandSpacing.md,
  },
  icon: {
    width: BrandSpacing.controlLg,
    height: BrandSpacing.controlLg,
    borderRadius: BrandRadius.input,
  },
  copy: {
    flex: 1,
    gap: BrandSpacing.xs,
  },
  title: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 22,
  },
  detail: {
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 20,
  },
  trailing: {
    width: BrandSpacing.xl,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
