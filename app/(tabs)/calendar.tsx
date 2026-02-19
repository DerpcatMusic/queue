import { api } from "@/convex/_generated/api";
import { Brand } from "@/constants/brand";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNativeTabLayout } from "@/hooks/use-native-tab-layout";
import {
  syncAcceptedSessionsToDeviceCalendar,
  type DeviceCalendarSyncResult,
} from "@/lib/device-calendar-sync";
import {
  CalendarBody,
  CalendarContainer,
  CalendarHeader,
  type CalendarKitHandle,
  type EventItem,
} from "@howljs/calendar-kit";
import { useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  AppState,
  I18nManager,
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated from "react-native-reanimated";

const MIN_VISIBLE_DAYS = 1;
const MAX_VISIBLE_DAYS = 7;
const DEFAULT_VISIBLE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_HOUR_SLOT_HEIGHT = 64;
const MIN_HOUR_SLOT_HEIGHT = 42;
const MAX_HOUR_SLOT_HEIGHT = 126;
const CALENDAR_HOUR_COLUMN_WIDTH = 60;
const CALENDAR_RENDER_PAST_BUFFER_DAYS = 14;
const CALENDAR_RENDER_FUTURE_BUFFER_DAYS = 45;
const DEFAULT_EVENT_SWATCH: CalendarEventSwatch = {
  background: "#dcecff",
  title: "#0d1219",
};

type VisibleDayCount = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type CalendarSyncTone = "muted" | "primary" | "success" | "danger";
type CalendarSyncStatus = DeviceCalendarSyncResult["status"] | "syncing";
type CalendarViewMode = "day" | "week" | "month";
type CalendarEventSwatch = {
  background: string;
  title: string;
};

type MonthGridCell = {
  dateOnly: string;
  inMonth: boolean;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgba(hex: string, alpha: number) {
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

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateOnly(value: Date | string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatDateOnly(new Date());
  }
  return formatDateOnly(date);
}

function addDays(dateOnly: string, days: number) {
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

function addMonths(dateOnly: string, months: number) {
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

function getDateLabelDate(dateOnly: string) {
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

function startOfMonth(dateOnly: string) {
  const date = getDateLabelDate(dateOnly);
  return formatDateOnly(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonth(dateOnly: string) {
  const date = getDateLabelDate(dateOnly);
  return formatDateOnly(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function sameMonth(leftDateOnly: string, rightDateOnly: string) {
  const left = getDateLabelDate(leftDateOnly);
  const right = getDateLabelDate(rightDateOnly);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function getMiddleColumnOffset(dayCount: number) {
  const clampedDayCount = clamp(
    Math.round(dayCount),
    MIN_VISIBLE_DAYS,
    MAX_VISIBLE_DAYS,
  );
  return Math.floor((clampedDayCount - 1) / 2);
}

function getFocusedDateFromAnchor(anchorDate: string, dayCount: number) {
  return addDays(anchorDate, getMiddleColumnOffset(dayCount));
}

function getAnchorDateFromFocusedDate(focusedDate: string, dayCount: number) {
  return addDays(focusedDate, -getMiddleColumnOffset(dayCount));
}

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getCalendarEventSwatch(
  seed: string,
  swatches: readonly CalendarEventSwatch[],
) {
  if (swatches.length === 0) return DEFAULT_EVENT_SWATCH;
  const index = hashSeed(seed) % swatches.length;
  return swatches[index] ?? swatches[0] ?? DEFAULT_EVENT_SWATCH;
}

function chunkArray<T>(items: readonly T[], size: number) {
  if (size <= 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size) as T[]);
  }
  return chunks;
}

function toWeekdayIndexMonday(date: Date) {
  const sundayZero = date.getDay();
  return (sundayZero + 6) % 7;
}

export default function CalendarTabScreen() {
  const { t, i18n } = useTranslation();
  const tabLayout = useNativeTabLayout();
  const bottomChromeInset = tabLayout.bottomInset;
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];
  const calendarAccent = palette.calendar.accent;
  const eventSwatches = palette.calendar
    .eventSwatches as readonly CalendarEventSwatch[];
  const isRtl = i18n.dir() === "rtl" || I18nManager.isRTL;
  const gridLineColor = useMemo(
    () => hexToRgba(palette.borderStrong, colorScheme === "dark" ? 0.62 : 0.95),
    [colorScheme, palette.borderStrong],
  );

  const currentUser = useQuery(api.users.getCurrentUser, {});
  const isInstructor = currentUser?.role === "instructor";
  const applications = useQuery(
    api.jobs.getMyApplications,
    isInstructor ? { limit: 250 } : "skip",
  );
  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    isInstructor ? {} : "skip",
  );

  const initialFocusedDate = toDateOnly(new Date());
  const initialAnchorDate = getAnchorDateFromFocusedDate(
    initialFocusedDate,
    DEFAULT_VISIBLE_DAYS,
  );

  const calendarRef = useRef<CalendarKitHandle>(null);
  const anchorDateRef = useRef(initialAnchorDate);
  const pendingAnchorSyncRef = useRef<string | null>(null);
  const visibleDaysRef = useRef<VisibleDayCount>(DEFAULT_VISIBLE_DAYS);
  const calendarReadyTaskRef = useRef<ReturnType<
    typeof InteractionManager.runAfterInteractions
  > | null>(null);

  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [visibleDays, setVisibleDays] =
    useState<VisibleDayCount>(DEFAULT_VISIBLE_DAYS);
  const [anchorDate, setAnchorDate] = useState(() => initialAnchorDate);
  const [isCalendarReady, setIsCalendarReady] = useState(false);
  const [isCalendarInteractive, setIsCalendarInteractive] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() =>
    startOfMonth(initialFocusedDate),
  );
  const [monthSelectedDate, setMonthSelectedDate] =
    useState(initialFocusedDate);
  const [syncStatus, setSyncStatus] = useState<CalendarSyncStatus>("disabled");
  const [syncDetail, setSyncDetail] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [calendarWakeTick, setCalendarWakeTick] = useState(0);
  const calendarWakeTickRef = useRef(0);

  const locale = i18n.language || "en";

  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
      }),
    [locale],
  );

  const dayNumberFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
      }),
    [locale],
  );

  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
      }),
    [locale],
  );

  const monthOnlyFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
      }),
    [locale],
  );

  const dayTitleFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
        day: "numeric",
      }),
    [locale],
  );

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
      }),
    [locale],
  );

  const acceptedSessions = useMemo(() => {
    if (!applications) {
      return [];
    }

    return applications.filter(
      (row) => row.status === "accepted" && row.jobStatus !== "cancelled",
    );
  }, [applications]);

  const allCalendarEvents = useMemo<EventItem[]>(
    () =>
      acceptedSessions.map((session) => {
        const startDate = new Date(session.startTime).toISOString();
        const endDate = new Date(session.endTime).toISOString();
        const swatch = getCalendarEventSwatch(
          `${session.sport}-${session.studioName}`,
          eventSwatches,
        );
        const eventColor =
          session.jobStatus === "completed"
            ? hexToRgba(swatch.background, colorScheme === "dark" ? 0.72 : 0.84)
            : swatch.background;

        return {
          id: String(session.applicationId),
          title: `${session.sport} - ${session.studioName}`,
          color: eventColor,
          titleColor: swatch.title,
          start: {
            dateTime: startDate,
            ...(session.timeZone ? { timeZone: session.timeZone } : {}),
          },
          end: {
            dateTime: endDate,
            ...(session.timeZone ? { timeZone: session.timeZone } : {}),
          },
        };
      }),
    [acceptedSessions, colorScheme, eventSwatches],
  );

  const focusedDate = useMemo(
    () => getFocusedDateFromAnchor(anchorDate, visibleDays),
    [anchorDate, visibleDays],
  );

  const calendarEvents = useMemo(() => {
    const anchorStart = getDateLabelDate(anchorDate).getTime();
    const rangeStart = anchorStart - CALENDAR_RENDER_PAST_BUFFER_DAYS * DAY_MS;
    const rangeEnd = anchorStart + CALENDAR_RENDER_FUTURE_BUFFER_DAYS * DAY_MS;

    return allCalendarEvents.filter((event) => {
      const eventStart = new Date(event.start.dateTime ?? 0).getTime();
      const eventEnd = new Date(event.end.dateTime ?? 0).getTime();
      return eventEnd >= rangeStart && eventStart <= rangeEnd;
    });
  }, [allCalendarEvents, anchorDate]);

  const monthGridCells = useMemo<MonthGridCell[]>(() => {
    const cursor = getDateLabelDate(monthCursor);
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const monthStart = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const leadingDays = toWeekdayIndexMonday(monthStart);

    const cells: MonthGridCell[] = [];

    for (let index = leadingDays - 1; index >= 0; index -= 1) {
      const dayNumber = daysInPrevMonth - index;
      cells.push({
        dateOnly: formatDateOnly(new Date(year, month - 1, dayNumber)),
        inMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        dateOnly: formatDateOnly(new Date(year, month, day)),
        inMonth: true,
      });
    }

    const trailing = Math.max(0, 42 - cells.length);
    for (let day = 1; day <= trailing; day += 1) {
      cells.push({
        dateOnly: formatDateOnly(new Date(year, month + 1, day)),
        inMonth: false,
      });
    }

    return cells;
  }, [monthCursor]);

  const monthGridRows = useMemo(
    () => chunkArray(monthGridCells, 7),
    [monthGridCells],
  );

  const weekdayHeaderLabels = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const base = new Date(2024, 0, 1 + index);
      return {
        key: formatDateOnly(base),
        label: dayFormatter.format(base),
      };
    });
  }, [dayFormatter]);

  const monthAgendaSections = useMemo(() => {
    const startDateOnly = startOfMonth(monthCursor);
    const endDateOnly = endOfMonth(monthCursor);
    const eventsByDate = new Map<string, EventItem[]>();

    for (const event of allCalendarEvents) {
      const startDate = new Date(event.start.dateTime ?? 0);
      if (Number.isNaN(startDate.getTime())) continue;
      const dateOnly = toDateOnly(startDate);
      if (dateOnly < startDateOnly || dateOnly > endDateOnly) continue;
      const existing = eventsByDate.get(dateOnly);
      if (existing) {
        existing.push(event);
      } else {
        eventsByDate.set(dateOnly, [event]);
      }
    }

    for (const events of eventsByDate.values()) {
      events.sort((left, right) => {
        const leftStart = new Date(left.start.dateTime ?? 0).getTime();
        const rightStart = new Date(right.start.dateTime ?? 0).getTime();
        return leftStart - rightStart;
      });
    }

    const sortedDates = Array.from(eventsByDate.keys()).sort();
    const upcoming = sortedDates.filter(
      (dateOnly) => dateOnly >= monthSelectedDate,
    );
    const previous = sortedDates.filter(
      (dateOnly) => dateOnly < monthSelectedDate,
    );
    const orderedDates = [...upcoming, ...previous];

    return orderedDates.map((dateOnly) => ({
      dateOnly,
      events: eventsByDate.get(dateOnly) ?? [],
    }));
  }, [allCalendarEvents, monthCursor, monthSelectedDate]);

  useEffect(() => {
    visibleDaysRef.current = visibleDays;
  }, [visibleDays]);

  useEffect(() => {
    if (viewMode === "month") return;
    setMonthCursor(startOfMonth(focusedDate));
    setMonthSelectedDate(focusedDate);
  }, [focusedDate, viewMode]);

  const emitSelectionHaptic = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {
      // Ignore unsupported devices.
    });
  }, []);

  const canAutoSyncDeviceCalendar =
    isInstructor &&
    instructorSettings !== undefined &&
    instructorSettings !== null &&
    instructorSettings.calendarProvider !== "none" &&
    instructorSettings.calendarSyncEnabled;
  const preferredSyncProvider = instructorSettings?.calendarProvider ?? "none";

  const deviceSyncEvents = useMemo(() => {
    const now = Date.now();
    const minStart = now - 2 * DAY_MS;
    const maxStart = now + 180 * DAY_MS;
    return acceptedSessions
      .filter(
        (session) =>
          session.startTime >= minStart && session.startTime <= maxStart,
      )
      .sort((left, right) => left.startTime - right.startTime)
      .map((session) => ({
        id: String(session.applicationId),
        title: `${session.sport} - ${session.studioName}`,
        startTime: session.startTime,
        endTime: session.endTime,
        ...(session.timeZone ? { timeZone: session.timeZone } : {}),
        location: session.zone,
        ...(session.note ? { notes: session.note } : {}),
      }));
  }, [acceptedSessions]);

  useEffect(() => {
    calendarWakeTickRef.current = calendarWakeTick;
  }, [calendarWakeTick]);

  useEffect(() => {
    if (!canAutoSyncDeviceCalendar) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setCalendarWakeTick((value) => value + 1);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [canAutoSyncDeviceCalendar]);

  useEffect(() => {
    if (!canAutoSyncDeviceCalendar || !instructorSettings) {
      setSyncStatus("disabled");
      setSyncDetail(null);
      return;
    }

    const wakeTickAtStart = calendarWakeTick;
    let cancelled = false;
    setSyncStatus("syncing");

    void syncAcceptedSessionsToDeviceCalendar({
      enabled: true,
      preferredProvider: preferredSyncProvider,
      events: deviceSyncEvents,
    }).then((result) => {
      if (cancelled || wakeTickAtStart !== calendarWakeTickRef.current) return;
      setSyncStatus(result.status);
      setSyncDetail(result.message ?? null);
      if (result.status === "synced") {
        setLastSyncedAt(Date.now());
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    canAutoSyncDeviceCalendar,
    deviceSyncEvents,
    instructorSettings,
    preferredSyncProvider,
    calendarWakeTick,
  ]);

  const runCalendarImperative = useCallback(
    (callback: (calendar: CalendarKitHandle) => void) => {
      if (!isCalendarReady || !isCalendarInteractive || !calendarRef.current) {
        return false;
      }
      callback(calendarRef.current);
      return true;
    },
    [isCalendarInteractive, isCalendarReady],
  );

  const markCalendarInteractiveWhenReady = useCallback(() => {
    calendarReadyTaskRef.current?.cancel();
    setIsCalendarInteractive(false);
    calendarReadyTaskRef.current = InteractionManager.runAfterInteractions(
      () => {
        requestAnimationFrame(() => {
          setIsCalendarInteractive(true);
        });
      },
    );
  }, []);

  useEffect(
    () => () => {
      calendarReadyTaskRef.current?.cancel();
    },
    [],
  );

  useEffect(() => {
    if (!isCalendarReady || viewMode === "month") return;
    markCalendarInteractiveWhenReady();
  }, [isCalendarReady, markCalendarInteractiveWhenReady, viewMode]);

  useEffect(() => {
    if (!isCalendarReady || !isCalendarInteractive) return;
    if (!pendingAnchorSyncRef.current) return;
    const targetDate = pendingAnchorSyncRef.current;
    pendingAnchorSyncRef.current = null;
    runCalendarImperative((calendar) => {
      calendar.goToDate({
        date: targetDate,
        animatedDate: false,
        hourScroll: false,
        animatedHour: false,
      });
    });
  }, [isCalendarInteractive, isCalendarReady, runCalendarImperative]);

  const goToAnchorDate = useCallback(
    (nextAnchorDate: string, animated: boolean) => {
      anchorDateRef.current = nextAnchorDate;
      setAnchorDate(nextAnchorDate);
      const didRun = runCalendarImperative((calendar) => {
        calendar.goToDate({
          date: nextAnchorDate,
          animatedDate: animated,
          hourScroll: false,
          animatedHour: false,
        });
      });
      if (!didRun) {
        pendingAnchorSyncRef.current = nextAnchorDate;
      }
    },
    [runCalendarImperative],
  );

  const goToFocusedDate = useCallback(
    (nextFocusedDate: string, animated: boolean) => {
      const nextAnchorDate = getAnchorDateFromFocusedDate(
        nextFocusedDate,
        visibleDaysRef.current,
      );
      goToAnchorDate(nextAnchorDate, animated);
    },
    [goToAnchorDate],
  );

  const setVisibleDaysAroundDate = useCallback(
    (nextDays: VisibleDayCount, focusDate: string, animated: boolean) => {
      visibleDaysRef.current = nextDays;
      setVisibleDays(nextDays);
      goToAnchorDate(
        getAnchorDateFromFocusedDate(focusDate, nextDays),
        animated,
      );
    },
    [goToAnchorDate],
  );

  const applyViewMode = useCallback(
    (nextMode: CalendarViewMode) => {
      if (nextMode === viewMode) return;
      const focusDate =
        viewMode === "month"
          ? monthSelectedDate
          : getFocusedDateFromAnchor(
              anchorDateRef.current,
              visibleDaysRef.current,
            );

      if (nextMode === "day") {
        setVisibleDaysAroundDate(1, focusDate, false);
      }

      if (nextMode === "week") {
        setVisibleDaysAroundDate(MAX_VISIBLE_DAYS, focusDate, false);
      }

      if (nextMode === "month") {
        setMonthSelectedDate(focusDate);
        setMonthCursor(startOfMonth(focusDate));
      }

      setViewMode(nextMode);
    },
    [monthSelectedDate, setVisibleDaysAroundDate, viewMode],
  );

  const handleCalendarDateChanged = useCallback((nextDate: string) => {
    const normalized = toDateOnly(nextDate);
    if (normalized === anchorDateRef.current) return;
    anchorDateRef.current = normalized;
    setAnchorDate(normalized);
  }, []);

  const renderCustomHorizontalLine = useCallback(
    ({ index, borderColor }: { index: number; borderColor: string }) => (
      <View
        pointerEvents="none"
        style={[
          styles.horizontalLine,
          {
            backgroundColor: borderColor,
            height: Number.isInteger(index) ? 1 : StyleSheet.hairlineWidth,
            opacity:
              colorScheme === "dark"
                ? Number.isInteger(index)
                  ? 0.9
                  : 0.48
                : Number.isInteger(index)
                  ? 1
                  : 0.75,
          },
        ]}
      />
    ),
    [colorScheme],
  );

  const visibleColumnCount = visibleDays;
  const lastVisibleDate = addDays(anchorDate, visibleColumnCount - 1);
  const todayDateOnly = toDateOnly(new Date());
  const isLoadingCurrentUser = currentUser === undefined;
  const isLoadingApplications = isInstructor && applications === undefined;
  const hasEvents = acceptedSessions.length > 0;
  const showEmptyCalendarMessage =
    !isLoadingCurrentUser &&
    !isLoadingApplications &&
    (!isInstructor || !hasEvents);

  const syncTone: CalendarSyncTone = useMemo(() => {
    if (syncStatus === "synced") return "success";
    if (syncStatus === "syncing") return "primary";
    if (syncStatus === "permission_denied" || syncStatus === "failed")
      return "danger";
    return "muted";
  }, [syncStatus]);

  const syncLabel = useMemo(() => {
    if (!canAutoSyncDeviceCalendar) return t("calendarTab.sync.disabled");
    if (syncStatus === "syncing") return t("calendarTab.sync.syncing");
    if (syncStatus === "synced") {
      if (!lastSyncedAt) return t("calendarTab.sync.synced");
      return t("calendarTab.sync.syncedAt", {
        time: new Date(lastSyncedAt).toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }
    if (syncStatus === "permission_denied")
      return t("calendarTab.sync.permissionDenied");
    if (syncStatus === "failed") return t("calendarTab.sync.failed");
    return t("calendarTab.sync.disabled");
  }, [canAutoSyncDeviceCalendar, syncStatus, lastSyncedAt, locale, t]);

  const timelineTitle =
    viewMode === "day"
      ? dayTitleFormatter.format(getDateLabelDate(focusedDate))
      : monthOnlyFormatter.format(getDateLabelDate(focusedDate));

  const monthTitle = monthFormatter.format(getDateLabelDate(monthCursor));

  const rangeLabel =
    viewMode === "week"
      ? `${dayNumberFormatter.format(getDateLabelDate(anchorDate))} - ${dayNumberFormatter.format(getDateLabelDate(lastVisibleDate))}`
      : monthFormatter.format(getDateLabelDate(focusedDate));

  const handleJumpToday = useCallback(() => {
    if (viewMode === "month") {
      setMonthSelectedDate(todayDateOnly);
      setMonthCursor(startOfMonth(todayDateOnly));
      return;
    }
    goToFocusedDate(todayDateOnly, true);
  }, [goToFocusedDate, todayDateOnly, viewMode]);

  const handleShiftFocusedDay = useCallback(
    (delta: number) => {
      const nextFocused = addDays(
        getFocusedDateFromAnchor(anchorDateRef.current, visibleDaysRef.current),
        delta,
      );
      goToFocusedDate(nextFocused, true);
    },
    [goToFocusedDate],
  );

  const handleNavigateByPage = useCallback(
    (direction: -1 | 1) => {
      const didRun = runCalendarImperative((calendar) => {
        if (direction > 0) {
          calendar.goToNextPage(true, true);
        } else {
          calendar.goToPrevPage(true, true);
        }
      });
      if (didRun) {
        emitSelectionHaptic();
        return;
      }

      handleShiftFocusedDay(direction);
    },
    [emitSelectionHaptic, handleShiftFocusedDay, runCalendarImperative],
  );

  const handleNavigatePrevious = useCallback(() => {
    if (viewMode === "month") {
      const previousMonthAnchor = startOfMonth(addMonths(monthCursor, -1));
      setMonthCursor(previousMonthAnchor);
      if (!sameMonth(monthSelectedDate, previousMonthAnchor)) {
        setMonthSelectedDate(previousMonthAnchor);
      }
      return;
    }
    handleNavigateByPage(-1);
  }, [handleNavigateByPage, monthCursor, monthSelectedDate, viewMode]);

  const handleNavigateNext = useCallback(() => {
    if (viewMode === "month") {
      const nextMonthAnchor = startOfMonth(addMonths(monthCursor, 1));
      setMonthCursor(nextMonthAnchor);
      if (!sameMonth(monthSelectedDate, nextMonthAnchor)) {
        setMonthSelectedDate(nextMonthAnchor);
      }
      return;
    }
    handleNavigateByPage(1);
  }, [handleNavigateByPage, monthCursor, monthSelectedDate, viewMode]);

  const handleSelectMonthDate = useCallback(
    (dateOnly: string, inMonth: boolean) => {
      if (!inMonth) {
        setMonthCursor(startOfMonth(dateOnly));
      }
      setMonthSelectedDate(dateOnly);
      emitSelectionHaptic();
    },
    [emitSelectionHaptic],
  );

  const renderMonthAgendaEvent = useCallback(
    (event: EventItem) => {
      const startDate = new Date(event.start.dateTime ?? 0);
      const endDate = new Date(event.end.dateTime ?? 0);
      const eventTimeRange =
        Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())
          ? ""
          : `${timeFormatter.format(startDate)} - ${timeFormatter.format(endDate)}`;

      const eventColor =
        typeof event.color === "string"
          ? event.color
          : palette.calendar.accentSubtle;
      const eventTitleColor =
        typeof event.titleColor === "string" ? event.titleColor : palette.text;

      return (
        <View
          key={event.id}
          style={[
            styles.monthAgendaEvent,
            {
              backgroundColor: eventColor,
              borderColor: hexToRgba(
                eventTitleColor,
                colorScheme === "dark" ? 0.28 : 0.2,
              ),
            },
          ]}
        >
          <Animated.Text
            style={[
              styles.monthAgendaEventTitle,
              {
                color: eventTitleColor,
              },
            ]}
            numberOfLines={1}
          >
            {event.title}
          </Animated.Text>
          {eventTimeRange ? (
            <Animated.Text
              style={[
                styles.monthAgendaEventTime,
                {
                  color: hexToRgba(
                    eventTitleColor,
                    colorScheme === "dark" ? 0.82 : 0.78,
                  ),
                },
              ]}
            >
              {eventTimeRange}
            </Animated.Text>
          ) : null}
        </View>
      );
    },
    [colorScheme, palette.calendar.accentSubtle, palette.text, timeFormatter],
  );

  const renderCalendarDayItem = useCallback(
    ({ dateUnix }: { dateUnix: number }) => {
      const date = new Date(dateUnix);
      const dateOnly = toDateOnly(date);
      const isToday = dateOnly === todayDateOnly;
      const isFocused = dateOnly === focusedDate;

      return (
        <Pressable
          onPress={() => {
            if (!isFocused) {
              goToFocusedDate(dateOnly, true);
            }
            emitSelectionHaptic();
          }}
          android_ripple={{
            color: hexToRgba(calendarAccent, 0.14),
            borderless: false,
          }}
          style={styles.calendarDayItemPressable}
        >
          <View style={styles.calendarDayItem}>
            <Animated.Text
              style={[
                styles.calendarDayWeekday,
                {
                  color: isFocused
                    ? palette.onPrimary
                    : isToday
                      ? calendarAccent
                      : palette.textMuted,
                },
              ]}
              numberOfLines={1}
            >
              {dayFormatter.format(date)}
            </Animated.Text>
            <View
              style={[
                styles.calendarDayNumberWrap,
                isFocused
                  ? { backgroundColor: calendarAccent }
                  : isToday
                    ? {
                        borderColor: calendarAccent,
                        backgroundColor: hexToRgba(calendarAccent, 0.14),
                      }
                    : null,
              ]}
            >
              <Animated.Text
                style={[
                  styles.calendarDayNumber,
                  {
                    color: isFocused ? palette.onPrimary : palette.text,
                  },
                ]}
                numberOfLines={1}
              >
                {dayNumberFormatter.format(date)}
              </Animated.Text>
            </View>
            <View
              style={[
                styles.calendarDayDot,
                isToday && !isFocused
                  ? { backgroundColor: calendarAccent, opacity: 1 }
                  : { opacity: 0 },
              ]}
            />
          </View>
        </Pressable>
      );
    },
    [
      calendarAccent,
      dayFormatter,
      dayNumberFormatter,
      emitSelectionHaptic,
      focusedDate,
      goToFocusedDate,
      palette.onPrimary,
      palette.text,
      palette.textMuted,
      todayDateOnly,
    ],
  );

  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <View
        style={[
          styles.page,
          {
            paddingTop: tabLayout.topInset,
            paddingBottom: 0,
          },
        ]}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
        >
          <View
            style={[
              styles.modeControl,
              {
                borderColor: palette.border,
                flexDirection: isRtl ? "row-reverse" : "row",
              },
            ]}
          >
            {(
              [
                ["day", t("calendarTab.mode.day")],
                ["week", t("calendarTab.mode.week")],
                ["month", t("calendarTab.mode.month")],
              ] as const
            ).map(([mode, label]) => {
              const active = viewMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => applyViewMode(mode)}
                  android_ripple={{
                    color: hexToRgba(calendarAccent, 0.16),
                    borderless: false,
                  }}
                  style={[
                    styles.modeControlButton,
                    active && { borderBottomColor: calendarAccent },
                  ]}
                >
                  <Animated.Text
                    style={[
                      styles.modeControlLabel,
                      {
                        color: active ? calendarAccent : palette.textMuted,
                      },
                    ]}
                  >
                    {label}
                  </Animated.Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.headerTitleRow}>
            <Animated.Text style={[styles.title, { color: calendarAccent }]}>
              {viewMode === "month" ? monthTitle : timelineTitle}
            </Animated.Text>
            <Animated.Text
              style={[
                styles.subTitle,
                {
                  color:
                    viewMode === "month"
                      ? syncTone === "success"
                        ? palette.success
                        : syncTone === "danger"
                          ? palette.danger
                          : syncTone === "primary"
                            ? calendarAccent
                            : palette.textMuted
                      : palette.textMuted,
                },
              ]}
            >
              {viewMode === "month" ? syncLabel : rangeLabel}
            </Animated.Text>
          </View>

          <View
            style={[
              styles.navigationRow,
              {
                flexDirection: isRtl ? "row-reverse" : "row",
              },
            ]}
          >
            <Pressable
              onPress={handleNavigatePrevious}
              hitSlop={10}
              android_ripple={{
                color: hexToRgba(calendarAccent, 0.16),
                radius: 18,
              }}
              style={styles.navigationButton}
            >
              <Animated.Text
                style={[
                  styles.navigationButtonLabel,
                  { color: calendarAccent },
                ]}
              >
                {isRtl ? ">" : "<"}
              </Animated.Text>
            </Pressable>

            <Pressable
              onPress={handleJumpToday}
              android_ripple={{
                color: hexToRgba(calendarAccent, 0.16),
                radius: 20,
              }}
              style={[
                styles.todayButton,
                {
                  backgroundColor: "transparent",
                },
              ]}
            >
              <Animated.Text
                style={[styles.todayButtonLabel, { color: palette.text }]}
              >
                {t("calendarTab.today")}
              </Animated.Text>
            </Pressable>

            <Pressable
              onPress={handleNavigateNext}
              hitSlop={10}
              android_ripple={{
                color: hexToRgba(calendarAccent, 0.16),
                radius: 18,
              }}
              style={styles.navigationButton}
            >
              <Animated.Text
                style={[
                  styles.navigationButtonLabel,
                  { color: calendarAccent },
                ]}
              >
                {isRtl ? "<" : ">"}
              </Animated.Text>
            </Pressable>
          </View>

          {viewMode === "month" ? (
            <View
              style={[
                styles.monthFrame,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.surface,
                },
              ]}
            >
              <View
                style={[
                  styles.monthWeekdayRow,
                  {
                    flexDirection: isRtl ? "row-reverse" : "row",
                  },
                ]}
              >
                {weekdayHeaderLabels.map((item) => (
                  <View key={item.key} style={styles.monthWeekdayCell}>
                    <Animated.Text
                      style={[
                        styles.monthWeekdayLabel,
                        { color: palette.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Animated.Text>
                  </View>
                ))}
              </View>

              {monthGridRows.map((weekRow) => (
                <View
                  key={`row-${weekRow.map((cell) => cell.dateOnly).join("|")}`}
                  style={[
                    styles.monthRow,
                    {
                      flexDirection: isRtl ? "row-reverse" : "row",
                    },
                  ]}
                >
                  {weekRow.map((cell) => {
                    const selected = cell.dateOnly === monthSelectedDate;
                    const isToday = cell.dateOnly === todayDateOnly;
                    const dayNumber = dayNumberFormatter.format(
                      getDateLabelDate(cell.dateOnly),
                    );
                    return (
                      <Pressable
                        key={cell.dateOnly}
                        onPress={() =>
                          handleSelectMonthDate(cell.dateOnly, cell.inMonth)
                        }
                        android_ripple={{
                          color: hexToRgba(calendarAccent, 0.16),
                          borderless: false,
                        }}
                        style={styles.monthCell}
                      >
                        <View
                          style={[
                            styles.monthCellInner,
                            selected && {
                              backgroundColor: calendarAccent,
                            },
                            !selected &&
                              isToday && {
                                borderColor: calendarAccent,
                                borderWidth: 1,
                              },
                          ]}
                        >
                          <Animated.Text
                            style={[
                              styles.monthCellLabel,
                              {
                                color: selected
                                  ? palette.onPrimary
                                  : cell.inMonth
                                    ? palette.text
                                    : palette.textMuted,
                              },
                            ]}
                          >
                            {dayNumber}
                          </Animated.Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <Animated.View
          style={[
            styles.body,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
        >
          {isLoadingCurrentUser || isLoadingApplications ? (
            <View style={styles.calendarLoadingState}>
              <ActivityIndicator color={calendarAccent} />
              <Animated.Text
                style={[styles.loadingLabel, { color: palette.textMuted }]}
              >
                {t("calendarTab.loading")}
              </Animated.Text>
            </View>
          ) : viewMode === "month" ? (
            <ScrollView
              style={styles.monthAgendaScroll}
              contentContainerStyle={[
                styles.monthAgendaContent,
                {
                  paddingBottom: bottomChromeInset,
                },
              ]}
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator={false}
            >
              {monthAgendaSections.length === 0 ? (
                <View style={styles.monthAgendaEmpty}>
                  <Animated.Text
                    style={[styles.emptyStateTitle, { color: palette.text }]}
                  >
                    {t("calendarTab.month.emptyTitle")}
                  </Animated.Text>
                  <Animated.Text
                    style={[
                      styles.emptyStateBody,
                      { color: palette.textMuted },
                    ]}
                  >
                    {t("calendarTab.month.emptyBody")}
                  </Animated.Text>
                </View>
              ) : (
                monthAgendaSections.map((section) => {
                  const sectionDate = getDateLabelDate(section.dateOnly);
                  const sectionTitle = `${dayNumberFormatter.format(sectionDate)} ${dayFormatter.format(sectionDate)}`;
                  return (
                    <View
                      key={section.dateOnly}
                      style={styles.monthAgendaSection}
                    >
                      <Animated.Text
                        style={[
                          styles.monthAgendaSectionTitle,
                          { color: calendarAccent },
                        ]}
                      >
                        {sectionTitle}
                      </Animated.Text>
                      <View style={styles.monthAgendaSectionEvents}>
                        {section.events.map(renderMonthAgendaEvent)}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          ) : (
            <>
              <CalendarContainer
                ref={calendarRef}
                initialDate={initialAnchorDate}
                hourWidth={CALENDAR_HOUR_COLUMN_WIDTH}
                numberOfDays={visibleDays}
                scrollByDay
                allowHorizontalSwipe
                events={calendarEvents}
                onDateChanged={handleCalendarDateChanged}
                onChange={handleCalendarDateChanged}
                onLoad={() => {
                  setIsCalendarReady(true);
                  markCalendarInteractiveWhenReady();
                }}
                showWeekNumber={false}
                useAllDayEvent={false}
                start={6 * 60}
                end={24 * 60}
                initialTimeIntervalHeight={DEFAULT_HOUR_SLOT_HEIGHT}
                minTimeIntervalHeight={MIN_HOUR_SLOT_HEIGHT}
                maxTimeIntervalHeight={MAX_HOUR_SLOT_HEIGHT}
                spaceFromBottom={bottomChromeInset}
                allowPinchToZoom={false}
                overlapType="no-overlap"
                theme={{
                  colors: {
                    primary: calendarAccent,
                    onPrimary: palette.onPrimary,
                    background: palette.appBg,
                    onBackground: palette.text,
                    border: gridLineColor,
                    text: palette.text,
                    surface: palette.surface,
                    onSurface: palette.textMuted,
                  },
                  hourTextStyle: {
                    color: palette.textMuted,
                    fontSize: 11,
                  },
                  hourBorderColor: gridLineColor,
                  headerBorderColor: gridLineColor,
                  dayBarBorderColor: gridLineColor,
                  nowIndicatorColor: calendarAccent,
                  eventContainerStyle: {
                    borderRadius: 10,
                  },
                  eventTitleStyle: {
                    fontSize: 12,
                    fontWeight: "600",
                  },
                }}
              >
                <CalendarHeader
                  dayBarHeight={74}
                  headerBottomHeight={0}
                  renderDayItem={renderCalendarDayItem}
                />
                <CalendarBody
                  hourFormat="HH:mm"
                  showNowIndicator
                  showTimeColumnRightLine
                  renderCustomHorizontalLine={renderCustomHorizontalLine}
                />
              </CalendarContainer>

              {showEmptyCalendarMessage ? (
                <View pointerEvents="none" style={styles.emptyStateOverlay}>
                  <Animated.Text
                    style={[styles.emptyStateTitle, { color: palette.text }]}
                  >
                    {!isInstructor
                      ? t("calendarTab.empty.nonInstructorTitle")
                      : t("calendarTab.empty.noSessionsTitle")}
                  </Animated.Text>
                  <Animated.Text
                    style={[
                      styles.emptyStateBody,
                      { color: palette.textMuted },
                    ]}
                  >
                    {!isInstructor
                      ? t("calendarTab.empty.nonInstructorBody")
                      : t("calendarTab.empty.noSessionsBody")}
                  </Animated.Text>
                </View>
              ) : null}
            </>
          )}

          {syncStatus === "failed" && syncDetail ? (
            <View
              pointerEvents="none"
              style={[
                styles.syncErrorBanner,
                { bottom: tabLayout.bottomOverlayInset },
              ]}
            >
              <Animated.Text
                style={[styles.syncErrorText, { color: palette.danger }]}
              >
                {syncDetail}
              </Animated.Text>
            </View>
          ) : null}
        </Animated.View>
      </View>

      {!isInstructor ? (
        <View
          style={[
            styles.roleHint,
            {
              borderTopColor: palette.border,
              backgroundColor: palette.appBg,
              paddingBottom: tabLayout.bottomInset,
            },
          ]}
        >
          <Animated.Text
            style={[styles.roleHintText, { color: palette.textMuted }]}
          >
            {t("calendarTab.footerHint")}
          </Animated.Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    flex: 1,
    gap: 0,
    paddingHorizontal: 0,
  },
  header: {
    borderBottomWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  modeControl: {
    borderBottomWidth: 1,
    gap: 2,
  },
  modeControlButton: {
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    flex: 1,
    justifyContent: "center",
    minHeight: 36,
  },
  modeControlLabel: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
  },
  headerTitleRow: {
    gap: 1,
  },
  title: {
    fontSize: 46,
    fontWeight: "800",
    lineHeight: 49,
    letterSpacing: -1,
  },
  subTitle: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 17,
  },
  navigationRow: {
    alignItems: "center",
    gap: 10,
  },
  navigationButton: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  navigationButtonLabel: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
  todayButton: {
    marginHorizontal: "auto",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  todayButtonLabel: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  calendarDayItemPressable: {
    flex: 1,
  },
  calendarDayItem: {
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    paddingTop: 8,
    paddingBottom: 6,
    gap: 1,
  },
  calendarDayWeekday: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 15,
    textTransform: "uppercase",
  },
  calendarDayNumberWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayNumber: {
    fontSize: 22,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    lineHeight: 26,
  },
  calendarDayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  monthFrame: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  monthWeekdayRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  monthWeekdayCell: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  monthWeekdayLabel: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
    textTransform: "uppercase",
  },
  monthRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthCell: {
    alignItems: "center",
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
  },
  monthCellInner: {
    alignItems: "center",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  monthCellLabel: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    lineHeight: 18,
  },
  body: {
    flex: 1,
    overflow: "hidden",
  },
  calendarLoadingState: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  loadingLabel: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  horizontalLine: {
    width: "100%",
  },
  monthAgendaScroll: {
    flex: 1,
  },
  monthAgendaContent: {
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  monthAgendaSection: {
    gap: 8,
  },
  monthAgendaSectionTitle: {
    fontSize: 21,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    lineHeight: 25,
  },
  monthAgendaSectionEvents: {
    gap: 8,
  },
  monthAgendaEvent: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  monthAgendaEventTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  monthAgendaEventTime: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    lineHeight: 17,
  },
  monthAgendaEmpty: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  emptyStateOverlay: {
    alignItems: "center",
    justifyContent: "center",
    left: 0,
    paddingHorizontal: 30,
    position: "absolute",
    right: 0,
    top: 96,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
  },
  emptyStateBody: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    textAlign: "center",
  },
  syncErrorBanner: {
    left: 14,
    position: "absolute",
    right: 14,
  },
  syncErrorText: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
    textAlign: "center",
  },
  roleHint: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  roleHintText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
