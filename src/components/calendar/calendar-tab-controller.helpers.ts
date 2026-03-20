import {
  addDays,
  buildTimelineRowsSignature,
  type CalendarVisibilityFilters,
  DAY_MS,
  enumerateDays,
  type GoogleAgendaRow,
  getLifecycle,
  type TimelineListItem,
  type TimelineRow,
  toDayKey,
} from "./calendar-controller-helpers";

export function mergeVisibilityFilters(
  parsed: Partial<CalendarVisibilityFilters>,
  fallback: CalendarVisibilityFilters,
): CalendarVisibilityFilters {
  return {
    queueLessons: parsed.queueLessons ?? fallback.queueLessons,
    timedCalendarEvents: parsed.timedCalendarEvents ?? fallback.timedCalendarEvents,
    allDayCalendarEvents: parsed.allDayCalendarEvents ?? fallback.allDayCalendarEvents,
  };
}

export function buildRemoteJobTimelineRows(
  remoteRows: Omit<TimelineRow, "source">[] | undefined | null,
) {
  if (!remoteRows) {
    return null;
  }
  return remoteRows.map((row) => ({
    ...row,
    source: "job" as const,
  }));
}

export function buildRemoteGoogleTimelineRows(
  googleAgendaRows: GoogleAgendaRow[] | undefined,
  resolvedViewMode: "jobs_only" | "jobs_and_google",
  role: "instructor" | "studio" | undefined,
) {
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
}

export function combineTimelineRows(
  remoteJobTimelineRows: TimelineRow[] | null,
  remoteGoogleTimelineRows: TimelineRow[] | null,
) {
  if (!remoteJobTimelineRows) {
    return null;
  }
  return [...remoteJobTimelineRows, ...(remoteGoogleTimelineRows ?? [])].sort(
    (a, b) =>
      a.startTime - b.startTime || a.endTime - b.endTime || a.lessonId.localeCompare(b.lessonId),
  );
}

export function getRemoteRowsSignature(remoteCombinedRows: TimelineRow[] | null) {
  return remoteCombinedRows ? buildTimelineRowsSignature(remoteCombinedRows) : "";
}

export function buildVisibleRows(
  rows: TimelineRow[],
  visibilityFilters: CalendarVisibilityFilters,
) {
  return rows.filter((row) => {
    if (row.source === "job") {
      return visibilityFilters.queueLessons;
    }
    if (row.isAllDay) {
      return visibilityFilters.allDayCalendarEvents;
    }
    return visibilityFilters.timedCalendarEvents;
  });
}

export function buildFilteredRows(
  visibleRows: TimelineRow[],
  range: { start: string; end: string },
  dayKeyToTimestamp: (dayKey: string) => number,
) {
  const start = dayKeyToTimestamp(range.start);
  const end = dayKeyToTimestamp(range.end) + DAY_MS - 1;
  return visibleRows
    .filter((row) => row.startTime >= start && row.startTime <= end)
    .sort((a, b) => a.startTime - b.startTime);
}

export function buildSyncEvents(
  role: "instructor" | "studio" | undefined,
  remoteJobTimelineRows: TimelineRow[] | null,
) {
  if (!role || !remoteJobTimelineRows) {
    return [];
  }
  const now = Date.now();
  const staleCutoff = now - 7 * DAY_MS;
  return remoteJobTimelineRows
    .filter((row) => row.status !== "cancelled" && row.endTime >= staleCutoff)
    .sort(
      (a, b) =>
        a.startTime - b.startTime || a.endTime - b.endTime || a.lessonId.localeCompare(b.lessonId),
    )
    .map((row) => ({
      externalId: row.lessonId,
      title: `${row.sport} lesson`,
      startDate: new Date(row.startTime),
      endDate: new Date(row.endTime),
      notes: `Studio: ${row.studioName}`,
    }));
}

export function buildTimelineListData(
  filteredRows: TimelineRow[],
  windowRange: { start: string; end: string },
  selectedDay: string,
  todayKey: string,
) {
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
  const guaranteedDays = new Set([
    addDays(todayKey, -1),
    todayKey,
    addDays(todayKey, 1),
    selectedDay,
  ]);
  const days = enumerateDays(windowRange.start, windowRange.end).filter(
    (dayKey) => guaranteedDays.has(dayKey) || (rowsByDay.get(dayKey)?.length ?? 0) > 0,
  );

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
}

export function buildLessonCountByDay(visibleRows: TimelineRow[]) {
  const counts = new Map<string, number>();
  for (const row of visibleRows) {
    const dk = toDayKey(row.startTime);
    counts.set(dk, (counts.get(dk) ?? 0) + 1);
  }
  return counts;
}
