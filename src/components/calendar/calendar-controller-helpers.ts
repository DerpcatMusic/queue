import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";

export type CalendarViewMode = "jobs_only" | "jobs_and_google";
export type CalendarVisibilityFilterKey =
  | "queueLessons"
  | "timedCalendarEvents"
  | "allDayCalendarEvents";

export type CalendarVisibilityFilters = Record<CalendarVisibilityFilterKey, boolean>;

export type GoogleCalendarStatus = {
  connected: boolean;
};

export type GoogleAgendaRow = {
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

export const DAY_MS = 24 * 60 * 60 * 1000;
export const CACHE_TTL_MS = 15 * 60 * 1000;
export const CACHE_VERSION = 3;
export const TIMELINE_RANGE_DAYS = 120;
export const TIMELINE_EXTEND_BUFFER_DAYS = 90;
export const TIMELINE_PREFETCH_THRESHOLD_DAYS = 35;
export const ESTIMATED_DAY_HEADER_SIZE = 56;
export const ESTIMATED_LESSON_SIZE = 76;
export const ESTIMATED_EMPTY_SIZE = 34;
export const LEGACY_GOOGLE_VIEW_MODE_STORAGE_KEY = "calendar:view-mode:v1";
export const CALENDAR_VISIBILITY_STORAGE_KEY = "calendar:visibility-filters:v1";

export const DEFAULT_VISIBILITY_FILTERS: CalendarVisibilityFilters = {
  queueLessons: true,
  timedCalendarEvents: true,
  allDayCalendarEvents: true,
};

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

export function buildTimelineRowsSignature(rows: TimelineRow[]) {
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

export function enumerateDays(startKey: string, endKey: string) {
  const out: string[] = [];
  let cursor = startKey;
  while (compareDayKey(cursor, endKey) <= 0) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function getLifecycle(
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

export function useTimelineCache(
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

export type ItemLayout = { span?: number; size?: number };
