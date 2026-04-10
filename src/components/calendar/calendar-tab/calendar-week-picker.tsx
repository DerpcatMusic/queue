import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Text } from "@/primitives";
import { formatMonthYear } from "./calendar-date-utils";

type CalendarWeekPickerProps = {
  selectedDay: string;
  todayKey: string;
  /** Ignored — always centers on today. */
  startDay: string;
};

function CalendarWeekPicker({ selectedDay, todayKey }: CalendarWeekPickerProps) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const { color: palette } = theme;

  const monthYear = useMemo(
    () => formatMonthYear(todayKey, i18n.resolvedLanguage ?? "en"),
    [i18n.resolvedLanguage, todayKey],
  );

  const todayDate = useMemo(() => {
    const d = new Date(todayKey + "T00:00:00");
    return {
      dayNumber: d.getDate(),
      weekday: d.toLocaleDateString(i18n.resolvedLanguage ?? "en", { weekday: "long" }),
    };
  }, [todayKey, i18n.resolvedLanguage]);

  const isViewingToday = selectedDay === todayKey;

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.root}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.monthYear, { color: palette.text }]}>{monthYear.toUpperCase()}</Text>
          <Text
            style={[
              styles.weekday,
              { color: isViewingToday ? palette.primary : palette.textMuted },
            ]}
          >
            {todayDate.weekday}
          </Text>
        </View>
        <View style={[styles.todayBadge, { backgroundColor: palette.primary }]}>
          <Text style={[styles.todayBadgeText, { color: palette.onPrimary }]}>
            {todayDate.dayNumber}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: BrandSpacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: BrandSpacing.xs,
  },
  headerLeft: {
    gap: BrandSpacing.xxs,
  },
  monthYear: {
    ...BrandType.heading,
    fontWeight: "700",
    letterSpacing: -0.45,
  },
  weekday: {
    ...BrandType.micro,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  todayBadge: {
    width: 44,
    height: 44,
    borderRadius: BrandRadius.card,
    alignItems: "center",
    justifyContent: "center",
  },
  todayBadgeText: {
    fontFamily: "Lexend_800ExtraBold",
    fontSize: 18,
    fontWeight: "800",
  },
});

export default memo(CalendarWeekPicker);
