import { Image } from "expo-image";
import { memo } from "react";
import type { ImageSourcePropType } from "react-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { Text } from "@/primitives";

type CalendarConnectionRowProps = {
  iconSource: ImageSourcePropType;
  title: string;
  detail: string;
  connected: boolean;
  loading?: boolean;
  onPress: () => void;
  showDivider?: boolean;
};

export const CalendarConnectionRow = memo(function CalendarConnectionRow({
  iconSource,
  title,
  detail,
  connected,
  loading = false,
  onPress,
  showDivider = false,
}: CalendarConnectionRowProps) {
  const { theme } = useUnistyles();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.color.surfaceMuted : theme.color.surfaceElevated,
        },
      ]}
    >
      <View
        style={[
          styles.rowInner,
          showDivider
            ? {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.color.border,
              }
            : null,
        ]}
      >
        <Image source={iconSource as number} style={styles.icon} contentFit="cover" />

        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>

        <View style={styles.trailing}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.color.primary} />
          ) : (
            <AppSymbol
              name={connected ? "checkmark.circle.fill" : "chevron.right"}
              size={BrandSpacing.iconMd - BrandSpacing.xs / 2}
              tintColor={connected ? theme.color.primary : theme.color.textMuted}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: 92,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
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
    color: theme.color.primary,
    fontFamily: "Manrope_600SemiBold",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 22,
  },
  detail: {
    color: theme.color.textMuted,
    fontFamily: "Manrope_400Regular",
    fontSize: BrandType.body.fontSize,
    fontWeight: "400",
    lineHeight: 20,
  },
  trailing: {
    width: BrandSpacing.xl,
    alignItems: "flex-end",
    justifyContent: "center",
  },
}));
