import DateTimePicker from "@react-native-community/datetimepicker";
import { FlashList } from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  I18nManager,
  type LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  FadeInUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ScreenScaffold } from "@/components/layout/screen-scaffold";
import { TopSheetSurface } from "@/components/layout/top-sheet-surface";
import { LoadingScreen } from "@/components/loading-screen";
import { AppSymbol } from "@/components/ui/app-symbol";
import { KitButton, KitPressable, KitSegmentedToggle } from "@/components/ui/kit";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { formatTime } from "@/lib/jobs-utils";
import {
  type CalendarViewMode,
  type TimelineListItem,
  useCalendarTabController,
} from "./use-calendar-tab-controller";

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

const RAIL_LEFT = 24;
const RAIL_DOT_DAY = 10;
const RAIL_DOT_LESSON = 6;
const SWIPE_THRESHOLD = 50;
const WEEK_RAIL_SPRING = {
  damping: 24,
  stiffness: 220,
  mass: 0.7,
  overshootClamping: true,
};

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

function compareDayKey(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function getWeekStart(dayKey: string) {
  const ts = dayKeyToTimestamp(dayKey);
  const d = new Date(ts);
  const dow = d.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return toDayKey(ts + mondayOffset * DAY_MS);
}

function getWeekDays(weekStartKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartKey, i));
}

function getMonthWeeks(monthDayKey: string): string[][] {
  const ts = dayKeyToTimestamp(monthDayKey);
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const weeks: string[][] = [];
  let cursor = getWeekStart(toDayKey(firstDay.getTime()));
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

function formatWeekdayLetter(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey))
    .toLocaleDateString(locale, { weekday: "narrow" })
    .charAt(0)
    .toUpperCase();
}

function formatDayNumber(dayKey: string) {
  return String(new Date(dayKeyToTimestamp(dayKey)).getDate());
}

function isSameMonth(dayKeyA: string, dayKeyB: string) {
  return dayKeyA.substring(0, 7) === dayKeyB.substring(0, 7);
}

function formatSelectedDayLabel(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function hashSport(sport: string) {
  let h = 0;
  for (let i = 0; i < sport.length; i++) {
    h = sport.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

// ─── WeekStrip (live-sliding, dynamic height) ────────────────────────────────

function shiftDayKey(dayKey: string, deltaDays: number) {
  return toDayKey(dayKeyToTimestamp(dayKey) + deltaDays * DAY_MS);
}

function WeekRail({
  locale,
  selectedDay,
  todayKey,
  weekDays,
  lessonCountByDay,
  onSelectDay,
  onChangeWeek,
}: {
  locale: string;
  selectedDay: string;
  todayKey: string;
  weekDays: string[];
  lessonCountByDay: Map<string, number>;
  onSelectDay: (dayKey: string) => void;
  onChangeWeek: (deltaWeeks: number) => void;
}) {
  const palette = useBrand();
  const translateX = useSharedValue(-1);
  const railWidth = useSharedValue(1);
  const isRtl = I18nManager.isRTL;
  const previousWeekDays = useMemo(
    () => weekDays.map((dayKey) => shiftDayKey(dayKey, -7)),
    [weekDays],
  );
  const nextWeekDays = useMemo(() => weekDays.map((dayKey) => shiftDayKey(dayKey, 7)), [weekDays]);

  const handleSwipeWeek = useCallback(
    (deltaWeeks: number) => {
      triggerSelectionHaptic();
      onChangeWeek(deltaWeeks);
    },
    [onChangeWeek],
  );
  const handleSelectDay = useCallback(
    (dayKey: string) => {
      triggerSelectionHaptic();
      onSelectDay(dayKey);
    },
    [onSelectDay],
  );

  const onRailLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextWidth = Math.max(1, event.nativeEvent.layout.width);
      railWidth.value = nextWidth;
      translateX.value = -nextWidth;
    },
    [railWidth, translateX],
  );

  const railGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-12, 12])
        .onUpdate((event) => {
          const width = railWidth.value || 1;
          const nextX = -width + event.translationX;
          translateX.value = Math.max(-width * 2, Math.min(0, nextX));
        })
        .onEnd((event) => {
          const width = railWidth.value || 1;
          const shouldAdvance =
            event.translationX <= -Math.max(SWIPE_THRESHOLD, width * 0.2) ||
            event.velocityX <= -650;
          const shouldRewind =
            event.translationX >= Math.max(SWIPE_THRESHOLD, width * 0.2) || event.velocityX >= 650;

          if (shouldAdvance) {
            translateX.value = withSpring(-width * 2, WEEK_RAIL_SPRING, (finished) => {
              if (!finished) return;
              translateX.value = -width;
              runOnJS(handleSwipeWeek)(1);
            });
            return;
          }

          if (shouldRewind) {
            translateX.value = withSpring(0, WEEK_RAIL_SPRING, (finished) => {
              if (!finished) return;
              translateX.value = -width;
              runOnJS(handleSwipeWeek)(-1);
            });
            return;
          }

          translateX.value = withSpring(-width, WEEK_RAIL_SPRING);
        }),
    [handleSwipeWeek, railWidth, translateX],
  );

  const railTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const renderWeekPage = useCallback(
    (days: string[], pageKey: string) => (
      <View
        key={pageKey}
        style={{
          flex: 1,
          flexDirection: isRtl ? "row-reverse" : "row",
          gap: 4,
        }}
      >
        {days.map((dayKey) => {
          const selected = dayKey === selectedDay;
          const lessonCount = lessonCountByDay.get(dayKey) ?? 0;
          const today = dayKey === todayKey;

          return (
            <Animated.View key={dayKey} style={{ flex: 1 }}>
              <KitPressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={formatSelectedDayLabel(dayKey, locale)}
                onPress={() => handleSelectDay(dayKey)}
                style={{ flex: 1 }}
              >
                <View
                  style={{
                    minHeight: 76,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    paddingHorizontal: 4,
                  }}
                >
                  {today && !selected ? (
                    <View
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: palette.text as string,
                        position: "absolute",
                        top: 6,
                      }}
                    />
                  ) : null}
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: today ? (palette.text as string) : (palette.textMuted as string),
                    }}
                  >
                    {formatWeekdayLetter(dayKey, locale)}
                  </Text>
                  <View
                    style={{
                      minWidth: 40,
                      height: 40,
                      borderRadius: 999,
                      borderCurve: "continuous",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      backgroundColor: selected ? (palette.text as string) : "transparent",
                      borderWidth: today && !selected ? 1 : 0,
                      borderColor: today ? (palette.borderStrong as string) : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        ...BrandType.heading,
                        fontSize: 20,
                        includeFontPadding: false,
                        color: selected ? (palette.surface as string) : (palette.text as string),
                      }}
                    >
                      {formatDayNumber(dayKey)}
                    </Text>
                  </View>
                  <View
                    style={{
                      minHeight: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    {lessonCount > 0 ? (
                      <>
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: selected
                              ? (palette.surface as string)
                              : (palette.primary as string),
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: selected
                              ? (palette.surface as string)
                              : (palette.textMuted as string),
                          }}
                        >
                          {lessonCount}
                        </Text>
                      </>
                    ) : (
                      <View style={{ height: 12 }} />
                    )}
                  </View>
                </View>
              </KitPressable>
            </Animated.View>
          );
        })}
      </View>
    ),
    [handleSelectDay, lessonCountByDay, locale, palette, selectedDay, todayKey],
  );

  return (
    <GestureDetector gesture={railGesture}>
      <View onLayout={onRailLayout} style={{ overflow: "hidden" }}>
        <Animated.View
          style={[
            {
              width: "300%",
              flexDirection: isRtl ? "row-reverse" : "row",
            },
            railTrackStyle,
          ]}
        >
          {renderWeekPage(previousWeekDays, "previous")}
          {renderWeekPage(weekDays, "current")}
          {renderWeekPage(nextWeekDays, "next")}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const WEEK_ROW_HEIGHT = 46; // height of one row of day cells
const DRAG_HANDLE_HEIGHT = 16; // drag bar area
const HEADER_HEIGHT = 44; // month label row
const LABELS_HEIGHT = 20; // weekday letter labels

export function WeekStrip({
  selectedDay,
  onDayPress,
  onWeekChange,
  onMonthPress,
  onTodayPress,
  lessonCountByDay,
  locale,
  todayLabel,
  monthButtonLabel,
  dragHandleLabel,
}: {
  selectedDay: string;
  onDayPress: (dayKey: string) => void;
  onWeekChange: (delta: number) => void;
  onMonthPress: () => void;
  onTodayPress: () => void;
  lessonCountByDay: Map<string, number>;
  locale: string;
  todayLabel: string;
  monthButtonLabel: string;
  dragHandleLabel: string;
}) {
  const palette = useBrand();
  const { width: screenWidth } = useWindowDimensions();
  const todayKey = useMemo(() => toDayKey(Date.now()), []);
  const selectedWeekStart = useMemo(() => getWeekStart(selectedDay), [selectedDay]);
  const [displayedWeekStart, setDisplayedWeekStart] = useState(selectedWeekStart);
  const displayedWeekStartRef = useRef(selectedWeekStart);
  const [displayedSelectedDay, setDisplayedSelectedDay] = useState(selectedDay);
  const displayedSelectedDayRef = useRef(selectedDay);
  const weekStart = displayedWeekStart;
  const monthStart = getMonthStart(displayedSelectedDay);
  const monthWeeks = useMemo(() => getMonthWeeks(monthStart), [monthStart]);

  // How many extra rows beyond 1 does this month need?
  const extraRows = monthWeeks.length - 1;
  const weekHeight = WEEK_ROW_HEIGHT;
  const monthExtraHeight = extraRows * WEEK_ROW_HEIGHT;

  // 3-week triptych: prev, current, next
  const prevWeekStart = addDays(weekStart, -7);
  const nextWeekStart = addDays(weekStart, 7);
  const prevWeekDays = useMemo(() => getWeekDays(prevWeekStart), [prevWeekStart]);
  const currWeekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const nextWeekDays = useMemo(() => getWeekDays(nextWeekStart), [nextWeekStart]);

  // ─── Single unified pan gesture ──────────────────────────────────────
  const swipeX = useSharedValue(0);
  const expandProgress = useSharedValue(0); // 0=week, 1=month
  const expandStartRef = useSharedValue(0);
  const gestureDirection = useSharedValue<"none" | "h" | "v">("none");
  const hapticFiredRef = useRef(false);
  const panelWidth = screenWidth;

  const fireHapticOnce = useCallback(() => {
    if (!hapticFiredRef.current) {
      hapticFiredRef.current = true;
      triggerSelectionHaptic();
    }
  }, []);
  const resetHaptic = useCallback(() => {
    hapticFiredRef.current = false;
  }, []);
  const commitWeekSwipe = useCallback(
    (deltaWeeks: number) => {
      const nextWeekStart = addDays(displayedWeekStartRef.current, deltaWeeks * 7);
      displayedWeekStartRef.current = nextWeekStart;
      setDisplayedWeekStart(nextWeekStart);

      const nextSelectedDay = addDays(displayedSelectedDayRef.current, deltaWeeks * 7);
      displayedSelectedDayRef.current = nextSelectedDay;
      setDisplayedSelectedDay(nextSelectedDay);

      swipeX.value = 0;
      onWeekChange(deltaWeeks);
    },
    [onWeekChange, swipeX],
  );

  useEffect(() => {
    displayedSelectedDayRef.current = selectedDay;
    setDisplayedSelectedDay(selectedDay);

    if (displayedWeekStartRef.current === selectedWeekStart) {
      return;
    }
    displayedWeekStartRef.current = selectedWeekStart;
    setDisplayedWeekStart(selectedWeekStart);
  }, [selectedDay, selectedWeekStart]);

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
        const weekDelta = isExpanded ? 4 : 1; // month vs week navigation

        if (e.translationX < -SWIPE_THRESHOLD || (e.velocityX < -500 && e.translationX < -20)) {
          swipeX.value = withTiming(-panelWidth, { duration: 200 }, () => {
            runOnJS(commitWeekSwipe)(weekDelta);
          });
        } else if (e.translationX > SWIPE_THRESHOLD || (e.velocityX > 500 && e.translationX > 20)) {
          swipeX.value = withTiming(panelWidth, { duration: 200 }, () => {
            runOnJS(commitWeekSwipe)(-weekDelta);
          });
        } else {
          swipeX.value = withSpring(0, { damping: 20, stiffness: 300 });
        }
      } else if (gestureDirection.value === "v") {
        if (expandProgress.value > 0.35) {
          expandProgress.value = withSpring(1, { damping: 18, stiffness: 200 });
        } else {
          expandProgress.value = withSpring(0, { damping: 18, stiffness: 200 });
        }
        runOnJS(triggerSelectionHaptic)();
      }

      gestureDirection.value = "none";
    });

  // Animated styles
  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));

  const containerAnimStyle = useAnimatedStyle(() => ({
    height:
      HEADER_HEIGHT +
      LABELS_HEIGHT +
      weekHeight +
      expandProgress.value * monthExtraHeight +
      DRAG_HANDLE_HEIGHT,
  }));

  const extraRowsContainerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(expandProgress.value > 0.06 ? 1 : 0, { duration: 120 }),
    height: expandProgress.value * monthExtraHeight,
    overflow: "hidden" as const,
  }));

  const renderDayCell = (dayKey: string, isTriptychSide = false) => {
    const isSelected = !isTriptychSide && dayKey === displayedSelectedDay;
    const isToday = dayKey === todayKey;
    const hasLessons = (lessonCountByDay.get(dayKey) ?? 0) > 0;
    const lessonCount = lessonCountByDay.get(dayKey) ?? 0;
    const isCurrentMonth = isSameMonth(dayKey, displayedSelectedDay);
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
        accessibilityLabel={`${dayDateLabel}. ${lessonCount} events.`}
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

  const firstWeekRow = currWeekDays;

  return (
    <Animated.View
      style={[
        wStyles.container,
        { backgroundColor: palette.surface as string },
        containerAnimStyle,
      ]}
    >
      {/* Header */}
      <View style={wStyles.headerRow}>
        <KitPressable
          accessibilityRole="button"
          accessibilityLabel={monthButtonLabel}
          onPress={onMonthPress}
          style={wStyles.monthButton}
          hitSlop={8}
        >
          <Text style={[wStyles.monthLabel, { color: palette.text as string }]}>
            {formatMonthYear(displayedSelectedDay, locale)}
          </Text>
          <Text style={[wStyles.monthChevron, { color: palette.textMuted as string }]}>▾</Text>
        </KitPressable>
        <View style={wStyles.headerActions}>
          {displayedSelectedDay !== todayKey ? (
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
        {getWeekDays(getWeekStart(todayKey)).map((d) => (
          <View key={d} style={wStyles.weekdayLabelCell}>
            <Text style={[wStyles.weekdayLabel, { color: palette.textMuted as string }]}>
              {formatWeekdayLetter(d, locale)}
            </Text>
          </View>
        ))}
      </View>

      {/* Gesture area — swipe wraps EVERYTHING so month grid moves too */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ overflow: "hidden" }, swipeStyle]}>
          {/* First row: triptych (prev | current | next) */}
          <View style={[wStyles.triptych, { width: panelWidth * 3, marginLeft: -panelWidth }]}>
            <View style={[wStyles.weekRow, { width: panelWidth }]}>
              {prevWeekDays.map((d) => renderDayCell(d, true))}
            </View>
            <View style={[wStyles.weekRow, { width: panelWidth }]}>
              {firstWeekRow.map((d) => renderDayCell(d))}
            </View>
            <View style={[wStyles.weekRow, { width: panelWidth }]}>
              {nextWeekDays.map((d) => renderDayCell(d, true))}
            </View>
          </View>

          {/* Extra month rows (revealed by vertical drag) */}
          <Animated.View style={extraRowsContainerStyle}>
            {monthWeeks.slice(1).map((week) => (
              <View key={`extra-${week[0]}`} style={wStyles.weekRow}>
                {week.map((d) => renderDayCell(d))}
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Drag handle — enlarged touch target */}
      <KitPressable
        style={wStyles.dragHandle}
        accessibilityRole="button"
        accessibilityLabel={dragHandleLabel}
        haptic="none"
        onPress={() => {
          // Tap handle to toggle
          if (expandProgress.value > 0.5) {
            expandProgress.value = withSpring(0, {
              damping: 18,
              stiffness: 200,
            });
          } else {
            expandProgress.value = withSpring(1, {
              damping: 18,
              stiffness: 200,
            });
          }
          triggerSelectionHaptic();
        }}
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
    gap: 4,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: "600",
  },
  monthChevron: {
    fontSize: 11,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  triptych: {
    flexDirection: "row",
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
  const { safeTop, tabContentBottom } = useAppInsets();
  const { isDesktopWeb } = useLayoutBreakpoint();
  const todayKey = useMemo(() => toDayKey(Date.now()), []);
  const {
    selectedDay,
    listRef,
    listItems,
    lessonCountByDay,
    canShowGoogleAgenda,
    viewMode,
    setViewMode,
    viewabilityConfig,
    onViewableItemsChanged,
    handleDayPress,
    handleWeekChange,
    handleTodayPress,
    openMonthPicker,
    overrideItemLayout,
    selectedDayTimestamp,
    isLoading,
  } = useCalendarTabController();
  const selectedWeekDays = useMemo(() => getWeekDays(getWeekStart(selectedDay)), [selectedDay]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => new Date(selectedDayTimestamp));
  const selectedLessonCount = lessonCountByDay.get(selectedDay) ?? 0;

  // ─── Render items ───────────────────────────────────────────────────────────

  const railColor = (palette.border as string) ?? "#E5E5E5";
  const listFooterComponent = useMemo(
    () => <View style={{ height: tabContentBottom + BrandSpacing.xl }} />,
    [tabContentBottom],
  );

  useEffect(() => {
    setPickerDate(new Date(selectedDayTimestamp));
  }, [selectedDayTimestamp]);

  const handleDateChange = useCallback(
    (_event: unknown, nextDate?: Date) => {
      if (!nextDate) {
        if (Platform.OS !== "ios") {
          setShowDatePicker(false);
        }
        return;
      }

      if (Platform.OS === "ios") {
        setPickerDate(nextDate);
        return;
      }

      setShowDatePicker(false);
      handleDayPress(toDayKey(nextDate.getTime()));
    },
    [handleDayPress],
  );

  const handleDoneWithDatePicker = useCallback(() => {
    setShowDatePicker(false);
    const nextDayKey = toDayKey(pickerDate.getTime());
    if (nextDayKey !== selectedDay) {
      handleDayPress(nextDayKey);
    }
  }, [handleDayPress, pickerDate, selectedDay]);

  const agendaHeaderComponent = useMemo(
    () => (
      <View
        style={{
          gap: BrandSpacing.sm,
          paddingTop: BrandSpacing.sm,
          paddingBottom: BrandSpacing.xs,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: BrandSpacing.md,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ ...BrandType.title, color: palette.text as string }}>
              {t("calendarTab.agenda.title", { defaultValue: "Agenda" })}
            </Text>
            <Text style={{ ...BrandType.micro, color: palette.textMuted as string }}>
              {formatSelectedDayLabel(selectedDay, i18n.language)}
            </Text>
          </View>
          <View
            style={{
              borderRadius: BrandRadius.pill,
              borderCurve: "continuous",
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor:
                selectedLessonCount > 0
                  ? (palette.primarySubtle as string)
                  : (palette.surface as string),
            }}
          >
            <Text
              style={{
                ...BrandType.micro,
                color:
                  selectedLessonCount > 0
                    ? (palette.primary as string)
                    : (palette.textMuted as string),
                fontVariant: ["tabular-nums"],
              }}
            >
              {selectedLessonCount === 1
                ? t("calendarTab.agenda.oneSession", { defaultValue: "1 session" })
                : t("calendarTab.agenda.sessionCount", {
                    count: selectedLessonCount,
                    defaultValue: `${String(selectedLessonCount)} sessions`,
                  })}
            </Text>
          </View>
        </View>
      </View>
    ),
    [i18n.language, palette, selectedDay, selectedLessonCount, t],
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
          <Animated.View entering={FadeInUp.duration(300).springify().damping(20)}>
            <View style={styles.timelineRow}>
              <View style={styles.railGutter}>
                <View style={[styles.railLine, { backgroundColor: railColor }]} />
              </View>
              <View style={[styles.emptyStateCard, { backgroundColor: palette.surface as string }]}>
                <AppSymbol
                  name="calendar.badge.exclamationmark"
                  size={28}
                  tintColor={palette.textMuted as string}
                />
                <Text style={[styles.emptyStateTitle, { color: palette.textMuted as string }]}>
                  {t("calendarTab.timeline.noLessons", {
                    defaultValue: "No lessons",
                  })}
                </Text>
                <Text style={[styles.emptyStateBody, { color: palette.textMuted as string }]}>
                  {t("calendarTab.timeline.noLessonsHint", {
                    defaultValue: "Nothing is scheduled for this day yet.",
                  })}
                </Text>
              </View>
            </View>
          </Animated.View>
        );
      }

      const row = item.lesson;
      const swatches = palette.calendar.eventSwatches;
      const swatch = swatches[hashSport(row.sport) % Math.max(swatches.length, 1)] ?? undefined;
      const accent = (swatch?.background as string) ?? (palette.primary as string);
      const counterpart =
        row.source === "google"
          ? (row.location ?? "Google Calendar")
          : row.roleView === "instructor"
            ? row.studioName
            : (row.instructorName ?? "Unassigned instructor");
      const timeLabel = row.isAllDay
        ? t("calendarTab.timeline.allDay", { defaultValue: "All day" })
        : `${formatTime(row.startTime, i18n.language)} – ${formatTime(row.endTime, i18n.language)}`;

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
                  {timeLabel}
                </Text>
                <View style={styles.lessonBadgeRow}>
                  {row.source === "google" ? (
                    <View
                      style={[
                        styles.sourceBadge,
                        { backgroundColor: palette.primarySubtle as string },
                      ]}
                    >
                      <Text style={[styles.sourceBadgeText, { color: palette.primary as string }]}>
                        {t("calendarTab.timeline.googleBadge", { defaultValue: "Google" })}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.lifecycleBadge, { backgroundColor: lifecycleTone.bg }]}>
                    <Text style={[styles.lifecycleBadgeText, { color: lifecycleTone.fg }]}>
                      {lifecycleLabel}
                    </Text>
                  </View>
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

  if (isDesktopWeb) {
    return (
      <ScreenScaffold mode="static" style={{ backgroundColor: palette.surface as string }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ ...BrandType.bodyStrong, color: palette.textMuted as string }}>
            {t("calendarTab.desktopSoon", {
              defaultValue: "Desktop calendar board is temporarily unavailable in this merge.",
            })}
          </Text>
        </View>
      </ScreenScaffold>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScreenScaffold mode="static" topInsetTone="sheet" style={{ backgroundColor: palette.appBg }}>
      <TopSheetSurface
        style={{
          paddingHorizontal: BrandSpacing.lg,
          paddingTop: safeTop + BrandSpacing.sm,
          paddingBottom: BrandSpacing.lg,
          gap: BrandSpacing.md,
          marginBottom: BrandSpacing.md,
        }}
      >
        <View style={{ gap: BrandSpacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  ...BrandType.heading,
                  fontSize: 30,
                  lineHeight: 34,
                  color: palette.text as string,
                }}
              >
                {formatMonthYear(selectedDay, i18n.language)}
              </Text>
              <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                {formatSelectedDayLabel(selectedDay, i18n.language)}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end", gap: BrandSpacing.sm }}>
              {selectedDay !== todayKey ? (
                <KitButton
                  label={t("common.today", { defaultValue: "Today" })}
                  onPress={handleTodayPress}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                />
              ) : null}
              <KitButton
                label={
                  showDatePicker
                    ? t("common.done", { defaultValue: "Done" })
                    : t("calendarTab.header.chooseDate", { defaultValue: "Choose date" })
                }
                onPress={() => {
                  if (showDatePicker) {
                    handleDoneWithDatePicker();
                    return;
                  }
                  setShowDatePicker(true);
                  openMonthPicker();
                }}
                variant="secondary"
                size="sm"
                fullWidth={false}
              />
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: BrandSpacing.md,
              borderTopWidth: 1,
              borderColor: palette.border as string,
              paddingTop: BrandSpacing.md,
            }}
          >
            <Text style={{ ...BrandType.bodyStrong, color: palette.text as string }}>
              {formatSelectedDayLabel(selectedDay, i18n.language)}
            </Text>
            <View
              style={{
                borderRadius: BrandRadius.pill,
                borderCurve: "continuous",
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor:
                  selectedLessonCount > 0
                    ? (palette.primarySubtle as string)
                    : (palette.surface as string),
              }}
            >
              <Text
                style={{
                  ...BrandType.micro,
                  color:
                    selectedLessonCount > 0
                      ? (palette.primary as string)
                      : (palette.textMuted as string),
                  fontVariant: ["tabular-nums"],
                }}
              >
                {selectedLessonCount === 1
                  ? t("calendarTab.agenda.oneSession", { defaultValue: "1 session" })
                  : t("calendarTab.agenda.sessionCount", {
                      count: selectedLessonCount,
                      defaultValue: `${String(selectedLessonCount)} sessions`,
                    })}
              </Text>
            </View>
          </View>
        </View>

        <WeekRail
          locale={i18n.language}
          selectedDay={selectedDay}
          todayKey={todayKey}
          weekDays={selectedWeekDays}
          lessonCountByDay={lessonCountByDay}
          onSelectDay={handleDayPress}
          onChangeWeek={handleWeekChange}
        />

        {canShowGoogleAgenda ? (
          <KitSegmentedToggle<CalendarViewMode>
            value={viewMode}
            onChange={setViewMode}
            options={[
              {
                value: "jobs_only",
                label: t("calendarTab.filters.jobsOnly", { defaultValue: "Jobs only" }),
              },
              {
                value: "jobs_and_google",
                label: t("calendarTab.filters.jobsAndGoogle", {
                  defaultValue: "Jobs + Google",
                }),
              },
            ]}
          />
        ) : null}

        {showDatePicker ? (
          <Animated.View
            entering={FadeInDown.duration(220).springify().damping(22)}
            style={{
              borderRadius: 24,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: palette.surface as string,
            }}
          >
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={handleDateChange}
            />
            {Platform.OS === "ios" ? (
              <View style={{ alignItems: "flex-end", paddingHorizontal: 14, paddingBottom: 14 }}>
                <KitButton
                  label={t("common.done", { defaultValue: "Done" })}
                  onPress={handleDoneWithDatePicker}
                  size="sm"
                  fullWidth={false}
                />
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </TopSheetSurface>

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
        contentContainerStyle={[styles.timelineContent, { paddingHorizontal: BrandSpacing.lg }]}
        ListHeaderComponent={agendaHeaderComponent}
        ListFooterComponent={listFooterComponent}
      />
    </ScreenScaffold>
  );
}

// ─── Timeline Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  timelineContent: {
    paddingTop: 4,
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
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
    gap: 8,
  },
  lessonTime: {
    fontSize: 13,
    fontWeight: "500",
  },
  lessonBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderCurve: "continuous",
  },
  sourceBadgeText: {
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
  emptyStateCard: {
    flex: 1,
    marginRight: 16,
    marginBottom: 8,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 20,
    borderCurve: "continuous",
    alignItems: "center",
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyStateBody: {
    fontSize: 13,
    fontWeight: "400",
    textAlign: "center",
  },
});
