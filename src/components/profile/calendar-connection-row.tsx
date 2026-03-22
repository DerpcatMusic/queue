import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ImageSourcePropType } from "react-native";

import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandRadius, BrandSpacing, BrandType, type BrandPalette } from "@/constants/brand";

type CalendarConnectionRowProps = {
  iconSource: ImageSourcePropType;
  title: string;
  detail: string;
  connected: boolean;
  loading?: boolean;
  onPress: () => void;
  palette: BrandPalette;
  showDivider?: boolean;
};

export function CalendarConnectionRow({
  iconSource,
  title,
  detail,
  connected,
  loading = false,
  onPress,
  palette,
  showDivider = false,
}: CalendarConnectionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: palette.surfaceAlt as string } : null,
      ]}
    >
      <View
        style={[
          styles.rowInner,
          showDivider
            ? {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: palette.border as string,
              }
            : null,
        ]}
      >
        <Image source={iconSource} style={styles.icon} resizeMode="cover" />

        <View style={styles.copy}>
          <Text style={[styles.title, { color: palette.text as string }]}>{title}</Text>
          <Text style={[styles.detail, { color: palette.textMuted as string }]}>{detail}</Text>
        </View>

        <View style={styles.trailing}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary as string} />
          ) : (
            <AppSymbol
              name={connected ? "checkmark.circle.fill" : "chevron.right"}
              size={22}
              tintColor={connected ? (palette.primary as string) : (palette.textMuted as string)}
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
    gap: BrandSpacing.md,
    paddingHorizontal: BrandSpacing.lg,
    paddingVertical: BrandSpacing.md,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: BrandRadius.input,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...BrandType.bodyStrong,
    fontSize: 18,
    lineHeight: 22,
  },
  detail: {
    ...BrandType.body,
    fontSize: 15,
    lineHeight: 20,
  },
  trailing: {
    width: 24,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
