import { formatTime } from "@/lib/jobs-utils";
import type { AgendaSection, TimelineRow } from "./use-calendar-tab-controller";
import { dayKeyToTimestamp } from "./use-calendar-tab-controller";

export const DEFAULT_GRID_START_HOUR = 6;
export const DEFAULT_GRID_END_HOUR = 23;
export const MIN_GRID_START_HOUR = 5;
export const MAX_GRID_END_HOUR = 24;
export const HOUR_ROW_HEIGHT = 68;
export const DAY_COLUMN_WIDTH = 212;

export function formatMonthLabel(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export function formatWeekRangeLabel(weekDays: string[], locale: string) {
  const start = new Date(dayKeyToTimestamp(weekDays[0] ?? ""));
  const end = new Date(dayKeyToTimestamp(weekDays[weekDays.length - 1] ?? ""));
  const startLabel = start.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
  const endLabel = end.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
  return `${startLabel} - ${endLabel}`;
}

export function formatSelectedDayLabel(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatWeekdayLabel(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "short",
  });
}

export function formatDayNumber(dayKey: string) {
  return String(new Date(dayKeyToTimestamp(dayKey)).getDate());
}

export function formatHourLabel(hour: number, locale: string) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatHoursMetric(hours: number) {
  const rounded = Math.round(hours * 10) / 10;
  if (rounded === 0) {
    return "0h";
  }
  return Number.isInteger(rounded) ? `${String(rounded)}h` : `${rounded.toFixed(1)}h`;
}

export function hashSport(sport: string) {
  let hash = 0;
  for (let index = 0; index < sport.length; index += 1) {
    hash = sport.charCodeAt(index) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getRowsForSection(section: AgendaSection | undefined) {
  if (!section) return [] as TimelineRow[];
  return section.data.flatMap((item) => (item.kind === "lesson" ? [item.lesson] : []));
}

export function getDurationHours(rows: TimelineRow[]) {
  return rows.reduce((total, row) => total + (row.endTime - row.startTime) / 3_600_000, 0);
}

export function buildLaneLayout(rows: TimelineRow[]) {
  const sorted = [...rows].sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);
  const laneEndTimes: number[] = [];
  const laneAssignments = new Map<string, number>();

  sorted.forEach((row) => {
    let lane = laneEndTimes.findIndex((endTime) => row.startTime >= endTime);
    if (lane === -1) {
      lane = laneEndTimes.length;
      laneEndTimes.push(row.endTime);
    } else {
      laneEndTimes[lane] = row.endTime;
    }
    laneAssignments.set(row.lessonId, lane);
  });

  return { laneAssignments, laneCount: Math.max(laneEndTimes.length, 1) };
}

export function resolveGridBounds(rows: TimelineRow[]) {
  if (rows.length === 0) {
    return {
      gridStartHour: DEFAULT_GRID_START_HOUR,
      gridEndHour: DEFAULT_GRID_END_HOUR,
    };
  }

  let earliestHour = DEFAULT_GRID_START_HOUR;
  let latestHour = DEFAULT_GRID_END_HOUR;

  rows.forEach((row) => {
    const start = new Date(row.startTime);
    const end = new Date(row.endTime);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    earliestHour = Math.min(earliestHour, startHour);
    latestHour = Math.max(latestHour, endHour);
  });

  const gridStartHour = Math.max(MIN_GRID_START_HOUR, Math.floor(earliestHour) - 1);
  const gridEndHour = Math.min(MAX_GRID_END_HOUR, Math.ceil(latestHour) + 1);

  return {
    gridStartHour,
    gridEndHour: Math.max(gridEndHour, gridStartHour + 8),
  };
}

export function formatLessonTimeRange(row: TimelineRow, locale: string) {
  return `${formatTime(row.startTime, locale)} - ${formatTime(row.endTime, locale)}`;
}
