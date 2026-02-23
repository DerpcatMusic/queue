import type { ColorValue } from "react-native";
import type { DeviceCalendarSyncResult } from "@/lib/device-calendar-sync";

export const MIN_VISIBLE_DAYS = 1;
export const MAX_VISIBLE_DAYS = 7;
export const DEFAULT_VISIBLE_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_HOUR_SLOT_HEIGHT = 64;
export const MIN_HOUR_SLOT_HEIGHT = 42;
export const MAX_HOUR_SLOT_HEIGHT = 126;
export const CALENDAR_HOUR_COLUMN_WIDTH = 60;
export const CALENDAR_RENDER_PAST_BUFFER_DAYS = 14;
export const CALENDAR_RENDER_FUTURE_BUFFER_DAYS = 45;

export type VisibleDayCount = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type CalendarSyncTone = "muted" | "primary" | "success" | "danger";
export type CalendarSyncStatus = DeviceCalendarSyncResult["status"] | "syncing";
export type CalendarViewMode = "day" | "week" | "month";

export type CalendarEventSwatch = {
  background: string | ColorValue;
  title: string | ColorValue;
};

export const DEFAULT_EVENT_SWATCH: CalendarEventSwatch = {
  background: "#def7fd",
  title: "#066478",
};

export type MonthGridCell = {
  dateOnly: string;
  inMonth: boolean;
};

export const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const isShort = normalized.length === 3;
  const expanded = isShort
    ? normalized
        .split("")
        .map((segment) => `${segment}${segment}`)
        .join("")
    : normalized;

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  const safeAlpha = clamp(alpha, 0, 1);

  if (Number.isNaN(red) || Number.isNaN(green) || Number.isNaN(blue)) {
    return `rgba(0, 0, 0, ${safeAlpha})`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}

export function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDateOnly(value: Date | string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatDateOnly(new Date());
  }
  return formatDateOnly(date);
}

export function addDays(dateOnly: string, days: number) {
  const [yearRaw, monthRaw, dayRaw] = dateOnly.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12
  ) {
    return toDateOnly(Date.now() + days * DAY_MS);
  }

  const next = new Date(year, month - 1, day + days);
  return formatDateOnly(next);
}

export function addMonths(dateOnly: string, months: number) {
  const [yearRaw, monthRaw, dayRaw] = dateOnly.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return toDateOnly(new Date());
  }

  const next = new Date(year, month - 1 + months, day);
  return formatDateOnly(next);
}

export function getDateLabelDate(dateOnly: string) {
  const matched = DATE_ONLY_PATTERN.exec(dateOnly);
  if (!matched) {
    return new Date();
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return new Date();
  }
  return parsed;
}

export function startOfMonth(dateOnly: string) {
  const date = getDateLabelDate(dateOnly);
  return formatDateOnly(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function endOfMonth(dateOnly: string) {
  const date = getDateLabelDate(dateOnly);
  return formatDateOnly(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function sameMonth(leftDateOnly: string, rightDateOnly: string) {
  const left = getDateLabelDate(leftDateOnly);
  const right = getDateLabelDate(rightDateOnly);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

export function getMiddleColumnOffset(dayCount: number) {
  const clampedDayCount = clamp(
    Math.round(dayCount),
    MIN_VISIBLE_DAYS,
    MAX_VISIBLE_DAYS,
  );
  return Math.floor((clampedDayCount - 1) / 2);
}

export function getFocusedDateFromAnchor(anchorDate: string, dayCount: number) {
  return addDays(anchorDate, getMiddleColumnOffset(dayCount));
}

export function getAnchorDateFromFocusedDate(focusedDate: string, dayCount: number) {
  return addDays(focusedDate, -getMiddleColumnOffset(dayCount));
}

export function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getCalendarEventSwatch(
  seed: string,
  swatches: readonly CalendarEventSwatch[],
  fallback: CalendarEventSwatch,
) {
  if (swatches.length === 0) return fallback;
  const index = hashSeed(seed) % swatches.length;
  return swatches[index] ?? swatches[0] ?? fallback;
}

export function chunkArray<T>(items: readonly T[], size: number) {
  if (size <= 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size) as T[]);
  }
  return chunks;
}

export function toWeekdayIndexMonday(date: Date) {
  const sundayZero = date.getDay();
  return (sundayZero + 6) % 7;
}
