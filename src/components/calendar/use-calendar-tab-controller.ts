import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FlashListRef } from "@shopify/flash-list";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, type ViewToken } from "react-native";

import { api } from "@/convex/_generated/api";
import { syncDeviceCalendarEvents } from "@/lib/device-calendar-sync";

const calendarApi = (api as unknown as { calendar: Record<string, unknown> }).calendar as {
  syncMyGoogleCalendarEvents: unknown;
};

export type TimelineRow = {
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

export type TimelineListItem =
  | { kind: "dayHeader"; key: string; dayKey: string }
  | { kind: "empty"; key: string; dayKey: string }
  | { kind: "lesson"; key: string; dayKey: string; lesson: TimelineRow };

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_VERSION = 2;
const TIMELINE_RANGE_DAYS = 90;
const TIMELINE_EXTEND_BUFFER_DAYS = 60;
const ESTIMATED_DAY_HEADER_SIZE = 64;
const ESTIMATED_LESSON_SIZE = 84;
const ESTIMATED_EMPTY_SIZE = 40;

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

function buildTimelineRowsSignature(rows: TimelineRow[]) {
  if (rows.length === 0) {
    return "0";
  }
  return rows
    .map((row) => `${row.lessonId}:${row.startTime}:${row.endTime}:${row.status}:${row.lifecycle}`)
    .sort()
    .join("|");
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

type ItemLayout = { span?: number; size?: number };

export function useCalendarTabController() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const todayKey = useMemo(() => toDayKey(Date.now()), []);
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const selectedDayRef = useRef(todayKey);
  const [windowRange, setWindowRange] = useState(() => ({
    start: addDays(todayKey, -TIMELINE_RANGE_DAYS),
    end: addDays(todayKey, TIMELINE_RANGE_DAYS),
  }));
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const listRef = useRef<FlashListRef<TimelineListItem>>(null);
  const programmaticScrollRef = useRef(false);
  const lastViewSyncAtRef = useRef(0);

  const role =
    currentUser?.role === "instructor" || currentUser?.role === "studio"
      ? currentUser.role
      : undefined;

  const startTime = useMemo(() => dayKeyToTimestamp(windowRange.start), [windowRange.start]);
  const endTime = useMemo(() => dayKeyToTimestamp(windowRange.end) + DAY_MS - 1, [windowRange.end]);
  const timelineArgs = useMemo(() => ({ startTime, endTime, limit: 1000 }), [endTime, startTime]);

  const remoteRows = useQuery(api.jobs.getMyCalendarTimeline, role ? timelineArgs : "skip");
  const remoteTimelineRows = useMemo(
    () => (remoteRows ? (remoteRows as unknown as TimelineRow[]) : null),
    [remoteRows],
  );
  const remoteRowsSignature = useMemo(
    () => (remoteTimelineRows ? buildTimelineRowsSignature(remoteTimelineRows) : ""),
    [remoteTimelineRows],
  );
  const lastPersistSignatureRef = useRef<string>("");

  const syncGoogleCalendar = useAction(calendarApi.syncMyGoogleCalendarEvents as any) as (args: {
    startTime?: number;
    endTime?: number;
    limit?: number;
  }) => Promise<unknown>;

  const emptyArgs = useMemo(() => ({}), []);
  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? emptyArgs : "skip",
  );

  const { cachedRows, cacheReady, persist } = useTimelineCache(role, startTime, endTime);

  useEffect(() => {
    if (!remoteTimelineRows) return;
    if (remoteRowsSignature === lastPersistSignatureRef.current) return;
    lastPersistSignatureRef.current = remoteRowsSignature;
    void persist(remoteTimelineRows);
  }, [persist, remoteRowsSignature, remoteTimelineRows]);

  const rows = useMemo(() => {
    if (remoteTimelineRows) return remoteTimelineRows;
    if (cachedRows) return cachedRows;
    return [];
  }, [remoteTimelineRows, cachedRows]);

  const filteredRows = useMemo(() => {
    const start = dayKeyToTimestamp(windowRange.start);
    const end = dayKeyToTimestamp(windowRange.end) + DAY_MS - 1;
    return rows
      .filter((row) => row.startTime >= start && row.startTime <= end)
      .sort((a, b) => a.startTime - b.startTime);
  }, [rows, windowRange.end, windowRange.start]);

  const syncEvents = useMemo(() => {
    if (currentUser?.role !== "instructor") return [];
    const now = Date.now();
    const staleCutoff = now - 7 * DAY_MS;
    return rows
      .filter((row) => row.status !== "cancelled" && row.endTime >= staleCutoff)
      .sort(
        (a, b) =>
          a.startTime - b.startTime ||
          a.endTime - b.endTime ||
          a.lessonId.localeCompare(b.lessonId),
      )
      .map((row) => ({
        externalId: row.lessonId,
        title: `${row.sport} lesson`,
        startDate: new Date(row.startTime),
        endDate: new Date(row.endTime),
        notes: `Studio: ${row.studioName}`,
      }));
  }, [currentUser?.role, rows]);

  const appleSyncSignature = useMemo(
    () =>
      syncEvents
        .map(
          (event) => `${event.externalId}:${event.startDate.getTime()}:${event.endDate.getTime()}`,
        )
        .join("|"),
    [syncEvents],
  );
  const lastAppleSyncSignatureRef = useRef<string>("");

  useEffect(() => {
    if (currentUser?.role !== "instructor") return;
    if (!instructorSettings || instructorSettings.calendarProvider !== "apple") return;
    if (!instructorSettings.calendarSyncEnabled) return;
    if (syncEvents.length === 0) return;
    if (appleSyncSignature === lastAppleSyncSignatureRef.current) return;
    lastAppleSyncSignatureRef.current = appleSyncSignature;
    void syncDeviceCalendarEvents(syncEvents);
  }, [appleSyncSignature, currentUser?.role, instructorSettings, syncEvents]);

  const lastGoogleSyncAtRef = useRef(0);
  useEffect(() => {
    if (currentUser?.role !== "instructor") return;
    if (!instructorSettings || instructorSettings.calendarProvider !== "google") return;
    if (!instructorSettings.calendarSyncEnabled) return;
    const now = Date.now();
    if (now - lastGoogleSyncAtRef.current < 3 * 60 * 1000) return;
    lastGoogleSyncAtRef.current = now;
    void syncGoogleCalendar({
      startTime,
      endTime,
      limit: 1000,
    });
  }, [currentUser?.role, instructorSettings, syncGoogleCalendar, startTime, endTime]);

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
      if (dayRows.length === 0 && (dk === selectedDay || dk === todayKey)) {
        items.push({ kind: "empty", key: `${dk}:empty`, dayKey: dk });
      } else {
        for (const lesson of dayRows) {
          items.push({
            kind: "lesson",
            key: `${dk}:${lesson.lessonId}`,
            dayKey: dk,
            lesson,
          });
        }
      }
    }

    return { listItems: items, dayStartIndexByKey: dayIndexMap };
  }, [filteredRows, selectedDay, todayKey, windowRange.end, windowRange.start]);

  const lessonCountByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const dk = toDayKey(row.startTime);
      counts.set(dk, (counts.get(dk) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const scrollToDay = useCallback(
    (dayKey: string) => {
      const index = dayStartIndexByKey.get(dayKey);
      if (index === undefined) return;
      programmaticScrollRef.current = true;
      try {
        listRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0,
        });
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

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (programmaticScrollRef.current) return;
      const now = Date.now();
      if (now - lastViewSyncAtRef.current < 180) return;
      const firstHeader = viewableItems.find(
        (v) => (v.item as TimelineListItem).kind === "dayHeader",
      );
      if (firstHeader) {
        const dk = (firstHeader.item as TimelineListItem).dayKey;
        if (selectedDayRef.current === dk) return;
        lastViewSyncAtRef.current = now;
        selectedDayRef.current = dk;
        setSelectedDay(dk);
      }
    },
    [],
  );

  const handleDayPress = useCallback(
    (dayKey: string) => {
      selectedDayRef.current = dayKey;
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

  const openMonthPicker = useCallback(() => {
    setShowMonthPicker(true);
  }, []);

  const handleMonthPickerChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      if (Platform.OS !== "ios") setShowMonthPicker(false);
      if (!selectedDate) return;
      setShowMonthPicker(false);
      handleDayPress(toDayKey(selectedDate.getTime()));
    },
    [handleDayPress],
  );

  const overrideItemLayout = useCallback((layout: ItemLayout, item: TimelineListItem) => {
    if (item.kind === "dayHeader") layout.size = ESTIMATED_DAY_HEADER_SIZE;
    else if (item.kind === "empty") layout.size = ESTIMATED_EMPTY_SIZE;
    else layout.size = ESTIMATED_LESSON_SIZE;
  }, []);

  const isLoading = currentUser === undefined || (!cacheReady && !remoteRows);

  return {
    selectedDay,
    showMonthPicker,
    listRef,
    listItems,
    lessonCountByDay,
    viewabilityConfig,
    onViewableItemsChanged,
    handleDayPress,
    handleWeekChange,
    handleTodayPress,
    openMonthPicker,
    handleMonthPickerChange,
    overrideItemLayout,
    selectedDayTimestamp: dayKeyToTimestamp(selectedDay),
    isLoading,
  };
}
