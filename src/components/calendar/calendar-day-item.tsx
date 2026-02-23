import { useBrand } from "@/hooks/use-brand";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import * as Haptics from "expo-haptics";

type CalendarDayItemProps = {
  dateUnix: number;
  focusedDate: string;
  todayDateOnly: string;
  goToFocusedDate: (dateOnly: string, animated: boolean) => void;
  toDateOnly: (date: Date) => string;
};

export function CalendarDayItem({
  dateUnix,
  focusedDate,
  todayDateOnly,
  goToFocusedDate,
  toDateOnly,
}: CalendarDayItemProps) {
  const { i18n } = useTranslation();
  const palette = useBrand();
  const calendarAccent = palette.calendar.accent;
  const locale = i18n.language || "en";

  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
      }),
    [locale],
  );

  const emitSelectionHaptic = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
  }, []);

  const date = new Date(dateUnix);
  const dateOnly = toDateOnly(date);
  const isToday = dateOnly === todayDateOnly;
  const isFocused = dateOnly === focusedDate;

  return (
    <Pressable
      onPress={() => {
        if (!isFocused) {
          goToFocusedDate(dateOnly, true);
        }
        emitSelectionHaptic();
      }}
      android_ripple={{
        color: palette.calendar.accentSubtle as any,
        borderless: false,
      }}
      style={styles.calendarDayItemPressable}
    >
      <View style={styles.calendarDayItem}>
        <Animated.Text
          style={[
            styles.calendarDayWeekday,
            {
              color: isFocused
                ? calendarAccent
                : isToday
                  ? palette.text
                  : palette.textMuted,
            },
          ]}
          numberOfLines={1}
        >
          {dayFormatter.format(date)}
        </Animated.Text>
        <View style={styles.calendarDayNumberWrap}>
          <Animated.Text
            style={[
              styles.calendarDayNumber,
              {
                color: isFocused ? calendarAccent : palette.text,
              },
            ]}
            numberOfLines={1}
          >
            {date.getDate().toString()}
          </Animated.Text>
        </View>
        <View
          style={[
            styles.calendarDayDot,
            isToday
              ? { backgroundColor: calendarAccent, opacity: 1 }
              : { opacity: 0 },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  calendarDayItemPressable: {
    flex: 1,
  },
  calendarDayItem: {
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    paddingTop: 8,
    paddingBottom: 6,
    gap: 1,
  },
  calendarDayWeekday: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 15,
    textTransform: "uppercase",
  },
  calendarDayNumberWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayNumber: {
    fontSize: 22,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    lineHeight: 26,
  },
  calendarDayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
