import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, type SectionList } from "react-native";

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

export type AgendaItem =
  | { kind: "empty"; key: string; dayKey: string }
  | { kind: "lesson"; key: string; dayKey: string; lesson: TimelineRow };

export type AgendaSection = {
  key: string;
  dayKey: string;
  data: AgendaItem[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_VERSION = 2;
const TIMELINE_RANGE_DAYS = 120;
const TIMELINE_EXTEND_BUFFER_DAYS = 45;

export function toDayKey(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayKeyToTimestamp(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getTime();
}

export function addDays(dayKey: string, delta: number) {
  return toDayKey(dayKeyToTimestamp(dayKey) + delta * DAY_MS);
}

export function compareDayKey(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function resolveFirstDayOfWeek(locale: string) {
  try {
    const localeInfo = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: { firstDay?: number };
    };
    const firstDay = localeInfo.weekInfo?.firstDay;
    if (typeof firstDay === "number") {
      return firstDay % 7;
    }
  } catch {
    // Fall back below.
  }

  return locale.toLowerCase().startsWith("en-us") ? 0 : 1;
}

export function getWeekStart(dayKey: string, firstDayOfWeek: number) {
  const timestamp = dayKeyToTimestamp(dayKey);
  const date = new Date(timestamp);
  const dayOfWeek = date.getDay();
  const offset = (7 + dayOfWeek - firstDayOfWeek) % 7;
  return toDayKey(timestamp - offset * DAY_MS);
}

export function getWeekDays(weekStartKey: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStartKey, index));
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
        // Ignore cache read failures.
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
        // Ignore cache write failures.
      }
    },
    [cacheKey],
  );

  return { cachedRows, cacheReady, persist };
}

export function useCalendarTabController({ locale }: { locale: string }) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const todayKey = useMemo(() => toDayKey(Date.now()), []);
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const selectedDayRef = useRef(todayKey);
  const [windowRange, setWindowRange] = useState(() => ({
    start: addDays(todayKey, -TIMELINE_RANGE_DAYS),
    end: addDays(todayKey, TIMELINE_RANGE_DAYS),
  }));
  const listRef = useRef<SectionList<AgendaItem, AgendaSection>>(null);
  const pendingScrollRequestRef = useRef<{
    dayKey: string;
    animated: boolean;
  } | null>(null);

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
  const lastPersistSignatureRef = useRef("");

  const syncGoogleCalendar = useAction(
    calendarApi.syncMyGoogleCalendarEvents as never,
  ) as unknown as (args: {
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
  }, [cachedRows, remoteTimelineRows]);

  const filteredRows = useMemo(() => {
    const start = dayKeyToTimestamp(windowRange.start);
    const end = dayKeyToTimestamp(windowRange.end) + DAY_MS - 1;
    return rows
      .filter((row) => row.startTime >= start && row.startTime <= end)
      .sort((a, b) => a.startTime - b.startTime);
  }, [rows, windowRange.end, windowRange.start]);

  const syncEvents = useMemo(() => {
    if (currentUser?.role !== "instructor") return [];
    const staleCutoff = Date.now() - 7 * DAY_MS;
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
  const lastAppleSyncSignatureRef = useRef("");

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
  const googleSyncSignature = useMemo(
    () => `${startTime}:${endTime}:${remoteRowsSignature}`,
    [endTime, remoteRowsSignature, startTime],
  );
  const lastGoogleSyncSignatureRef = useRef("");
  useEffect(() => {
    if (currentUser?.role !== "instructor") return;
    if (!instructorSettings || instructorSettings.calendarProvider !== "google") return;
    if (!instructorSettings.calendarSyncEnabled) return;
    if (googleSyncSignature === lastGoogleSyncSignatureRef.current) return;
    const now = Date.now();
    if (now - lastGoogleSyncAtRef.current < 3 * 60 * 1000) return;
    lastGoogleSyncAtRef.current = now;
    lastGoogleSyncSignatureRef.current = googleSyncSignature;
    void syncGoogleCalendar({ startTime, endTime, limit: 1000 });
  }, [
    currentUser?.role,
    endTime,
    googleSyncSignature,
    instructorSettings,
    startTime,
    syncGoogleCalendar,
  ]);

  const lessonCountByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of filteredRows) {
      const dayKey = toDayKey(row.startTime);
      counts.set(dayKey, (counts.get(dayKey) ?? 0) + 1);
    }
    return counts;
  }, [filteredRows]);

  const { sections, sectionIndexByDay } = useMemo(() => {
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

    const agendaDayKeys = Array.from(rowsByDay.keys()).sort(compareDayKey);
    if (!rowsByDay.has(selectedDay)) {
      agendaDayKeys.push(selectedDay);
      agendaDayKeys.sort(compareDayKey);
    }

    if (agendaDayKeys.length === 0) {
      agendaDayKeys.push(selectedDay);
    }

    const nextSections = agendaDayKeys.map((dayKey) => {
      const dayRows = rowsByDay.get(dayKey) ?? [];
      const data: AgendaItem[] =
        dayRows.length > 0
          ? dayRows.map((lesson) => ({
              kind: "lesson",
              key: `${dayKey}:${lesson.lessonId}`,
              dayKey,
              lesson,
            }))
          : [{ kind: "empty", key: `${dayKey}:empty`, dayKey }];

      return {
        key: dayKey,
        dayKey,
        data,
      };
    });

    return {
      sections: nextSections,
      sectionIndexByDay: new Map(nextSections.map((section, index) => [section.dayKey, index])),
    };
  }, [filteredRows, selectedDay]);

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
      if (nextStart === prev.start && nextEnd === prev.end) return prev;
      return { start: nextStart, end: nextEnd };
    });
  }, []);

  const scrollToDay = useCallback(
    (dayKey: string, animated = true) => {
      const sectionIndex = sectionIndexByDay.get(dayKey);
      if (sectionIndex === undefined) {
        return false;
      }
      try {
        listRef.current?.scrollToLocation({
          sectionIndex,
          itemIndex: 0,
          animated,
          viewOffset: 8,
        });
        return true;
      } catch {
        return false;
      }
    },
    [sectionIndexByDay],
  );

  useEffect(() => {
    const pendingRequest = pendingScrollRequestRef.current;
    if (!pendingRequest) {
      return;
    }
    if (!sectionIndexByDay.has(pendingRequest.dayKey)) {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      const request = pendingScrollRequestRef.current;
      if (!request) {
        return;
      }
      const didScroll = scrollToDay(request.dayKey, request.animated);
      if (didScroll) {
        pendingScrollRequestRef.current = null;
      }
    });

    return () => {
      task.cancel();
    };
  }, [scrollToDay, sectionIndexByDay]);

  const handleDayPress = useCallback(
    (dayKey: string, options?: { animated?: boolean }) => {
      const animated = options?.animated ?? true;
      selectedDayRef.current = dayKey;
      setSelectedDay(dayKey);
      ensureDayInWindow(dayKey);
      pendingScrollRequestRef.current = {
        dayKey,
        animated,
      };
      if (!scrollToDay(dayKey, animated)) {
        return;
      }
      pendingScrollRequestRef.current = null;
    },
    [ensureDayInWindow, scrollToDay],
  );

  const handleWeekChange = useCallback(
    (deltaWeeks: number) => {
      handleDayPress(addDays(selectedDayRef.current, deltaWeeks * 7));
    },
    [handleDayPress],
  );

  const handleTodayPress = useCallback(() => {
    handleDayPress(todayKey, { animated: false });
  }, [handleDayPress, todayKey]);

  const firstDayOfWeek = useMemo(() => resolveFirstDayOfWeek(locale), [locale]);
  const selectedWeekStart = useMemo(
    () => getWeekStart(selectedDay, firstDayOfWeek),
    [firstDayOfWeek, selectedDay],
  );
  const selectedWeekDays = useMemo(() => getWeekDays(selectedWeekStart), [selectedWeekStart]);

  const isLoading = currentUser === undefined || (!cacheReady && !remoteRows);

  return {
    selectedDay,
    selectedWeekDays,
    listRef,
    sections,
    lessonCountByDay,
    handleDayPress,
    handleWeekChange,
    handleTodayPress,
    isLoading,
  };
}
