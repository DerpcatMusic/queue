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
  /** Current week start day key (ISO week start = Monday) */
  weekStartDay: string;
};

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

function CalendarWeekPicker({ selectedDay, todayKey, weekStartDay }: CalendarWeekPickerProps) {
  const { color: palette } = useTheme();

  // Generate the 7 days of the week starting from weekStartDay
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dayKey = addDays(weekStartDay, i);
      const date = new Date(dayKey + "T00:00:00");
      return {
        dayKey,
        dayLabel: DAY_LABELS[i] ?? " ",
        dayNumber: date.getDate(),
        isToday: dayKey === todayKey,
        isSelected: dayKey === selectedDay,
      };
    });
  }, [weekStartDay, todayKey, selectedDay]);

  const monthYear = useMemo(() => formatMonthYear(weekStartDay, "en-US"), [weekStartDay]);

  const weekNumber = useMemo(() => getWeekNumber(weekStartDay), [weekStartDay]);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.root}>
      {/* Month/Year and Week Number Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.monthYear, { color: palette.onPrimary }]}>
          {monthYear.toUpperCase()}
        </Text>
        <Text style={[styles.weekNumber, { color: palette.onPrimary }]}>WK {weekNumber}</Text>
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
  const { color: palette } = useTheme();

  // Only today gets the primary highlight with glow
  // Selected day uses a different color (surfaceElevated with border) so it's visible but distinct
  const isTodayActive = isToday;
  const isSelectedActive = isSelected && !isToday;

  // Use surfaceElevated for both but give today a distinct border ring
  const backgroundColor = palette.surfaceElevated;

  const labelColor = isTodayActive
    ? palette.text
    : isSelectedActive
      ? palette.text
      : palette.textMuted;

  const numberColor = isTodayActive ? palette.text : isSelectedActive ? palette.text : palette.text;

  // Today gets a primary color ring/border to stand out from sheet bg
  const borderColor = isTodayActive ? palette.primary : "transparent";
  const borderWidth = isTodayActive ? 2 : 0;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      style={[
        styles.dayCell,
        {
          backgroundColor,
          borderColor,
          borderWidth,
          shadowColor: palette.primary,
          shadowOpacity: isToday ? 0.4 : 0,
          shadowRadius: isToday ? 12 : 0,
        },
      ]}
    >
      <Text style={[styles.dayLabel, { color: labelColor }]}>{dayLabel}</Text>
      <Text
        style={[
          styles.dayNumber,
          {
            color: numberColor,
            fontWeight: isTodayActive ? "800" : "700",
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
    opacity: 0.7,
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
