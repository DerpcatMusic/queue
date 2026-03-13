import DateTimePicker from "@react-native-community/datetimepicker";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ActionButton } from "@/components/ui/action-button";
import { BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { formatTime } from "@/lib/jobs-utils";
import type { AgendaSection, TimelineRow } from "./use-calendar-tab-controller";
import { dayKeyToTimestamp } from "./use-calendar-tab-controller";

const DEFAULT_GRID_START_HOUR = 6;
const DEFAULT_GRID_END_HOUR = 23;
const MIN_GRID_START_HOUR = 5;
const MAX_GRID_END_HOUR = 24;
const HOUR_ROW_HEIGHT = 68;
const DAY_COLUMN_WIDTH = 212;

type CalendarWebBoardProps = {
  locale: string;
  selectedDay: string;
  todayKey: string;
  weekDays: string[];
  sections: AgendaSection[];
  onSelectDay: (dayKey: string) => void;
  onChangeWeek: (deltaWeeks: number) => void;
  onTodayPress: () => void;
  showDatePicker: boolean;
  pickerDate: Date;
  onDateChange: (_event: unknown, selectedDate?: Date) => void;
  onToggleDatePicker: () => void;
  onDismissDatePicker: () => void;
};

function formatMonthLabel(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function formatWeekRangeLabel(weekDays: string[], locale: string) {
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

function formatSelectedDayLabel(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatWeekdayLabel(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "short",
  });
}

function formatDayNumber(dayKey: string) {
  return String(new Date(dayKeyToTimestamp(dayKey)).getDate());
}

function formatHourLabel(hour: number, locale: string) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHoursMetric(hours: number) {
  const rounded = Math.round(hours * 10) / 10;
  if (rounded === 0) {
    return "0h";
  }
  return Number.isInteger(rounded)
    ? `${String(rounded)}h`
    : `${rounded.toFixed(1)}h`;
}

function hashSport(sport: string) {
  let hash = 0;
  for (let index = 0; index < sport.length; index += 1) {
    hash = sport.charCodeAt(index) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getRowsForSection(section: AgendaSection | undefined) {
  if (!section) return [] as TimelineRow[];
  return section.data.flatMap((item) =>
    item.kind === "lesson" ? [item.lesson] : [],
  );
}

function getDurationHours(rows: TimelineRow[]) {
  return rows.reduce(
    (total, row) => total + (row.endTime - row.startTime) / 3_600_000,
    0,
  );
}

function buildLaneLayout(rows: TimelineRow[]) {
  const sorted = [...rows].sort(
    (a, b) => a.startTime - b.startTime || a.endTime - b.endTime,
  );
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

function resolveGridBounds(rows: TimelineRow[]) {
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

  const gridStartHour = Math.max(
    MIN_GRID_START_HOUR,
    Math.floor(earliestHour) - 1,
  );
  const gridEndHour = Math.min(MAX_GRID_END_HOUR, Math.ceil(latestHour) + 1);

  return {
    gridStartHour,
    gridEndHour: Math.max(gridEndHour, gridStartHour + 8),
  };
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "light" | "accent" | "dark";
}) {
  const palette = useBrand();
  const styles =
    tone === "accent"
      ? {
          backgroundColor: palette.primary as string,
          labelColor: "rgba(255,255,255,0.72)",
          valueColor: palette.onPrimary as string,
        }
      : tone === "dark"
        ? {
            backgroundColor: palette.text as string,
            labelColor: "rgba(255,255,255,0.72)",
            valueColor: palette.surface as string,
          }
        : {
            backgroundColor: palette.surfaceAlt as string,
            labelColor: palette.textMuted as string,
            valueColor: palette.text as string,
          };

  return (
    <View
      style={{
        minWidth: 158,
        borderRadius: 28,
        borderCurve: "continuous",
        backgroundColor: styles.backgroundColor,
        paddingHorizontal: 18,
        paddingVertical: 16,
        gap: 8,
      }}
    >
      <Text
        style={{
          ...BrandType.micro,
          color: styles.labelColor,
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "BarlowCondensed_800ExtraBold",
          fontSize: 34,
          lineHeight: 30,
          letterSpacing: -0.9,
          fontVariant: ["tabular-nums"],
          color: styles.valueColor,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function FocusAgendaCard({
  locale,
  row,
}: {
  locale: string;
  row: TimelineRow;
}) {
  const palette = useBrand();
  const swatches = palette.calendar.eventSwatches;
  const swatch =
    swatches[hashSport(row.sport) % Math.max(swatches.length, 1)] ?? undefined;
  const accent = (swatch?.background as string) ?? (palette.primary as string);

  return (
    <View
      style={{
        borderRadius: 26,
        borderCurve: "continuous",
        backgroundColor: palette.surface as string,
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 8,
      }}
    >
      <View
        style={{
          width: 44,
          height: 6,
          borderRadius: 999,
          backgroundColor: accent,
        }}
      />
      <Text
        style={{ ...BrandType.title, color: palette.text as string }}
        numberOfLines={1}
      >
        {row.sport}
      </Text>
      <Text
        style={{ ...BrandType.caption, color: palette.textMuted as string }}
        numberOfLines={2}
      >
        {row.roleView === "instructor"
          ? row.studioName
          : (row.instructorName ?? "Unassigned instructor")}
      </Text>
      <Text
        style={{
          ...BrandType.micro,
          color: palette.primary as string,
          fontVariant: ["tabular-nums"],
        }}
      >
        {formatTime(row.startTime, locale)} - {formatTime(row.endTime, locale)}
      </Text>
    </View>
  );
}

export function CalendarWebBoard({
  locale,
  selectedDay,
  todayKey,
  weekDays,
  sections,
  onSelectDay,
  onChangeWeek,
  onTodayPress,
  showDatePicker,
  pickerDate,
  onDateChange,
  onToggleDatePicker,
  onDismissDatePicker,
}: CalendarWebBoardProps) {
  const palette = useBrand();
  const sectionMap = useMemo(
    () => new Map(sections.map((section) => [section.dayKey, section])),
    [sections],
  );
  const weekRowsByDay = useMemo(
    () =>
      weekDays.map((dayKey) => ({
        dayKey,
        rows: getRowsForSection(sectionMap.get(dayKey)),
      })),
    [sectionMap, weekDays],
  );
  const selectedRows = useMemo(
    () =>
      weekRowsByDay.find((entry) => entry.dayKey === selectedDay)?.rows ?? [],
    [selectedDay, weekRowsByDay],
  );
  const weekRows = useMemo(
    () => weekRowsByDay.flatMap((entry) => entry.rows),
    [weekRowsByDay],
  );
  const weekSessionCount = weekRows.length;
  const busyDayCount = weekRowsByDay.filter(
    (entry) => entry.rows.length > 0,
  ).length;
  const weekBookedHours = getDurationHours(weekRows);
  const selectedBookedHours = getDurationHours(selectedRows);
  const { gridStartHour, gridEndHour } = useMemo(
    () => resolveGridBounds(weekRows),
    [weekRows],
  );
  const hours = useMemo(
    () =>
      Array.from(
        { length: gridEndHour - gridStartHour },
        (_, index) => gridStartHour + index,
      ),
    [gridEndHour, gridStartHour],
  );
  const gridHeight = hours.length * HOUR_ROW_HEIGHT;
  const now = Date.now();
  const todayOffsetHours =
    new Date(now).getHours() +
    new Date(now).getMinutes() / 60 +
    new Date(now).getSeconds() / 3600;
  const showNowLine =
    todayOffsetHours >= gridStartHour && todayOffsetHours <= gridEndHour;

  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 22,
        paddingBottom: 24,
        gap: 18,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          gap: 14,
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 34,
            borderCurve: "continuous",
            backgroundColor: palette.surfaceAlt as string,
            paddingHorizontal: 24,
            paddingVertical: 22,
            gap: 10,
          }}
        >
          <Text
            style={{
              ...BrandType.micro,
              color: palette.primary as string,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Planning board
          </Text>
          <Text
            style={{
              ...BrandType.display,
              fontSize: 38,
              lineHeight: 36,
              color: palette.text as string,
            }}
          >
            {formatMonthLabel(selectedDay, locale)}
          </Text>
          <Text
            style={{ ...BrandType.body, color: palette.textMuted as string }}
          >
            {formatWeekRangeLabel(weekDays, locale)}. One horizontal surface for
            scan, select, and adjust.
          </Text>
        </View>

        <MetricTile
          label="Week load"
          value={formatHoursMetric(weekBookedHours)}
          tone="light"
        />
        <MetricTile
          label="Active days"
          value={`${String(busyDayCount)}/7`}
          tone="accent"
        />
        <MetricTile
          label="Focus"
          value={
            selectedRows.length === 0
              ? "OPEN"
              : formatHoursMetric(selectedBookedHours)
          }
          tone="dark"
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          borderRadius: 30,
          borderCurve: "continuous",
          backgroundColor: palette.surfaceAlt as string,
          paddingHorizontal: 18,
          paddingVertical: 16,
        }}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            style={{
              ...BrandType.micro,
              color: palette.textMuted as string,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            Focus day
          </Text>
          <Text
            style={{
              ...BrandType.heading,
              fontSize: 24,
              color: palette.text as string,
            }}
          >
            {formatSelectedDayLabel(selectedDay, locale)}
          </Text>
          <Text
            style={{ ...BrandType.caption, color: palette.textMuted as string }}
          >
            {selectedRows.length === 0
              ? "No sessions are stacked here yet."
              : selectedRows.length === 1
                ? "1 session loaded into the agenda rail."
                : `${String(selectedRows.length)} sessions loaded into the agenda rail.`}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ActionButton
            label="Prev week"
            onPress={() => onChangeWeek(-1)}
            palette={palette}
            tone="secondary"
          />
          <ActionButton
            label={showDatePicker ? "Done" : "Jump to date"}
            onPress={onToggleDatePicker}
            palette={palette}
            tone="secondary"
          />
          <ActionButton
            label="Today"
            onPress={onTodayPress}
            palette={palette}
            tone="secondary"
          />
          <ActionButton
            label="Next week"
            onPress={() => onChangeWeek(1)}
            palette={palette}
          />
        </View>
      </View>

      {showDatePicker ? (
        <View
          style={{
            borderRadius: 30,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: palette.surfaceAlt as string,
          }}
        >
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 10,
              paddingHorizontal: 18,
              paddingBottom: 18,
            }}
          >
            <ActionButton
              label="Close"
              onPress={onDismissDatePicker}
              palette={palette}
              tone="secondary"
            />
            <ActionButton
              label="Apply"
              onPress={onToggleDatePicker}
              palette={palette}
            />
          </View>
        </View>
      ) : null}

      <View style={{ flex: 1, minHeight: 0, flexDirection: "row", gap: 18 }}>
        <View
          style={{
            width: 320,
            borderRadius: 34,
            borderCurve: "continuous",
            backgroundColor: palette.surfaceAlt as string,
            paddingHorizontal: 18,
            paddingVertical: 18,
            gap: 14,
          }}
        >
          <View
            style={{
              borderRadius: 26,
              borderCurve: "continuous",
              backgroundColor: palette.text as string,
              paddingHorizontal: 16,
              paddingVertical: 16,
              gap: 6,
            }}
          >
            <Text
              style={{
                ...BrandType.micro,
                color: "rgba(255,255,255,0.72)",
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              Selected agenda
            </Text>
            <Text
              style={{
                ...BrandType.heading,
                fontSize: 24,
                color: palette.surface as string,
              }}
            >
              {selectedRows.length === 0
                ? "Open lane"
                : selectedRows.length === 1
                  ? "1 session"
                  : `${String(selectedRows.length)} sessions`}
            </Text>
            <Text
              style={{ ...BrandType.caption, color: "rgba(255,255,255,0.72)" }}
            >
              {selectedRows.length === 0
                ? "A clear day gives you room to absorb new demand."
                : `${formatHoursMetric(selectedBookedHours)} booked across the selected day.`}
            </Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {selectedRows.length === 0 ? (
              <View
                style={{
                  borderRadius: 26,
                  borderCurve: "continuous",
                  backgroundColor: palette.surface as string,
                  paddingHorizontal: 16,
                  paddingVertical: 18,
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    ...BrandType.bodyStrong,
                    color: palette.text as string,
                  }}
                >
                  Nothing booked
                </Text>
                <Text
                  style={{
                    ...BrandType.caption,
                    color: palette.textMuted as string,
                  }}
                >
                  Switch days directly from the planner header to review the
                  rest of the week.
                </Text>
              </View>
            ) : (
              selectedRows.map((row) => (
                <FocusAgendaCard key={row.lessonId} locale={locale} row={row} />
              ))
            )}
          </ScrollView>
        </View>

        <View
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: 34,
            borderCurve: "continuous",
            backgroundColor: palette.surfaceAlt as string,
            overflow: "hidden",
          }}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View
                style={{
                  flexDirection: "row",
                  minHeight: gridHeight + 84,
                  paddingHorizontal: 18,
                  paddingTop: 18,
                  paddingBottom: 18,
                }}
              >
                <View style={{ width: 84, paddingTop: 78 }}>
                  {hours.map((hour, index) => (
                    <View
                      key={hour}
                      style={{
                        height: HOUR_ROW_HEIGHT,
                        justifyContent: "flex-start",
                        paddingTop: 2,
                        paddingRight: 12,
                      }}
                    >
                      <Text
                        style={{
                          ...BrandType.micro,
                          color: palette.textMuted as string,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {formatHourLabel(hour, locale)}
                      </Text>
                      {index === 0 ? (
                        <Text
                          style={{
                            ...BrandType.micro,
                            color: palette.textMuted as string,
                          }}
                        >
                          {`${String(weekSessionCount)} total`}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>

                {weekRowsByDay.map(({ dayKey, rows }) => {
                  const { laneAssignments, laneCount } = buildLaneLayout(rows);
                  const dayLoadHours = getDurationHours(rows);
                  const laneWidth =
                    laneCount > 1
                      ? (DAY_COLUMN_WIDTH - 28) / laneCount
                      : DAY_COLUMN_WIDTH - 28;
                  const selected = dayKey === selectedDay;
                  const today = dayKey === todayKey;

                  return (
                    <View
                      key={dayKey}
                      style={{ width: DAY_COLUMN_WIDTH, marginRight: 12 }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => onSelectDay(dayKey)}
                      >
                        <View
                          style={{
                            height: 68,
                            borderRadius: 24,
                            borderCurve: "continuous",
                            backgroundColor: selected
                              ? (palette.text as string)
                              : today
                                ? (palette.primarySubtle as string)
                                : (palette.surface as string),
                            paddingHorizontal: 14,
                            justifyContent: "center",
                            gap: 2,
                          }}
                        >
                          <Text
                            style={{
                              ...BrandType.micro,
                              color: selected
                                ? "rgba(255,255,255,0.72)"
                                : today
                                  ? (palette.primary as string)
                                  : (palette.textMuted as string),
                              textTransform: "uppercase",
                              letterSpacing: 0.8,
                            }}
                          >
                            {formatWeekdayLabel(dayKey, locale)}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "baseline",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <Text
                              style={{
                                ...BrandType.heading,
                                fontSize: 28,
                                lineHeight: 28,
                                color: selected
                                  ? (palette.surface as string)
                                  : (palette.text as string),
                              }}
                            >
                              {formatDayNumber(dayKey)}
                            </Text>
                            <Text
                              style={{
                                ...BrandType.micro,
                                color: selected
                                  ? "rgba(255,255,255,0.72)"
                                  : rows.length > 0
                                    ? (palette.primary as string)
                                    : (palette.textMuted as string),
                              }}
                            >
                              {rows.length === 0
                                ? "Open"
                                : `${String(rows.length)} / ${formatHoursMetric(dayLoadHours)}`}
                            </Text>
                          </View>
                        </View>
                      </Pressable>

                      <View
                        style={{
                          marginTop: 10,
                          height: gridHeight,
                          borderRadius: 28,
                          borderCurve: "continuous",
                          backgroundColor: selected
                            ? (palette.surface as string)
                            : (palette.appBg as string),
                          overflow: "hidden",
                        }}
                      >
                        {hours.map((hour, index) => (
                          <View
                            key={`${dayKey}-${hour}`}
                            style={{
                              position: "absolute",
                              left: 0,
                              right: 0,
                              top: index * HOUR_ROW_HEIGHT,
                              height: HOUR_ROW_HEIGHT,
                              backgroundColor:
                                index % 2 === 0
                                  ? selected
                                    ? "rgba(15,23,42,0.03)"
                                    : "rgba(15,23,42,0.015)"
                                  : "transparent",
                            }}
                          />
                        ))}

                        {today && showNowLine ? (
                          <View
                            style={{
                              position: "absolute",
                              left: 12,
                              right: 12,
                              top:
                                (todayOffsetHours - gridStartHour) *
                                HOUR_ROW_HEIGHT,
                              height: 2,
                              borderRadius: 999,
                              backgroundColor: palette.primary as string,
                            }}
                          />
                        ) : null}

                        {rows.map((row) => {
                          const lane = laneAssignments.get(row.lessonId) ?? 0;
                          const dayStart = dayKeyToTimestamp(dayKey);
                          const startHourOffset =
                            (row.startTime - dayStart) / 3_600_000 -
                            gridStartHour;
                          const durationHours = Math.max(
                            0.75,
                            (row.endTime - row.startTime) / 3_600_000,
                          );
                          const swatches = palette.calendar.eventSwatches;
                          const swatch =
                            swatches[
                              hashSport(row.sport) %
                                Math.max(swatches.length, 1)
                            ] ?? undefined;
                          const accent =
                            (swatch?.background as string) ??
                            (palette.primary as string);
                          const top = Math.max(
                            8,
                            startHourOffset * HOUR_ROW_HEIGHT + 8,
                          );
                          const height = Math.max(
                            58,
                            durationHours * HOUR_ROW_HEIGHT - 10,
                          );

                          return (
                            <View
                              key={row.lessonId}
                              style={{
                                position: "absolute",
                                top,
                                left: 14 + lane * laneWidth,
                                width: laneWidth - 8,
                                height,
                                borderRadius: 24,
                                borderCurve: "continuous",
                                backgroundColor: accent,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                gap: 5,
                              }}
                            >
                              <Text
                                numberOfLines={1}
                                style={{
                                  ...BrandType.bodyStrong,
                                  color: palette.onPrimary as string,
                                }}
                              >
                                {row.sport}
                              </Text>
                              <Text
                                numberOfLines={1}
                                style={{
                                  ...BrandType.micro,
                                  color: "rgba(255,255,255,0.92)",
                                  fontVariant: ["tabular-nums"],
                                }}
                              >
                                {formatTime(row.startTime, locale)} -{" "}
                                {formatTime(row.endTime, locale)}
                              </Text>
                              <Text
                                numberOfLines={2}
                                style={{
                                  ...BrandType.micro,
                                  color: "rgba(255,255,255,0.78)",
                                }}
                              >
                                {row.roleView === "instructor"
                                  ? row.studioName
                                  : (row.instructorName ??
                                    "Unassigned instructor")}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
