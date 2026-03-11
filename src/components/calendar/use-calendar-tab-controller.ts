import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FlashListRef } from "@shopify/flash-list";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, type ViewToken } from "react-native";

import { api } from "@/convex/_generated/api";
import { syncDeviceCalendarEvents } from "@/lib/device-calendar-sync";

const calendarApi = (api as unknown as { calendar: Record<string, unknown> }).calendar as {
  getMyGoogleCalendarAgenda: unknown;
  getMyGoogleCalendarStatus: unknown;
  syncMyGoogleCalendarEvents: unknown;
};

export type CalendarViewMode = "jobs_only" | "jobs_and_google";

type GoogleCalendarStatus = {
  connected: boolean;
};

type GoogleAgendaRow = {
  providerEventId: string;
  title: string;
  status: "confirmed" | "tentative" | "cancelled";
  startTime: number;
  endTime: number;
  isAllDay: boolean;
  location?: string;
  htmlLink?: string;
};

export type TimelineRow = {
  lessonId: string;
  source: "job" | "google";
  roleView: "instructor" | "studio";
  studioName: string;
  instructorName?: string;
  sport: string;
  startTime: number;
  endTime: number;
  status: "open" | "filled" | "cancelled" | "completed" | "confirmed" | "tentative";
  lifecycle: "upcoming" | "live" | "past" | "cancelled";
  isAllDay?: boolean;
  location?: string;
  htmlLink?: string;
};

export type TimelineListItem =
  | { kind: "dayHeader"; key: string; dayKey: string }
  | { kind: "empty"; key: string; dayKey: string }
  | { kind: "lesson"; key: string; dayKey: string; lesson: TimelineRow };

export type AgendaItem = TimelineListItem;

export type AgendaSection = {
  key: string;
  dayKey: string;
  data: AgendaItem[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_VERSION = 3;
const TIMELINE_RANGE_DAYS = 90;
const TIMELINE_EXTEND_BUFFER_DAYS = 60;
const TIMELINE_PREFETCH_THRESHOLD_DAYS = 21;
const ESTIMATED_DAY_HEADER_SIZE = 64;
const ESTIMATED_LESSON_SIZE = 84;
const ESTIMATED_EMPTY_SIZE = 40;
const GOOGLE_VIEW_MODE_STORAGE_KEY = "calendar:view-mode:v1";

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
    .map(
      (row) =>
        `${row.source}:${row.lessonId}:${row.sport}:${row.startTime}:${row.endTime}:${row.status}:${row.lifecycle}`,
    )
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

function getLifecycle(
  status: TimelineRow["status"],
  now: number,
  startTime: number,
  endTime: number,
): TimelineRow["lifecycle"] {
  if (status === "cancelled") {
    return "cancelled";
  }
  if (now < startTime) {
    return "upcoming";
  }
  if (now <= endTime) {
    return "live";
  }
  return "past";
}

function useTimelineCache(
  role: string | undefined,
  startTime: number,
  endTime: number,
  viewMode: CalendarViewMode,
) {
  const cacheKey = useMemo(
    () =>
      `calendar:timeline:v${CACHE_VERSION}:${role ?? "none"}:${viewMode}:${startTime}:${endTime}`,
    [endTime, role, startTime, viewMode],
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
        if (!cancelled) {
          setCacheReady(true);
        }
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
  const [viewMode, setViewModeState] = useState<CalendarViewMode>("jobs_only");
  const [viewModeReady, setViewModeReady] = useState(false);
  const listRef = useRef<FlashListRef<TimelineListItem>>(null);
  const programmaticScrollRef = useRef(false);
  const lastViewSyncAtRef = useRef(0);
  const hasInitialViewportSyncRef = useRef(false);
  const hasUserScrolledTimelineRef = useRef(false);

  const role =
    currentUser?.role === "instructor" || currentUser?.role === "studio"
      ? currentUser.role
      : undefined;

  const startTime = useMemo(() => dayKeyToTimestamp(windowRange.start), [windowRange.start]);
  const endTime = useMemo(() => dayKeyToTimestamp(windowRange.end) + DAY_MS - 1, [windowRange.end]);
  const timelineArgs = useMemo(() => ({ startTime, endTime, limit: 1000 }), [endTime, startTime]);

  const remoteRows = useQuery(api.jobs.getMyCalendarTimeline, role ? timelineArgs : "skip");
  const googleStatus = useQuery(calendarApi.getMyGoogleCalendarStatus as any, role ? {} : "skip") as
    | GoogleCalendarStatus
    | undefined;

  const emptyArgs = useMemo(() => ({}), []);
  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? emptyArgs : "skip",
  );
  const studioSettings = useQuery(
    api.users.getMyStudioSettings,
    currentUser?.role === "studio" ? emptyArgs : "skip",
  );
  const calendarSettings = role === "instructor" ? instructorSettings : studioSettings;

  const googleAgendaRows = useQuery(
    calendarApi.getMyGoogleCalendarAgenda as any,
    role && viewMode === "jobs_and_google" && googleStatus?.connected ? timelineArgs : "skip",
  ) as GoogleAgendaRow[] | undefined;

  const syncGoogleCalendar = useAction(calendarApi.syncMyGoogleCalendarEvents as any) as (args: {
    startTime?: number;
    endTime?: number;
    limit?: number;
  }) => Promise<unknown>;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(GOOGLE_VIEW_MODE_STORAGE_KEY);
        if (cancelled) {
          return;
        }
        if (stored === "jobs_only" || stored === "jobs_and_google") {
          setViewModeState(stored);
        }
      } finally {
        if (!cancelled) {
          setViewModeReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canShowGoogleAgenda = Boolean(role && googleStatus?.connected === true);
  const resolvedViewMode: CalendarViewMode =
    canShowGoogleAgenda && viewMode === "jobs_and_google" ? "jobs_and_google" : "jobs_only";

  const setViewMode = useCallback((nextMode: CalendarViewMode) => {
    setViewModeState(nextMode);
    void AsyncStorage.setItem(GOOGLE_VIEW_MODE_STORAGE_KEY, nextMode).catch(() => {
      /* best-effort */
    });
  }, []);

  const remoteJobTimelineRows = useMemo(() => {
    if (!remoteRows) {
      return null;
    }
    return (remoteRows as unknown as Omit<TimelineRow, "source">[]).map((row) => ({
      ...row,
      source: "job" as const,
    }));
  }, [remoteRows]);

  const remoteGoogleTimelineRows = useMemo(() => {
    if (resolvedViewMode !== "jobs_and_google") {
      return [];
    }
    if (!googleAgendaRows) {
      return null;
    }

    const now = Date.now();
    return googleAgendaRows.map((row) => ({
      lessonId: row.providerEventId,
      source: "google" as const,
      roleView: (role ?? "instructor") as "instructor" | "studio",
      studioName: row.location ?? "Google Calendar",
      sport: row.title,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status,
      lifecycle: getLifecycle(row.status, now, row.startTime, row.endTime),
      ...(row.isAllDay ? { isAllDay: true } : {}),
      ...(row.location ? { location: row.location } : {}),
      ...(row.htmlLink ? { htmlLink: row.htmlLink } : {}),
    }));
  }, [googleAgendaRows, resolvedViewMode, role]);

  const remoteCombinedRows = useMemo(() => {
    if (!remoteJobTimelineRows) {
      return null;
    }
    return [...remoteJobTimelineRows, ...(remoteGoogleTimelineRows ?? [])].sort(
      (a, b) =>
        a.startTime - b.startTime || a.endTime - b.endTime || a.lessonId.localeCompare(b.lessonId),
    );
  }, [remoteGoogleTimelineRows, remoteJobTimelineRows]);

  const remoteRowsSignature = useMemo(
    () => (remoteCombinedRows ? buildTimelineRowsSignature(remoteCombinedRows) : ""),
    [remoteCombinedRows],
  );
  const lastPersistSignatureRef = useRef<string>("");

  const { cachedRows, cacheReady, persist } = useTimelineCache(
    role,
    startTime,
    endTime,
    resolvedViewMode,
  );

  useEffect(() => {
    if (!remoteCombinedRows) {
      return;
    }
    if (remoteRowsSignature === lastPersistSignatureRef.current) {
      return;
    }
    lastPersistSignatureRef.current = remoteRowsSignature;
    void persist(remoteCombinedRows);
  }, [persist, remoteCombinedRows, remoteRowsSignature]);

  const rows = useMemo(() => {
    if (remoteCombinedRows) {
      return remoteCombinedRows;
    }
    if (cachedRows) {
      return cachedRows;
    }
    return [];
  }, [cachedRows, remoteCombinedRows]);

  const filteredRows = useMemo(() => {
    const start = dayKeyToTimestamp(windowRange.start);
    const end = dayKeyToTimestamp(windowRange.end) + DAY_MS - 1;
    return rows
      .filter((row) => row.startTime >= start && row.startTime <= end)
      .sort((a, b) => a.startTime - b.startTime);
  }, [rows, windowRange.end, windowRange.start]);

  const syncEvents = useMemo(() => {
    if (!role || !remoteJobTimelineRows) {
      return [];
    }
    const now = Date.now();
    const staleCutoff = now - 7 * DAY_MS;
    return remoteJobTimelineRows
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
  }, [remoteJobTimelineRows, role]);

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
    if (!role) {
      return;
    }
    if (!calendarSettings || calendarSettings.calendarProvider !== "apple") {
      return;
    }
    if (!calendarSettings.calendarSyncEnabled) {
      return;
    }
    if (syncEvents.length === 0) {
      return;
    }
    if (appleSyncSignature === lastAppleSyncSignatureRef.current) {
      return;
    }
    lastAppleSyncSignatureRef.current = appleSyncSignature;
    void syncDeviceCalendarEvents(syncEvents);
  }, [appleSyncSignature, calendarSettings, role, syncEvents]);

  const lastGoogleSyncAtRef = useRef(0);
  useEffect(() => {
    if (!role) {
      return;
    }
    if (!googleStatus?.connected) {
      return;
    }
    if (!calendarSettings || calendarSettings.calendarProvider !== "google") {
      return;
    }
    if (!calendarSettings.calendarSyncEnabled && resolvedViewMode !== "jobs_and_google") {
      return;
    }
    const now = Date.now();
    if (now - lastGoogleSyncAtRef.current < 3 * 60 * 1000) {
      return;
    }
    lastGoogleSyncAtRef.current = now;
    void syncGoogleCalendar({
      startTime,
      endTime,
      limit: 1000,
    });
  }, [
    calendarSettings,
    endTime,
    googleStatus?.connected,
    resolvedViewMode,
    role,
    startTime,
    syncGoogleCalendar,
  ]);

  const { listItems, dayStartIndexByKey } = useMemo(() => {
    const rowsByDay = new Map<string, TimelineRow[]>();
    for (const row of filteredRows) {
      const dk = toDayKey(row.startTime);
      const existing = rowsByDay.get(dk);
      if (existing) {
        existing.push(row);
      } else {
        rowsByDay.set(dk, [row]);
      }
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
          items.push({
            kind: "lesson",
            key: `${dk}:${lesson.source}:${lesson.lessonId}`,
            dayKey: dk,
            lesson,
          });
        }
      }
    }

    return { listItems: items, dayStartIndexByKey: dayIndexMap };
  }, [filteredRows, windowRange.end, windowRange.start]);

  const initialScrollIndex = useMemo(
    () => dayStartIndexByKey.get(selectedDay) ?? dayStartIndexByKey.get(todayKey) ?? 0,
    [dayStartIndexByKey, selectedDay, todayKey],
  );

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
      if (index === undefined) {
        return;
      }
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
      }, 320);
    },
    [dayStartIndexByKey],
  );

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

  const prefetchWindowAroundDay = useCallback((dayKey: string) => {
    setWindowRange((prev) => {
      let nextStart = prev.start;
      let nextEnd = prev.end;
      const startBoundary = addDays(prev.start, TIMELINE_PREFETCH_THRESHOLD_DAYS);
      const endBoundary = addDays(prev.end, -TIMELINE_PREFETCH_THRESHOLD_DAYS);

      if (compareDayKey(dayKey, startBoundary) <= 0) {
        nextStart = addDays(dayKey, -TIMELINE_EXTEND_BUFFER_DAYS);
      }
      if (compareDayKey(dayKey, endBoundary) >= 0) {
        nextEnd = addDays(dayKey, TIMELINE_EXTEND_BUFFER_DAYS);
      }
      if (nextStart === prev.start && nextEnd === prev.end) {
        return prev;
      }
      return { start: nextStart, end: nextEnd };
    });
  }, []);

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (programmaticScrollRef.current) {
        return;
      }
      const now = Date.now();
      if (now - lastViewSyncAtRef.current < 180) {
        return;
      }
      const firstHeader = viewableItems.find(
        (viewableItem) => (viewableItem.item as TimelineListItem).kind === "dayHeader",
      );
      if (!firstHeader) {
        return;
      }

      const dayKey = (firstHeader.item as TimelineListItem).dayKey;

      if (!hasInitialViewportSyncRef.current) {
        if (dayKey !== selectedDayRef.current) {
          return;
        }
        hasInitialViewportSyncRef.current = true;
        lastViewSyncAtRef.current = now;
        return;
      }

      lastViewSyncAtRef.current = now;
      if (hasUserScrolledTimelineRef.current) {
        prefetchWindowAroundDay(dayKey);
      }
      if (selectedDayRef.current !== dayKey) {
        selectedDayRef.current = dayKey;
        setSelectedDay(dayKey);
      }
    },
    [prefetchWindowAroundDay],
  );

  const handleTimelineScrollBegin = useCallback(() => {
    hasUserScrolledTimelineRef.current = true;
  }, []);

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
    [handleDayPress, selectedDay],
  );

  const handleTodayPress = useCallback(() => {
    handleDayPress(todayKey);
  }, [handleDayPress, todayKey]);

  const openMonthPicker = useCallback(() => {
    setShowMonthPicker(true);
  }, []);

  const handleMonthPickerChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      if (Platform.OS !== "ios") {
        setShowMonthPicker(false);
      }
      if (!selectedDate) {
        return;
      }
      setShowMonthPicker(false);
      handleDayPress(toDayKey(selectedDate.getTime()));
    },
    [handleDayPress],
  );

  const overrideItemLayout = useCallback((layout: ItemLayout, item: TimelineListItem) => {
    if (item.kind === "dayHeader") {
      layout.size = ESTIMATED_DAY_HEADER_SIZE;
    } else if (item.kind === "empty") {
      layout.size = ESTIMATED_EMPTY_SIZE;
    } else {
      layout.size = ESTIMATED_LESSON_SIZE;
    }
  }, []);

  const isLoading =
    currentUser === undefined ||
    !viewModeReady ||
    (!cacheReady && !remoteRows) ||
    (resolvedViewMode === "jobs_and_google" && googleAgendaRows === undefined && !cachedRows);

  return {
    selectedDay,
    showMonthPicker,
    listRef,
    listItems,
    initialScrollIndex,
    lessonCountByDay,
    viewabilityConfig,
    onViewableItemsChanged,
    handleTimelineScrollBegin,
    handleDayPress,
    handleWeekChange,
    handleTodayPress,
    openMonthPicker,
    handleMonthPickerChange,
    overrideItemLayout,
    selectedDayTimestamp: dayKeyToTimestamp(selectedDay),
    isLoading,
    canShowGoogleAgenda,
    viewMode: resolvedViewMode,
    setViewMode,
  };
}

export { dayKeyToTimestamp, toDayKey };
