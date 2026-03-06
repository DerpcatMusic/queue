import { FlashList } from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { LoadingScreen } from "@/components/loading-screen";
import { KitPressable } from "@/components/ui/kit";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { formatTime } from "@/lib/jobs-utils";
import { type TimelineListItem, useCalendarTabController } from "./use-calendar-tab-controller";

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

const RAIL_LEFT = 24;
const RAIL_DOT_DAY = 10;
const RAIL_DOT_LESSON = 6;
const SWIPE_THRESHOLD = 50;

// ─── Date helpers ────────────────────────────────────────────────────────────

function toDayKey(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayKeyToTimestamp(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getTime();
}

function addDays(dayKey: string, delta: number) {
  return toDayKey(dayKeyToTimestamp(dayKey) + delta * DAY_MS);
}

function addMonths(dayKey: string, delta: number) {
  const currentDate = new Date(dayKeyToTimestamp(dayKey));
  const nextDate = new Date(currentDate);
  nextDate.setDate(1);
  nextDate.setMonth(nextDate.getMonth() + delta);
  const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
  nextDate.setDate(Math.min(currentDate.getDate(), lastDayOfMonth));
  return toDayKey(nextDate.getTime());
}

function compareDayKey(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function resolveFirstDayOfWeek(locale: string) {
  try {
    const localeInfo = new Intl.Locale(locale as string) as Intl.Locale & {
      weekInfo?: { firstDay?: number };
    };
    const firstDay = localeInfo.weekInfo?.firstDay;
    if (typeof firstDay === "number") {
      return firstDay % 7;
    }
  } catch {
    // Fallback below.
  }

  return locale.toLowerCase().startsWith("en-us") ? 0 : 1;
}

function getWeekStart(dayKey: string, firstDayOfWeek: number) {
  const ts = dayKeyToTimestamp(dayKey);
  const d = new Date(ts);
  const dow = d.getDay();
  const offset = (7 + dow - firstDayOfWeek) % 7;
  return toDayKey(ts - offset * DAY_MS);
}

function getWeekDays(weekStartKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartKey, i));
}

function getMonthWeeks(monthDayKey: string, firstDayOfWeek: number): string[][] {
  const ts = dayKeyToTimestamp(monthDayKey);
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const weeks: string[][] = [];
  let cursor = getWeekStart(toDayKey(firstDay.getTime()), firstDayOfWeek);
  const lastDayKey = toDayKey(lastDay.getTime());
  while (true) {
    const week = getWeekDays(cursor);
    weeks.push(week);
    // Stop if the week's last day is past the month's last day
    if (compareDayKey(week[6]!, lastDayKey) >= 0) break;
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

function getMonthStart(dayKey: string) {
  const ts = dayKeyToTimestamp(dayKey);
  const d = new Date(ts);
  return toDayKey(new Date(d.getFullYear(), d.getMonth(), 1).getTime());
}

// Format: "January 15" (month + day number)
function formatDayHeading(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
  });
}

// Format: "Monday"
function formatDaySubtitle(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "long",
  });
}

function formatMonthYear(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function formatWeekdayLabel(dayKey: string, locale: string) {
  const label = new Date(dayKeyToTimestamp(dayKey))
    .toLocaleDateString(locale, { weekday: "short" })
    .replace(/\./g, "")
    .replace(/\s+/g, "");

  const glyphs = Array.from(label);
  if (glyphs.length <= 2) {
    return label.toUpperCase();
  }
  return glyphs.slice(0, 2).join("").toUpperCase();
}

function formatDayNumber(dayKey: string) {
  return String(new Date(dayKeyToTimestamp(dayKey)).getDate());
}

function isSameMonth(dayKeyA: string, dayKeyB: string) {
  return dayKeyA.substring(0, 7) === dayKeyB.substring(0, 7);
}

function hashSport(sport: string) {
  let h = 0;
  for (let i = 0; i < sport.length; i++) {
    h = sport.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

// ─── WeekStrip (live-sliding, dynamic height) ────────────────────────────────

const WEEK_ROW_HEIGHT = 46; // height of one row of day cells
const DRAG_HANDLE_HEIGHT = 16; // drag bar area
const HEADER_HEIGHT = 44; // month label row
const LABELS_HEIGHT = 20; // weekday letter labels

function WeekStrip({
  selectedDay,
  isExpanded,
  onExpandedChange,
  onDayPress,
  onWeekChange,
  onMonthChange,
  onTodayPress,
  lessonCountByDay,
  locale,
  todayLabel,
  monthButtonLabel,
  dragHandleLabel,
  weekViewLabel,
  monthViewLabel,
}: {
  selectedDay: string;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onDayPress: (dayKey: string) => void;
  onWeekChange: (delta: number) => void;
  onMonthChange: (delta: number) => void;
  onTodayPress: () => void;
  lessonCountByDay: Map<string, number>;
  locale: string;
  todayLabel: string;
  monthButtonLabel: string;
  dragHandleLabel: string;
  weekViewLabel: string;
  monthViewLabel: string;
}) {
  const palette = useBrand();
  const todayKey = useMemo(() => toDayKey(Date.now()), []);
  const firstDayOfWeek = useMemo(() => resolveFirstDayOfWeek(locale), [locale]);
  const monthStart = getMonthStart(selectedDay);
  const monthWeeks = useMemo(
    () => getMonthWeeks(monthStart, firstDayOfWeek),
    [firstDayOfWeek, monthStart],
  );
  const selectedWeekIndex = useMemo(
    () =>
      Math.max(
        0,
        monthWeeks.findIndex((week) => week.includes(selectedDay)),
      ),
    [monthWeeks, selectedDay],
  );

  // How many extra rows beyond 1 does this month need?
  const extraRows = monthWeeks.length - 1;
  const weekHeight = WEEK_ROW_HEIGHT;
  const monthExtraHeight = extraRows * WEEK_ROW_HEIGHT;

  // ─── Single unified pan gesture ──────────────────────────────────────
  const swipeX = useSharedValue(0);
  const expandProgress = useSharedValue(0); // 0=week, 1=month
  const expandStartRef = useSharedValue(0);
  const gestureDirection = useSharedValue<"none" | "h" | "v">("none");
  const hapticFiredRef = useRef(false);

  const setExpanded = useCallback(
    (nextExpanded: boolean) => {
      onExpandedChange(nextExpanded);
    },
    [onExpandedChange],
  );

  const fireHapticOnce = useCallback(() => {
    if (!hapticFiredRef.current) {
      hapticFiredRef.current = true;
      triggerSelectionHaptic();
    }
  }, []);
  const resetHaptic = useCallback(() => {
    hapticFiredRef.current = false;
  }, []);

  const toggleExpanded = useCallback(() => {
    triggerSelectionHaptic();
    setExpanded(!isExpanded);
  }, [isExpanded, setExpanded]);

  useEffect(() => {
    expandProgress.value = withSpring(isExpanded ? 1 : 0, {
      damping: 18,
      stiffness: 200,
    });
  }, [expandProgress, isExpanded]);

  const panGesture = Gesture.Pan()
    .minDistance(5)
    .onStart(() => {
      gestureDirection.value = "none";
      expandStartRef.value = expandProgress.value;
    })
    .onUpdate((e) => {
      // Lock direction on first significant movement
      if (gestureDirection.value === "none") {
        if (
          Math.abs(e.translationX) > 10 &&
          Math.abs(e.translationX) > Math.abs(e.translationY) * 1.2
        ) {
          gestureDirection.value = "h";
        } else if (Math.abs(e.translationY) > 6) {
          gestureDirection.value = "v";
        }
        return;
      }

      if (gestureDirection.value === "h") {
        swipeX.value = e.translationX;
        if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
          runOnJS(fireHapticOnce)();
        }
      } else {
        // Vertical: map drag to expand progress
        const dragRange = Math.max(monthExtraHeight, 100) * 1.2;
        const rawProgress = expandStartRef.value + e.translationY / dragRange;
        expandProgress.value = Math.max(0, Math.min(1, rawProgress));
      }
    })
    .onEnd((e) => {
      runOnJS(resetHaptic)();

      if (gestureDirection.value === "h") {
        const isExpanded = expandProgress.value > 0.5;
        const animatedDistance = Math.sign(e.translationX || e.velocityX || 0) * 120;

        if (e.translationX < -SWIPE_THRESHOLD || (e.velocityX < -500 && e.translationX < -20)) {
          swipeX.value = withTiming(animatedDistance, { duration: 200 }, () => {
            if (isExpanded) {
              runOnJS(onMonthChange)(1);
            } else {
              runOnJS(onWeekChange)(1);
            }
            swipeX.value = 0;
          });
        } else if (e.translationX > SWIPE_THRESHOLD || (e.velocityX > 500 && e.translationX > 20)) {
          swipeX.value = withTiming(animatedDistance, { duration: 200 }, () => {
            if (isExpanded) {
              runOnJS(onMonthChange)(-1);
            } else {
              runOnJS(onWeekChange)(-1);
            }
            swipeX.value = 0;
          });
        } else {
          swipeX.value = withSpring(0, { damping: 20, stiffness: 300 });
        }
      } else if (gestureDirection.value === "v") {
        const nextExpanded = expandProgress.value > 0.35;
        runOnJS(setExpanded)(nextExpanded);
        runOnJS(triggerSelectionHaptic)();
      }

      gestureDirection.value = "none";
    });

  // Animated styles
  const swipeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: swipeX.value },
      {
        translateY: (1 - expandProgress.value) * -selectedWeekIndex * WEEK_ROW_HEIGHT,
      },
    ],
  }));

  const collapsedHeight = HEADER_HEIGHT + LABELS_HEIGHT + weekHeight + DRAG_HANDLE_HEIGHT;
  const expandedHeight = collapsedHeight + monthExtraHeight;

  const containerAnimStyle = useAnimatedStyle(() => ({
    height: collapsedHeight + expandProgress.value * monthExtraHeight,
  }));

  const renderDayCell = (dayKey: string) => {
    const isSelected = dayKey === selectedDay;
    const isToday = dayKey === todayKey;
    const hasLessons = (lessonCountByDay.get(dayKey) ?? 0) > 0;
    const lessonCount = lessonCountByDay.get(dayKey) ?? 0;
    const isCurrentMonth = isSameMonth(dayKey, monthStart);
    const dimmed = !isCurrentMonth;
    const dayDateLabel = new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    return (
      <KitPressable
        key={dayKey}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${dayDateLabel}. ${lessonCount} lessons.`}
        haptic="none"
        onPress={() => {
          onDayPress(dayKey);
          triggerSelectionHaptic();
        }}
        style={wStyles.dayCell}
      >
        <View
          style={[
            wStyles.dayCircle,
            isSelected && { backgroundColor: palette.primary as string },
            !isSelected &&
              isToday && {
                borderWidth: 1.5,
                borderColor: palette.primary as string,
              },
          ]}
        >
          <Text
            style={[
              wStyles.dayNumber,
              {
                color: isSelected
                  ? (palette.onPrimary as string)
                  : dimmed
                    ? (palette.textMicro as string)
                    : isToday
                      ? (palette.primary as string)
                      : (palette.text as string),
              },
              isSelected && { fontWeight: "600" },
            ]}
          >
            {formatDayNumber(dayKey)}
          </Text>
        </View>
        {hasLessons && !isSelected ? (
          <View style={[wStyles.dot, { backgroundColor: palette.primary as string }]} />
        ) : (
          <View style={wStyles.dotSpacer} />
        )}
      </KitPressable>
    );
  };

  return (
    <Animated.View
      style={[
        wStyles.container,
        { backgroundColor: palette.surface as string },
        Platform.OS === "web"
          ? { height: isExpanded ? expandedHeight : collapsedHeight }
          : containerAnimStyle,
      ]}
    >
      {/* Header */}
      <View style={wStyles.headerRow}>
        <KitPressable
          accessibilityRole="button"
          accessibilityLabel={monthButtonLabel}
          onPress={toggleExpanded}
          style={wStyles.monthButton}
          hitSlop={8}
        >
          <Text style={[wStyles.monthLabel, { color: palette.text as string }]}>
            {formatMonthYear(selectedDay, locale)}
          </Text>
        </KitPressable>
        <View style={wStyles.headerActions}>
          <View
            style={[
              wStyles.modePill,
              {
                backgroundColor: palette.surfaceElevated as string,
                borderColor: palette.border as string,
              },
            ]}
          >
            <Text style={[wStyles.modePillText, { color: palette.textMuted as string }]}>
              {isExpanded ? monthViewLabel : weekViewLabel}
            </Text>
          </View>
          {selectedDay !== todayKey ? (
            <KitPressable
              accessibilityRole="button"
              accessibilityLabel={todayLabel}
              onPress={onTodayPress}
              hitSlop={6}
            >
              <View
                style={[wStyles.todayPill, { backgroundColor: palette.primarySubtle as string }]}
              >
                <Text style={[wStyles.todayPillText, { color: palette.primary as string }]}>
                  {todayLabel}
                </Text>
              </View>
            </KitPressable>
          ) : null}
        </View>
      </View>

      {/* Weekday labels */}
      <View style={wStyles.weekdayLabels}>
        {getWeekDays(getWeekStart(selectedDay, firstDayOfWeek)).map((d) => (
          <View key={d} style={wStyles.weekdayLabelCell}>
            <Text style={[wStyles.weekdayLabel, { color: palette.textMuted as string }]}>
              {formatWeekdayLabel(d, locale)}
            </Text>
          </View>
        ))}
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ overflow: "hidden" }, swipeStyle]}>
          <View>
            {monthWeeks.map((week) => (
              <View key={`week-${week[0]}`} style={wStyles.weekRow}>
                {week.map((d) => renderDayCell(d))}
              </View>
            ))}
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Drag handle — enlarged touch target */}
      <KitPressable
        style={wStyles.dragHandle}
        accessibilityRole="button"
        accessibilityLabel={dragHandleLabel}
        haptic="none"
        onPress={toggleExpanded}
        hitSlop={{ top: 12, bottom: 12, left: 40, right: 40 }}
      >
        <View style={[wStyles.dragBar, { backgroundColor: palette.border as string }]} />
      </KitPressable>
    </Animated.View>
  );
}

const wStyles = StyleSheet.create({
  container: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: HEADER_HEIGHT,
  },
  monthButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modePill: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
  modePillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  todayPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderCurve: "continuous",
  },
  todayPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  weekdayLabels: {
    flexDirection: "row",
    paddingHorizontal: 8,
    height: LABELS_HEIGHT,
    alignItems: "center",
  },
  weekdayLabelCell: {
    flex: 1,
    alignItems: "center",
  },
  weekdayLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  weekRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    height: WEEK_ROW_HEIGHT,
    alignItems: "center",
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    gap: 1,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: "400",
    includeFontPadding: false,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dotSpacer: {
    width: 4,
    height: 4,
  },
  dragHandle: {
    alignItems: "center",
    height: DRAG_HANDLE_HEIGHT,
    justifyContent: "center",
  },
  dragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
});

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CalendarTabScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { tabContentBottom } = useAppInsets();
  const todayKey = useMemo(() => toDayKey(Date.now()), []);
  const [isMonthExpanded, setIsMonthExpanded] = useState(false);
  const [isMonthTransitioning, setIsMonthTransitioning] = useState(false);
  const monthTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    selectedDay,
    listRef,
    listItems,
    lessonCountByDay,
    viewabilityConfig,
    onViewableItemsChanged,
    handleDayPress,
    handleWeekChange,
    handleTodayPress,
    overrideItemLayout,
    isLoading,
  } = useCalendarTabController({
    freezeSelectedDayFromView: isMonthExpanded || isMonthTransitioning,
  });
  const handleExpandedChange = useCallback((expanded: boolean) => {
    setIsMonthTransitioning(true);
    setIsMonthExpanded(expanded);
    if (monthTransitionTimeoutRef.current) {
      clearTimeout(monthTransitionTimeoutRef.current);
    }
    monthTransitionTimeoutRef.current = setTimeout(() => {
      setIsMonthTransitioning(false);
      monthTransitionTimeoutRef.current = null;
    }, 360);
  }, []);

  useEffect(
    () => () => {
      if (monthTransitionTimeoutRef.current) {
        clearTimeout(monthTransitionTimeoutRef.current);
      }
    },
    [],
  );
  const handleMonthChange = useCallback(
    (deltaMonths: number) => {
      handleDayPress(addMonths(selectedDay, deltaMonths));
    },
    [handleDayPress, selectedDay],
  );

  // ─── Render items ───────────────────────────────────────────────────────────

  const railColor = (palette.border as string) ?? "#E5E5E5";
  const listFooterComponent = useMemo(
    () => <View style={{ height: tabContentBottom + 28 }} />,
    [tabContentBottom],
  );

  const renderItem = useCallback(
    ({ item }: { item: TimelineListItem }) => {
      if (item.kind === "dayHeader") {
        const isToday = item.dayKey === todayKey;
        const dotColor = isToday ? (palette.primary as string) : (palette.textMuted as string);

        return (
          <View style={styles.timelineRow}>
            <View style={styles.railGutter}>
              <View style={[styles.railLine, { backgroundColor: railColor }]} />
              <View
                style={[
                  styles.railDotDay,
                  { backgroundColor: dotColor },
                  isToday && {
                    backgroundColor: palette.primary as string,
                    width: RAIL_DOT_DAY + 2,
                    height: RAIL_DOT_DAY + 2,
                    borderRadius: (RAIL_DOT_DAY + 2) / 2,
                  },
                ]}
              />
            </View>
            <View style={styles.dayHeaderContent}>
              <Text style={[styles.dayHeading, { color: palette.text as string }]}>
                {formatDayHeading(item.dayKey, i18n.language)}
              </Text>
              <Text style={[styles.daySubtitle, { color: palette.textMuted as string }]}>
                {formatDaySubtitle(item.dayKey, i18n.language)}
              </Text>
            </View>
          </View>
        );
      }

      if (item.kind === "empty") {
        return (
          <View style={styles.timelineRow}>
            <View style={styles.railGutter}>
              <View style={[styles.railLine, { backgroundColor: railColor }]} />
            </View>
            <View style={styles.emptyContent}>
              <Text style={[styles.emptyText, { color: palette.textMuted as string }]}>
                {t("calendarTab.timeline.noLessons", {
                  defaultValue: "No lessons",
                })}
              </Text>
            </View>
          </View>
        );
      }

      const row = item.lesson;
      const swatches = palette.calendar.eventSwatches;
      const swatch = swatches[hashSport(row.sport) % Math.max(swatches.length, 1)] ?? undefined;
      const accent = (swatch?.background as string) ?? (palette.primary as string);
      const counterpart =
        row.roleView === "instructor"
          ? row.studioName
          : (row.instructorName ?? "Unassigned instructor");

      const lifecycleLabel =
        row.lifecycle === "live"
          ? t("calendarTab.timeline.lifecycle.live", {
              defaultValue: "Live now",
            })
          : row.lifecycle === "upcoming"
            ? t("calendarTab.timeline.lifecycle.upcoming", {
                defaultValue: "Upcoming",
              })
            : row.lifecycle === "cancelled"
              ? t("calendarTab.timeline.lifecycle.cancelled", {
                  defaultValue: "Cancelled",
                })
              : t("calendarTab.timeline.lifecycle.past", {
                  defaultValue: "Past",
                });

      const lifecycleTone =
        row.lifecycle === "live"
          ? {
              fg: palette.success as string,
              bg: palette.successSubtle as string,
            }
          : row.lifecycle === "upcoming"
            ? {
                fg: palette.primary as string,
                bg: palette.primarySubtle as string,
              }
            : row.lifecycle === "cancelled"
              ? {
                  fg: palette.danger as string,
                  bg: palette.dangerSubtle as string,
                }
              : {
                  fg: palette.textMuted as string,
                  bg: palette.surfaceAlt as string,
                };

      return (
        <View style={styles.timelineRow}>
          <View style={styles.railGutter}>
            <View style={[styles.railLine, { backgroundColor: railColor }]} />
            <View style={[styles.railDotLesson, { backgroundColor: accent }]} />
          </View>
          <KitPressable
            accessibilityRole="button"
            accessibilityLabel={t("calendarTab.lessonRowAccessibility", {
              defaultValue: "{{sport}} from {{start}} to {{end}}",
              sport: row.sport,
              start: formatTime(row.startTime, i18n.language),
              end: formatTime(row.endTime, i18n.language),
            })}
            accessibilityHint={t("calendarTab.lessonRowAccessibilityHint", {
              defaultValue: "Select this day",
            })}
            onPress={() => handleDayPress(item.dayKey)}
            style={[styles.lessonCard, { backgroundColor: palette.surfaceElevated as string }]}
          >
            <View style={styles.lessonContent}>
              <View style={styles.lessonTopRow}>
                <Text style={[styles.lessonTime, { color: palette.textMuted as string }]}>
                  {formatTime(row.startTime, i18n.language)} –{" "}
                  {formatTime(row.endTime, i18n.language)}
                </Text>
                <View style={[styles.lifecycleBadge, { backgroundColor: lifecycleTone.bg }]}>
                  <Text style={[styles.lifecycleBadgeText, { color: lifecycleTone.fg }]}>
                    {lifecycleLabel}
                  </Text>
                </View>
              </View>
              <Text style={[styles.lessonTitle, { color: palette.text as string }]}>
                {row.sport}
              </Text>
              <Text style={[styles.lessonMeta, { color: palette.textMuted as string }]}>
                {counterpart}
              </Text>
            </View>
          </KitPressable>
        </View>
      );
    },
    [handleDayPress, i18n.language, palette, railColor, t, todayKey],
  );

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <LoadingScreen label={t("calendarTab.loading")} />;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <TabScreenRoot mode="static" style={{ backgroundColor: palette.appBg }}>
      <WeekStrip
        selectedDay={selectedDay}
        isExpanded={isMonthExpanded}
        onExpandedChange={handleExpandedChange}
        onDayPress={handleDayPress}
        onWeekChange={handleWeekChange}
        onMonthChange={handleMonthChange}
        onTodayPress={handleTodayPress}
        lessonCountByDay={lessonCountByDay}
        locale={i18n.language}
        todayLabel={t("common.today", { defaultValue: "Today" })}
        monthButtonLabel={t("calendarTab.toggleMonthView", {
          defaultValue: "Toggle month view",
        })}
        dragHandleLabel={t("calendarTab.toggleMonthView", {
          defaultValue: "Toggle month view",
        })}
        weekViewLabel={t("calendarTab.mode.week", { defaultValue: "Week" })}
        monthViewLabel={t("calendarTab.mode.month", { defaultValue: "Month" })}
      />

      <FlashList
        ref={listRef}
        data={listItems}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        getItemType={(item) => item.kind}
        overrideItemLayout={overrideItemLayout}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        contentContainerStyle={styles.timelineContent}
        ListFooterComponent={listFooterComponent}
      />
    </TabScreenRoot>
  );
}

// ─── Timeline Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  timelineContent: {
    paddingTop: 4,
  },

  // ── Rail ─────────────────────────────────────────
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingLeft: 8,
  },
  railGutter: {
    width: RAIL_LEFT * 2,
    alignItems: "center",
    position: "relative",
  },
  railLine: {
    position: "absolute",
    width: 2,
    top: 0,
    bottom: 0,
    left: RAIL_LEFT - 1,
    borderRadius: 1,
    opacity: 0.3,
  },
  railDotDay: {
    width: RAIL_DOT_DAY,
    height: RAIL_DOT_DAY,
    borderRadius: RAIL_DOT_DAY / 2,
    marginTop: 18,
    zIndex: 1,
  },
  railDotLesson: {
    width: RAIL_DOT_LESSON,
    height: RAIL_DOT_LESSON,
    borderRadius: RAIL_DOT_LESSON / 2,
    marginTop: 20,
    zIndex: 1,
  },

  // ── Day header (month+number first, weekday underneath) ──
  dayHeaderContent: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 6,
    paddingRight: 16,
  },
  dayHeading: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 26,
  },
  daySubtitle: {
    fontSize: 13,
    fontWeight: "400",
    marginTop: 1,
  },

  // ── Lesson card ──────────────────────────────────
  lessonCard: {
    flex: 1,
    marginRight: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderCurve: "continuous",
  },
  lessonContent: {
    gap: 3,
  },
  lessonTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lessonTime: {
    fontSize: 13,
    fontWeight: "500",
  },
  lifecycleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderCurve: "continuous",
  },
  lifecycleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 21,
  },
  lessonMeta: {
    fontSize: 14,
    fontWeight: "400",
  },

  // ── Empty ────────────────────────────────────────
  emptyContent: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 16,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "400",
  },
});
