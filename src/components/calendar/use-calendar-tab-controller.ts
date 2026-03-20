import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FlashListRef } from "@shopify/flash-list";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, type ViewToken } from "react-native";

import { api } from "@/convex/_generated/api";
import { syncDeviceCalendarEvents } from "@/lib/device-calendar-sync";
import {
  addDays,
  buildTimelineRowsSignature,
  CALENDAR_VISIBILITY_STORAGE_KEY,
  type CalendarViewMode,
  type CalendarVisibilityFilterKey,
  type CalendarVisibilityFilters,
  compareDayKey,
  DAY_MS,
  DEFAULT_VISIBILITY_FILTERS,
  dayKeyToTimestamp,
  ESTIMATED_DAY_HEADER_SIZE,
  ESTIMATED_EMPTY_SIZE,
  ESTIMATED_LESSON_SIZE,
  enumerateDays,
  type GoogleAgendaRow,
  type GoogleCalendarStatus,
  getLifecycle,
  type ItemLayout,
  LEGACY_GOOGLE_VIEW_MODE_STORAGE_KEY,
  TIMELINE_EXTEND_BUFFER_DAYS,
  TIMELINE_PREFETCH_THRESHOLD_DAYS,
  TIMELINE_RANGE_DAYS,
  type TimelineListItem,
  type TimelineRow,
  toDayKey,
  useTimelineCache,
} from "./calendar-controller-helpers";

const calendarApi = (api as unknown as { calendar: Record<string, unknown> }).calendar as {
  getMyGoogleCalendarAgenda: unknown;
  getMyGoogleCalendarStatus: unknown;
  syncMyGoogleCalendarEvents: unknown;
};

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
  const [visibilityFilters, setVisibilityFilters] = useState<CalendarVisibilityFilters>(
    DEFAULT_VISIBILITY_FILTERS,
  );
  const [visibilityFiltersReady, setVisibilityFiltersReady] = useState(false);
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

  const canShowGoogleAgenda = Boolean(role && googleStatus?.connected === true);
  const shouldFetchGoogleAgenda =
    canShowGoogleAgenda &&
    (visibilityFilters.timedCalendarEvents || visibilityFilters.allDayCalendarEvents);

  const googleAgendaRows = useQuery(
    calendarApi.getMyGoogleCalendarAgenda as any,
    role && shouldFetchGoogleAgenda ? timelineArgs : "skip",
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
        const stored = await AsyncStorage.getItem(CALENDAR_VISIBILITY_STORAGE_KEY);
        if (cancelled) {
          return;
        }
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<CalendarVisibilityFilters>;
          setVisibilityFilters({
            queueLessons: parsed.queueLessons ?? DEFAULT_VISIBILITY_FILTERS.queueLessons,
            timedCalendarEvents:
              parsed.timedCalendarEvents ?? DEFAULT_VISIBILITY_FILTERS.timedCalendarEvents,
            allDayCalendarEvents:
              parsed.allDayCalendarEvents ?? DEFAULT_VISIBILITY_FILTERS.allDayCalendarEvents,
          });
          return;
        }

        const legacyViewMode = await AsyncStorage.getItem(LEGACY_GOOGLE_VIEW_MODE_STORAGE_KEY);
        if (legacyViewMode === "jobs_only") {
          setVisibilityFilters({
            queueLessons: true,
            timedCalendarEvents: false,
            allDayCalendarEvents: false,
          });
        }
      } finally {
        if (!cancelled) {
          setVisibilityFiltersReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedViewMode: CalendarViewMode = shouldFetchGoogleAgenda
    ? "jobs_and_google"
    : "jobs_only";

  const toggleVisibilityFilter = useCallback((key: CalendarVisibilityFilterKey) => {
    setVisibilityFilters((current) => {
      const next = {
        ...current,
        [key]: !current[key],
      };
      void AsyncStorage.setItem(CALENDAR_VISIBILITY_STORAGE_KEY, JSON.stringify(next)).catch(() => {
        /* best-effort */
      });
      return next;
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
  const [retainedRows, setRetainedRows] = useState<TimelineRow[]>([]);

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

  useEffect(() => {
    if (remoteCombinedRows) {
      setRetainedRows(remoteCombinedRows);
      return;
    }

    if (cachedRows) {
      setRetainedRows(cachedRows);
    }
  }, [cachedRows, remoteCombinedRows]);

  const rows = useMemo(() => {
    if (remoteCombinedRows) {
      return remoteCombinedRows;
    }
    if (cachedRows) {
      return cachedRows;
    }
    return retainedRows;
  }, [cachedRows, remoteCombinedRows, retainedRows]);

  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        if (row.source === "job") {
          return visibilityFilters.queueLessons;
        }
        if (row.isAllDay) {
          return visibilityFilters.allDayCalendarEvents;
        }
        return visibilityFilters.timedCalendarEvents;
      }),
    [rows, visibilityFilters],
  );

  const filteredRows = useMemo(() => {
    const start = dayKeyToTimestamp(windowRange.start);
    const end = dayKeyToTimestamp(windowRange.end) + DAY_MS - 1;
    return visibleRows
      .filter((row) => row.startTime >= start && row.startTime <= end)
      .sort((a, b) => a.startTime - b.startTime);
  }, [visibleRows, windowRange.end, windowRange.start]);

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
    if (!calendarSettings.calendarSyncEnabled && !shouldFetchGoogleAgenda) {
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
    role,
    startTime,
    shouldFetchGoogleAgenda,
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
    for (const row of visibleRows) {
      const dk = toDayKey(row.startTime);
      counts.set(dk, (counts.get(dk) ?? 0) + 1);
    }
    return counts;
  }, [visibleRows]);

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
      const sortedViewableItems = [...viewableItems].sort(
        (a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER),
      );
      const headerAnchor =
        sortedViewableItems.find(
          (viewableItem) => (viewableItem.item as TimelineListItem).kind === "dayHeader",
        ) ?? sortedViewableItems[0];
      if (!headerAnchor) {
        return;
      }

      const dayKey = (headerAnchor.item as TimelineListItem).dayKey;

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
    !visibilityFiltersReady ||
    (!cacheReady && remoteRows === undefined && retainedRows.length === 0) ||
    (shouldFetchGoogleAgenda &&
      googleAgendaRows === undefined &&
      !cachedRows &&
      retainedRows.length === 0);

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
    visibilityFilters,
    toggleVisibilityFilter,
  };
}

export {
  type AgendaSection,
  type CalendarVisibilityFilters,
  dayKeyToTimestamp,
  type TimelineListItem,
  type TimelineRow,
  toDayKey,
} from "./calendar-controller-helpers";
