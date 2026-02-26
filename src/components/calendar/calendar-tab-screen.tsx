import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { CalendarList, type DateData } from "react-native-calendars";

import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { LoadingScreen } from "@/components/loading-screen";
import { useSystemUi } from "@/contexts/system-ui-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { formatTime } from "@/lib/jobs-utils";

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
  | {
      kind: "dayHeader";
      key: string;
      dayKey: string;
    }
  | {
      kind: "empty";
      key: string;
      dayKey: string;
    }
  | {
      kind: "lesson";
      key: string;
      dayKey: string;
      lesson: TimelineRow;
    };

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_VERSION = 2;
const TIMELINE_RANGE_DAYS = 30;
const TIMELINE_EXTEND_BUFFER_DAYS = 30;
const DAY_SCROLL_VIEW_OFFSET = 2;

function toDayKey(timestamp: number) {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayKeyToTimestamp(dayKey: string) {
  const parts = dayKey.split("-");
  const y = Number(parts[0] ?? 1970);
  const m = Number(parts[1] ?? 1);
  const d = Number(parts[2] ?? 1);
  return new Date(y, m - 1, d).getTime();
}

function addDays(dayKey: string, delta: number) {
  const next = new Date(dayKeyToTimestamp(dayKey) + delta * DAY_MS);
  return toDayKey(next.getTime());
}

function compareDayKey(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
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

function hashSport(sport: string) {
  let h = 0;
  for (let i = 0; i < sport.length; i += 1) {
    h = sport.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

function formatDayTitle(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
  });
}

function formatDayContext(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "long",
  });
}

function getLessonHeatLevel(lessonCount: number, peakCount: number) {
  if (lessonCount <= 0 || peakCount <= 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil((lessonCount / peakCount) * 4)));
}

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
        const payload = JSON.parse(raw) as {
          fetchedAt: number;
          rows: TimelineRow[];
        };
        if (Date.now() - payload.fetchedAt > CACHE_TTL_MS) {
          setCacheReady(true);
          return;
        }
        setCachedRows(payload.rows);
      } catch {
        // Ignore cache read issues and fallback to network data.
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
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({
            fetchedAt: Date.now(),
            rows,
          }),
        );
      } catch {
        // Cache write is best-effort only.
      }
    },
    [cacheKey],
  );

  return { cachedRows, cacheReady, persist };
}

export default function CalendarTabScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { safeBottom } = useAppInsets();
  const { resolvedScheme } = useThemePreference();
  const { width } = useWindowDimensions();
  const { setTopInsetBackgroundColor } = useSystemUi();
  const currentUser = useQuery(api.users.getCurrentUser);
  const todayKey = useMemo(() => toDayKey(Date.now()), []);
  const initialCalendarMonthRef = useRef(todayKey);
  const [visibleDay, setVisibleDay] = useState(todayKey);
  const [windowRange, setWindowRange] = useState(() => ({
    start: addDays(todayKey, -TIMELINE_RANGE_DAYS),
    end: addDays(todayKey, TIMELINE_RANGE_DAYS),
  }));
  const [scrollTarget, setScrollTarget] = useState<{
    dayKey: string;
    animated: boolean;
  } | null>({ dayKey: todayKey, animated: false });
  const [listReady, setListReady] = useState(false);
  const listRef = useRef<FlashListRef<TimelineListItem>>(null);
  const scrollRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const role =
    currentUser?.role === "instructor" || currentUser?.role === "studio"
      ? currentUser.role
      : undefined;

  const startTime = useMemo(() => dayKeyToTimestamp(windowRange.start), [windowRange.start]);
  const endTime = useMemo(() => dayKeyToTimestamp(windowRange.end) + DAY_MS - 1, [windowRange.end]);
  const remoteRows = useQuery(
    api.jobs.getMyCalendarTimeline,
    role ? { startTime, endTime, limit: 400 } : "skip",
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
      const dayKey = toDayKey(row.startTime);
      const existing = rowsByDay.get(dayKey);
      if (existing) {
        existing.push(row);
      } else {
        rowsByDay.set(dayKey, [row]);
      }
    }

    const items: TimelineListItem[] = [];
    const dayIndexMap = new Map<string, number>();
    const days = enumerateDays(windowRange.start, windowRange.end);

    for (let i = 0; i < days.length; i += 1) {
      const dayKey = days[i]!;
      dayIndexMap.set(dayKey, items.length);
      items.push({
        kind: "dayHeader",
        key: `${dayKey}:header`,
        dayKey,
      });

      const dayRows = rowsByDay.get(dayKey) ?? [];
      if (dayRows.length === 0) {
        items.push({ kind: "empty", key: `${dayKey}:empty`, dayKey });
        continue;
      }

      for (let j = 0; j < dayRows.length; j += 1) {
        const lesson = dayRows[j]!;
        items.push({
          kind: "lesson",
          key: `${dayKey}:${lesson.lessonId}`,
          dayKey,
          lesson,
        });
      }
    }

    return {
      listItems: items,
      dayStartIndexByKey: dayIndexMap,
    };
  }, [filteredRows, windowRange.end, windowRange.start]);

  const lessonCountByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const dayKey = toDayKey(row.startTime);
      counts.set(dayKey, (counts.get(dayKey) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const peakLessonsPerDay = useMemo(() => {
    let maxCount = 0;
    for (const count of lessonCountByDay.values()) {
      if (count > maxCount) maxCount = count;
    }
    return maxCount;
  }, [lessonCountByDay]);

  const calendarSurfaceColor = useMemo(
    () => (resolvedScheme === "dark" ? palette.surface : palette.surfaceAlt),
    [palette.surface, palette.surfaceAlt, resolvedScheme],
  );
  const compactCalendarHeight = useMemo(
    () => Math.round(Math.max(248, Math.min(286, width * 0.64))),
    [width],
  );

  useEffect(() => {
    setTopInsetBackgroundColor(calendarSurfaceColor);
    return () => {
      setTopInsetBackgroundColor(null);
    };
  }, [calendarSurfaceColor, setTopInsetBackgroundColor]);

  const markedDates = useMemo(() => {
    const marks: Record<string, Record<string, unknown>> = {};
    const swatches = palette.calendar.eventSwatches;

    for (const [dayKey, lessonCount] of lessonCountByDay.entries()) {
      const heatLevel = getLessonHeatLevel(lessonCount, peakLessonsPerDay);
      const swatchIndex = Math.min(Math.max(heatLevel - 1, 0), Math.max(swatches.length - 1, 0));
      const swatch = swatches[swatchIndex] ?? undefined;
      const isHighest = heatLevel >= 4;

      marks[dayKey] = {
        customStyles: {
          container: {
            backgroundColor: isHighest
              ? (palette.primary as string)
              : ((swatch?.background as string) ?? (palette.primarySubtle as string)),
            borderRadius: 9,
            borderCurve: "continuous",
            borderWidth: isHighest ? 1.1 : 0.8,
            borderColor: isHighest ? (palette.primary as string) : (palette.border as string),
            minHeight: 28,
            minWidth: 28,
            alignItems: "center",
            justifyContent: "center",
          },
          text: {
            color: isHighest ? (palette.onPrimary as string) : (palette.text as string),
            fontWeight: heatLevel >= 3 ? "700" : "600",
          },
        },
      };
    }

    const selectedCustomStyles =
      (marks[visibleDay]?.customStyles as
        | {
            container?: Record<string, unknown>;
            text?: Record<string, unknown>;
          }
        | undefined) ?? undefined;
    marks[visibleDay] = {
      customStyles: {
        container: {
          backgroundColor:
            (selectedCustomStyles?.container?.backgroundColor as string | undefined) ??
            (calendarSurfaceColor as string),
          borderRadius: 9,
          borderCurve: "continuous",
          borderWidth: 2,
          borderColor: palette.primary as string,
          minHeight: 28,
          minWidth: 28,
          alignItems: "center",
          justifyContent: "center",
        },
        text: {
          ...(selectedCustomStyles?.text ?? {}),
          color:
            (selectedCustomStyles?.text?.color as string | undefined) ?? (palette.text as string),
          fontWeight: "700",
        },
      },
    };

    return marks;
  }, [
    calendarSurfaceColor,
    lessonCountByDay,
    palette.border,
    palette.calendar.eventSwatches,
    palette.onPrimary,
    palette.primary,
    palette.primarySubtle,
    palette.text,
    peakLessonsPerDay,
    visibleDay,
  ]);

  const scrollToDay = useCallback(
    (dayKey: string, animated: boolean) => {
      const index = dayStartIndexByKey.get(dayKey);
      if (index === undefined) return "missing" as const;
      try {
        listRef.current?.scrollToIndex({
          index,
          animated,
          viewPosition: 0,
          viewOffset: DAY_SCROLL_VIEW_OFFSET,
        });
        return "done" as const;
      } catch {
        return "retry" as const;
      }
    },
    [dayStartIndexByKey],
  );

  useEffect(() => {
    return () => {
      if (scrollRetryRef.current) {
        clearTimeout(scrollRetryRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!listReady || !scrollTarget) return;
    const scrollState = scrollToDay(scrollTarget.dayKey, scrollTarget.animated);
    if (scrollState === "done" || scrollState === "missing") {
      setScrollTarget(null);
      return;
    }

    if (scrollRetryRef.current) {
      clearTimeout(scrollRetryRef.current);
    }
    scrollRetryRef.current = setTimeout(() => {
      setScrollTarget((prev) => (prev ? { ...prev } : prev));
    }, 120);
  }, [listReady, scrollTarget, scrollToDay]);

  const ensureDayInWindow = useCallback((dayKey: string) => {
    setWindowRange((prev) => {
      let nextStart = prev.start;
      let nextEnd = prev.end;
      if (compareDayKey(dayKey, prev.start) < 0) {
        nextStart = addDays(dayKey, -TIMELINE_EXTEND_BUFFER_DAYS);
      }
      if (compareDayKey(dayKey, prev.end) > 0) {
        nextEnd = addDays(dayKey, TIMELINE_EXTEND_BUFFER_DAYS);
      }
      if (nextStart === prev.start && nextEnd === prev.end) {
        return prev;
      }
      return { start: nextStart, end: nextEnd };
    });
  }, []);

  const handleDayPress = useCallback(
    (day: DateData) => {
      const key = day.dateString;
      setVisibleDay(key);
      ensureDayInWindow(key);
      setScrollTarget({ dayKey: key, animated: true });
    },
    [ensureDayInWindow],
  );

  const renderItem = useCallback(
    ({ item }: { item: TimelineListItem }) => {
      if (item.kind === "dayHeader") {
        return (
          <View style={styles.dayHeader}>
            <Text style={[styles.dayContext, { color: palette.textMuted as string }]}>
              {formatDayContext(item.dayKey, i18n.language)}
            </Text>
            <Text style={[styles.dayTitle, { color: palette.text as string }]}>
              {formatDayTitle(item.dayKey, i18n.language)}
            </Text>
          </View>
        );
      }

      if (item.kind === "empty") {
        return (
          <View style={styles.emptyRow}>
            <Text style={[styles.emptyText, { color: palette.textMuted as string }]}>
              {t("calendarTab.timeline.noLessons", { defaultValue: "No lessons" })}
            </Text>
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

      return (
        <View
          style={[
            styles.lessonCard,
            {
              backgroundColor: palette.surfaceElevated as string,
              borderColor: palette.border as string,
            },
          ]}
        >
          <Text style={[styles.lessonTime, { color: palette.textMuted as string }]}>
            {formatTime(row.startTime, i18n.language)} - {formatTime(row.endTime, i18n.language)}
          </Text>
          <Text style={[styles.lessonTitle, { color: palette.text as string }]}>{row.sport}</Text>
          <Text style={[styles.lessonMeta, { color: accent }]}>{counterpart}</Text>
          <Text style={[styles.lessonMeta, { color: palette.textMuted as string }]}>
            {lifecycleLabel}
          </Text>
        </View>
      );
    },
    [i18n.language, palette, t],
  );

  if (currentUser === undefined || (!cacheReady && !remoteRows)) {
    return <LoadingScreen label={t("calendarTab.loading")} />;
  }

  const calendarTheme = {
    calendarBackground: calendarSurfaceColor as string,
    backgroundColor: calendarSurfaceColor as string,
    textSectionTitleColor: palette.textMuted as string,
    todayTextColor: palette.primary as string,
    dayTextColor: palette.text as string,
    monthTextColor: palette.text as string,
    arrowColor: palette.primary as string,
    textDisabledColor: palette.textMicro as string,
    weekVerticalMargin: 2,
    "stylesheet.calendar-list.main": {
      calendar: {
        paddingLeft: 8,
        paddingRight: 8,
      },
    },
  } as const;

  return (
    <TabScreenRoot mode="static" style={{ backgroundColor: palette.appBg }}>
      <View
        style={[
          styles.calendarPanel,
          {
            backgroundColor: calendarSurfaceColor,
            borderBottomColor: palette.border as string,
          },
        ]}
      >
        <CalendarList
          current={initialCalendarMonthRef.current}
          calendarWidth={width}
          calendarHeight={compactCalendarHeight}
          pagingEnabled
          horizontal
          showScrollIndicator={false}
          pastScrollRange={24}
          futureScrollRange={24}
          hideExtraDays
          showSixWeeks={false}
          markedDates={markedDates}
          markingType="custom"
          onDayPress={handleDayPress}
          theme={calendarTheme as never}
        />
      </View>

      <FlashList
        ref={listRef}
        data={listItems}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        getItemType={(item) => item.kind}
        showsVerticalScrollIndicator={false}
        onLayout={() => setListReady(true)}
        onLoad={() => setListReady(true)}
        ListFooterComponent={<View style={{ height: safeBottom + 28 }} />}
      />
    </TabScreenRoot>
  );
}

const styles = StyleSheet.create({
  calendarPanel: {
    marginHorizontal: 0,
    marginTop: 0,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderCurve: "continuous",
    borderBottomWidth: 1,
    overflow: "hidden",
  },
  dayHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  dayContext: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  dayTitle: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
    marginTop: 2,
  },
  lessonCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    gap: 2,
  },
  lessonTime: {
    fontSize: 12,
    fontWeight: "600",
  },
  lessonTitle: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
  },
  lessonMeta: {
    fontSize: 13,
    fontWeight: "500",
  },
  emptyRow: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 6,
  },
  emptyText: {
    fontSize: 13,
  },
});
