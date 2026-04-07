import { Image } from "expo-image";
import { memo } from "react";
import type { ImageSourcePropType } from "react-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Text } from "@/primitives";
const BRIGHT_LIME = "#CCFF00";

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
  const { color: palette } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? palette.surfaceAlt : palette.surfaceElevated,
        },
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
          <Image source={iconSource as number} style={styles.icon} contentFit="cover" />

        <View style={styles.copy}>
          <Text style={[styles.title, { color: BRIGHT_LIME }]}>{title}</Text>
          <Text style={[styles.detail, { color: palette.textMuted }]}>{detail}</Text>
        </View>

        <View style={styles.trailing}>
          {loading ? (
            <ActivityIndicator size="small" color={BRIGHT_LIME} />
          ) : (
            <AppSymbol
              name={connected ? "checkmark.circle.fill" : "chevron.right"}
              size={BrandSpacing.iconMd - BrandSpacing.xs / 2}
              tintColor={connected ? BRIGHT_LIME : palette.textMuted}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
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
    fontFamily: "Manrope_600SemiBold",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 22,
  },
  detail: {
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
});
