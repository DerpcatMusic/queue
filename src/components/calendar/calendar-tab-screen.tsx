import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
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
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { formatTime } from "@/lib/jobs-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type TimelineRow = {
  lessonId: string;
  roleView: "instructor" | "studio";
  studioName: string;
  instructorName?: string;
  sport: string;
  startTime: number;
  endTime: number;
  status: "open" | "filled" | "cancelled" | "completed";
  lifecycle: "upcoming" | "live" | "past" | "cancelled";
};

type TimelineListItem =
  | { kind: "dayHeader"; key: string; dayKey: string }
  | { kind: "empty"; key: string; dayKey: string }
  | { kind: "lesson"; key: string; dayKey: string; lesson: TimelineRow };

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_VERSION = 2;
const TIMELINE_RANGE_DAYS = 90;
const TIMELINE_EXTEND_BUFFER_DAYS = 60;
const EDGE_EXTEND_THRESHOLD_DAYS = 7;
const ESTIMATED_DAY_HEADER_SIZE = 64;
const ESTIMATED_LESSON_SIZE = 84;
const ESTIMATED_EMPTY_SIZE = 40;

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

function compareDayKey(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function enumerateDays(startKey: string, endKey: string) {
  const out: string[] = [];
  let cursor = startKey;
  while (compareDayKey(cursor, endKey) <= 0) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
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

function hashSport(sport: string) {
  let h = 0;
  for (let i = 0; i < sport.length; i++) {
    h = sport.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

// ─── Timeline cache ──────────────────────────────────────────────────────────

function useTimelineCache(role: string | undefined, startTime: number, endTime: number) {
  const cacheKey = useMemo(
    () => `calendar:timeline:v${CACHE_VERSION}:${role ?? "none"}:${startTime}:${endTime}`,
    [role, startTime, endTime],
  );
  const [cachedRows, setCachedRows] = useState<TimelineRow[] | null>(null);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCachedRows(null);
    setCacheReady(false);
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (!raw || cancelled) {
          setCacheReady(true);
          return;
        }
        const payload = JSON.parse(raw) as { fetchedAt: number; rows: TimelineRow[] };
        if (Date.now() - payload.fetchedAt > CACHE_TTL_MS) {
          setCacheReady(true);
          return;
        }
        setCachedRows(payload.rows);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setCacheReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  const persist = useCallback(
    async (rows: TimelineRow[]) => {
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ fetchedAt: Date.now(), rows }));
      } catch {
        /* best-effort */
      }
    },
    [cacheKey],
  );

  return { cachedRows, cacheReady, persist };
}

// ─── WeekStrip (live-sliding, dynamic height) ────────────────────────────────

const WEEK_ROW_HEIGHT = 46; // height of one row of day cells
const DRAG_HANDLE_HEIGHT = 16; // drag bar area
const HEADER_HEIGHT = 44; // month label row
const LABELS_HEIGHT = 20; // weekday letter labels

function WeekStrip({
  selectedDay,
  onDayPress,
  onWeekChange,
  onMonthPress,
  onTodayPress,
  lessonCountByDay,
  locale,
}: {
  selectedDay: string;
  onDayPress: (dayKey: string) => void;
  onWeekChange: (delta: number) => void;
  onMonthPress: () => void;
  onTodayPress: () => void;
  lessonCountByDay: Map<string, number>;
  locale: string;
}) {
  const palette = useBrand();
  const { width: screenWidth } = useWindowDimensions();
  const todayKey = useMemo(() => toDayKey(Date.now()), []);
  const weekStart = getWeekStart(selectedDay);
  const monthStart = getMonthStart(selectedDay);
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
            runOnJS(onWeekChange)(weekDelta);
            swipeX.value = 0;
          });
        } else if (e.translationX > SWIPE_THRESHOLD || (e.velocityX > 500 && e.translationX > 20)) {
          swipeX.value = withTiming(panelWidth, { duration: 200 }, () => {
            runOnJS(onWeekChange)(-weekDelta);
            swipeX.value = 0;
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
    const isSelected = !isTriptychSide && dayKey === selectedDay;
    const isToday = dayKey === todayKey;
    const hasLessons = (lessonCountByDay.get(dayKey) ?? 0) > 0;
    const isCurrentMonth = isSameMonth(dayKey, selectedDay);
    const dimmed = !isCurrentMonth;

    return (
      <KitPressable
        key={dayKey}
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

  const firstWeekRow = monthWeeks[0] ?? currWeekDays;

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
        <KitPressable onPress={onMonthPress} style={wStyles.monthButton} hitSlop={8}>
          <Text style={[wStyles.monthLabel, { color: palette.text as string }]}>
            {formatMonthYear(selectedDay, locale)}
          </Text>
          <Text style={[wStyles.monthChevron, { color: palette.textMuted as string }]}>▾</Text>
        </KitPressable>
        <View style={wStyles.headerActions}>
          {selectedDay !== todayKey ? (
            <KitPressable onPress={onTodayPress} hitSlop={6}>
              <View
                style={[wStyles.todayPill, { backgroundColor: palette.primarySubtle as string }]}
              >
                <Text style={[wStyles.todayPillText, { color: palette.primary as string }]}>
                  Today
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
        haptic="none"
        onPress={() => {
          // Tap handle to toggle
          if (expandProgress.value > 0.5) {
            expandProgress.value = withSpring(0, { damping: 18, stiffness: 200 });
          } else {
            expandProgress.value = withSpring(1, { damping: 18, stiffness: 200 });
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
  const { safeBottom } = useAppInsets();
  const currentUser = useQuery(api.users.getCurrentUser);
  const todayKey = useMemo(() => toDayKey(Date.now()), []);
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [windowRange, setWindowRange] = useState(() => ({
    start: addDays(todayKey, -TIMELINE_RANGE_DAYS),
    end: addDays(todayKey, TIMELINE_RANGE_DAYS),
  }));
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const listRef = useRef<FlashListRef<TimelineListItem>>(null);
  const programmaticScrollRef = useRef(false);

  const role =
    currentUser?.role === "instructor" || currentUser?.role === "studio"
      ? currentUser.role
      : undefined;

  const startTime = useMemo(() => dayKeyToTimestamp(windowRange.start), [windowRange.start]);
  const endTime = useMemo(() => dayKeyToTimestamp(windowRange.end) + DAY_MS - 1, [windowRange.end]);
  const remoteRows = useQuery(
    api.jobs.getMyCalendarTimeline,
    role ? { startTime, endTime, limit: 1000 } : "skip",
  );
  const { cachedRows, cacheReady, persist } = useTimelineCache(role, startTime, endTime);

  useEffect(() => {
    if (!remoteRows) return;
    void persist(remoteRows as unknown as TimelineRow[]);
  }, [persist, remoteRows]);

  const rows = useMemo(() => {
    if (remoteRows) return remoteRows as unknown as TimelineRow[];
    if (cachedRows) return cachedRows;
    return [];
  }, [remoteRows, cachedRows]);

  const filteredRows = useMemo(() => {
    const start = dayKeyToTimestamp(windowRange.start);
    const end = dayKeyToTimestamp(windowRange.end) + DAY_MS - 1;
    return rows
      .filter((row) => row.startTime >= start && row.startTime <= end)
      .sort((a, b) => a.startTime - b.startTime);
  }, [rows, windowRange.end, windowRange.start]);

  const { listItems, dayStartIndexByKey } = useMemo(() => {
    const rowsByDay = new Map<string, TimelineRow[]>();
    for (const row of filteredRows) {
      const dk = toDayKey(row.startTime);
      const existing = rowsByDay.get(dk);
      if (existing) existing.push(row);
      else rowsByDay.set(dk, [row]);
    }

    const items: TimelineListItem[] = [];
    const dayIndexMap = new Map<string, number>();
    const days = enumerateDays(windowRange.start, windowRange.end);

    for (const dk of days) {
      dayIndexMap.set(dk, items.length);
      items.push({ kind: "dayHeader", key: `${dk}:header`, dayKey: dk });
      const dayRows = rowsByDay.get(dk) ?? [];
      if (dayRows.length === 0) {
        items.push({ kind: "empty", key: `${dk}:empty`, dayKey: dk });
      } else {
        for (const lesson of dayRows) {
          items.push({ kind: "lesson", key: `${dk}:${lesson.lessonId}`, dayKey: dk, lesson });
        }
      }
    }
    return { listItems: items, dayStartIndexByKey: dayIndexMap };
  }, [filteredRows, windowRange.end, windowRange.start]);

  const lessonCountByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const dk = toDayKey(row.startTime);
      counts.set(dk, (counts.get(dk) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  // ─── Scroll to day ──────────────────────────────────────────────────────────

  const scrollToDay = useCallback(
    (dayKey: string) => {
      const index = dayStartIndexByKey.get(dayKey);
      if (index === undefined) return;
      programmaticScrollRef.current = true;
      try {
        listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
      } catch {
        /* layout not ready */
      }
      setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 500);
    },
    [dayStartIndexByKey],
  );

  const ensureDayInWindow = useCallback((dayKey: string) => {
    setWindowRange((prev) => {
      let ns = prev.start;
      let ne = prev.end;
      if (compareDayKey(dayKey, prev.start) < 0) ns = addDays(dayKey, -TIMELINE_EXTEND_BUFFER_DAYS);
      if (compareDayKey(dayKey, prev.end) > 0) ne = addDays(dayKey, TIMELINE_EXTEND_BUFFER_DAYS);
      if (ns === prev.start && ne === prev.end) return prev;
      return { start: ns, end: ne };
    });
  }, []);

  // ─── Bi-directional sync ────────────────────────────────────────────────────

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (programmaticScrollRef.current) return;
      const firstHeader = viewableItems.find(
        (v) => (v.item as TimelineListItem).kind === "dayHeader",
      );
      if (firstHeader) {
        const dk = (firstHeader.item as TimelineListItem).dayKey;
        setSelectedDay(dk);
        // Auto-extend range when scrolling near edges
        ensureDayInWindow(addDays(dk, -EDGE_EXTEND_THRESHOLD_DAYS));
        ensureDayInWindow(addDays(dk, EDGE_EXTEND_THRESHOLD_DAYS));
      }
    },
    [ensureDayInWindow],
  );

  // ─── Strip handlers ─────────────────────────────────────────────────────────

  const handleDayPress = useCallback(
    (dayKey: string) => {
      setSelectedDay(dayKey);
      ensureDayInWindow(dayKey);
      setTimeout(() => scrollToDay(dayKey), 50);
    },
    [ensureDayInWindow, scrollToDay],
  );

  const handleWeekChange = useCallback(
    (deltaWeeks: number) => {
      const newDay = addDays(selectedDay, deltaWeeks * 7);
      handleDayPress(newDay);
    },
    [selectedDay, handleDayPress],
  );

  const handleTodayPress = useCallback(() => {
    handleDayPress(todayKey);
  }, [todayKey, handleDayPress]);

  const handleMonthPickerChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      if (Platform.OS !== "ios") setShowMonthPicker(false);
      if (!selectedDate) return;
      setShowMonthPicker(false);
      handleDayPress(toDayKey(selectedDate.getTime()));
    },
    [handleDayPress],
  );

  // ─── Item sizing ────────────────────────────────────────────────────────────

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }, item: TimelineListItem) => {
      if (item.kind === "dayHeader") layout.size = ESTIMATED_DAY_HEADER_SIZE;
      else if (item.kind === "empty") layout.size = ESTIMATED_EMPTY_SIZE;
      else layout.size = ESTIMATED_LESSON_SIZE;
    },
    [],
  );

  // ─── Render items ───────────────────────────────────────────────────────────

  const railColor = (palette.border as string) ?? "#E5E5E5";

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
                {t("calendarTab.timeline.noLessons", { defaultValue: "No lessons" })}
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
          ? t("calendarTab.timeline.lifecycle.live", { defaultValue: "Live now" })
          : row.lifecycle === "upcoming"
            ? t("calendarTab.timeline.lifecycle.upcoming", { defaultValue: "Upcoming" })
            : row.lifecycle === "cancelled"
              ? t("calendarTab.timeline.lifecycle.cancelled", { defaultValue: "Cancelled" })
              : t("calendarTab.timeline.lifecycle.past", { defaultValue: "Past" });

      const lifecycleTone =
        row.lifecycle === "live"
          ? { fg: palette.success as string, bg: palette.successSubtle as string }
          : row.lifecycle === "upcoming"
            ? { fg: palette.primary as string, bg: palette.primarySubtle as string }
            : row.lifecycle === "cancelled"
              ? { fg: palette.danger as string, bg: palette.dangerSubtle as string }
              : { fg: palette.textMuted as string, bg: palette.surfaceAlt as string };

      return (
        <View style={styles.timelineRow}>
          <View style={styles.railGutter}>
            <View style={[styles.railLine, { backgroundColor: railColor }]} />
            <View style={[styles.railDotLesson, { backgroundColor: accent }]} />
          </View>
          <View style={[styles.lessonCard, { backgroundColor: palette.surfaceElevated as string }]}>
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
          </View>
        </View>
      );
    },
    [i18n.language, palette, railColor, t, todayKey],
  );

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (currentUser === undefined || (!cacheReady && !remoteRows)) {
    return <LoadingScreen label={t("calendarTab.loading")} />;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <TabScreenRoot mode="static" style={{ backgroundColor: palette.appBg }}>
      <WeekStrip
        selectedDay={selectedDay}
        onDayPress={handleDayPress}
        onWeekChange={handleWeekChange}
        onMonthPress={() => setShowMonthPicker(true)}
        onTodayPress={handleTodayPress}
        lessonCountByDay={lessonCountByDay}
        locale={i18n.language}
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
        ListFooterComponent={<View style={{ height: safeBottom + 28 }} />}
      />

      {showMonthPicker ? (
        <DateTimePicker
          value={new Date(dayKeyToTimestamp(selectedDay))}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleMonthPickerChange}
        />
      ) : null}
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
