import { memo, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { addDays } from "../calendar-controller-helpers";
import { formatMonthYear } from "./calendar-date-utils";

type CalendarWeekPickerProps = {
  selectedDay: string;
  todayKey: string;
  /** First visible day in the rolling 7-day strip. */
  startDay: string;
};

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

function CalendarWeekPicker({ selectedDay, todayKey, startDay }: CalendarWeekPickerProps) {
  const theme = useTheme();
  const { color: palette } = theme;
  const headingColor = palette.onPrimary;
  const subheadingColor = palette.onPrimary;

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dayKey = addDays(startDay, i);
      const date = new Date(dayKey + "T00:00:00");
      return {
        dayKey,
        dayLabel: DAY_LABELS[i] ?? " ",
        dayNumber: date.getDate(),
        isToday: dayKey === todayKey,
        isSelected: dayKey === selectedDay,
      };
    });
  }, [selectedDay, startDay, todayKey]);

  const monthYear = useMemo(() => formatMonthYear(startDay, "en-US"), [startDay]);

  const weekNumber = useMemo(() => getWeekNumber(startDay), [startDay]);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.root}>
      {/* Month/Year and Week Number Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.monthYear, { color: headingColor }]}>
          {monthYear.toUpperCase()}
        </Text>
        <Text style={[styles.weekNumber, { color: subheadingColor }]}>WK {weekNumber}</Text>
      </View>

      {/* Days Row - Read-only, for display only */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daysContainer}
      >
        {weekDays.map(({ dayKey, dayLabel, dayNumber, isToday, isSelected }) => (
          <DayCell
            key={dayKey}
            dayLabel={dayLabel}
            dayNumber={dayNumber}
            isToday={isToday}
            isSelected={isSelected}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

type DayCellProps = {
  dayLabel: string;
  dayNumber: number;
  isToday: boolean;
  isSelected: boolean;
};

const DayCell = memo(function DayCell({ dayLabel, dayNumber, isToday, isSelected }: DayCellProps) {
  const theme = useTheme();
  const { color: palette } = theme;
  const isAnchorDay = isToday || isSelected;
  const backgroundColor = isAnchorDay
    ? palette.surfaceElevated
    : theme.scheme === "light"
      ? palette.text
      : palette.surface;
  const labelColor = isAnchorDay
    ? palette.textMuted
    : theme.scheme === "light"
      ? palette.surfaceAlt
      : palette.textMicro;
  const numberColor = isAnchorDay
    ? palette.text
    : theme.scheme === "light"
      ? palette.surfaceElevated
      : palette.text;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      style={[
        styles.dayCell,
        {
          backgroundColor,
          shadowColor: "transparent",
          shadowOpacity: 0,
          shadowRadius: 0,
          elevation: 0,
        },
      ]}
    >
      <Text style={[styles.dayLabel, { color: labelColor }]}>{dayLabel}</Text>
      <Text
        style={[
          styles.dayNumber,
          {
            color: numberColor,
            fontWeight: isAnchorDay ? "800" : "700",
          },
        ]}
      >
        {dayNumber}
      </Text>
    </Animated.View>
  );
});

// Helper functions
function getWeekNumber(dayKey: string): number {
  const date = new Date(dayKey + "T00:00:00");
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

const styles = StyleSheet.create({
  root: {
    gap: BrandSpacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: BrandSpacing.xs,
  },
  monthYear: {
    ...BrandType.heading,
    fontWeight: "700",
    letterSpacing: -0.45,
  },
  weekNumber: {
    ...BrandType.micro,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  daysContainer: {
    flexDirection: "row",
    gap: BrandSpacing.sm,
    paddingHorizontal: BrandSpacing.xs,
  },
  dayCell: {
    width: 44,
    height: 56,
    borderRadius: BrandRadius.card,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  dayLabel: {
    fontFamily: "Manrope_500Medium",
    fontSize: 8,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.1,
  },
  dayNumber: {
    fontFamily: "Lexend_700Bold",
    fontSize: 14,
    fontWeight: "700",
  },
});

export default memo(CalendarWeekPicker);
