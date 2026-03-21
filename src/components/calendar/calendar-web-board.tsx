import DateTimePicker from "@react-native-community/datetimepicker";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

import { ActionButton } from "@/components/ui/action-button";
import { BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import {
  formatHourLabel,
  formatHoursMetric,
  formatMonthLabel,
  formatSelectedDayLabel,
  formatWeekRangeLabel,
  getDurationHours,
  getRowsForSection,
  HOUR_ROW_HEIGHT,
  resolveGridBounds,
} from "./calendar-web-board.helpers";
import { CalendarDayColumn, FocusAgendaCard, MetricTile } from "./calendar-web-board-parts";
import type { AgendaSection } from "./use-calendar-tab-controller";

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
    () => weekRowsByDay.find((entry) => entry.dayKey === selectedDay)?.rows ?? [],
    [selectedDay, weekRowsByDay],
  );
  const weekRows = useMemo(() => weekRowsByDay.flatMap((entry) => entry.rows), [weekRowsByDay]);
  const weekSessionCount = weekRows.length;
  const busyDayCount = weekRowsByDay.filter((entry) => entry.rows.length > 0).length;
  const weekBookedHours = getDurationHours(weekRows);
  const selectedBookedHours = getDurationHours(selectedRows);
  const { gridStartHour, gridEndHour } = useMemo(() => resolveGridBounds(weekRows), [weekRows]);
  const hours = useMemo(
    () => Array.from({ length: gridEndHour - gridStartHour }, (_, index) => gridStartHour + index),
    [gridEndHour, gridStartHour],
  );
  const gridHeight = hours.length * HOUR_ROW_HEIGHT;
  const now = Date.now();
  const todayOffsetHours =
    new Date(now).getHours() + new Date(now).getMinutes() / 60 + new Date(now).getSeconds() / 3600;
  const showNowLine = todayOffsetHours >= gridStartHour && todayOffsetHours <= gridEndHour;

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
          <Text style={{ ...BrandType.body, color: palette.textMuted as string }}>
            {formatWeekRangeLabel(weekDays, locale)}. One horizontal surface for scan, select, and
            adjust.
          </Text>
        </View>

        <MetricTile label="Week load" value={formatHoursMetric(weekBookedHours)} tone="light" />
        <MetricTile label="Active days" value={`${String(busyDayCount)}/7`} tone="accent" />
        <MetricTile
          label="Focus"
          value={selectedRows.length === 0 ? "OPEN" : formatHoursMetric(selectedBookedHours)}
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
          <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
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
          <ActionButton label="Today" onPress={onTodayPress} palette={palette} tone="secondary" />
          <ActionButton label="Next week" onPress={() => onChangeWeek(1)} palette={palette} />
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
            <ActionButton label="Apply" onPress={onToggleDatePicker} palette={palette} />
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
            <Text style={{ ...BrandType.caption, color: "rgba(255,255,255,0.72)" }}>
              {selectedRows.length === 0
                ? "A clear day gives you room to absorb new demand."
                : `${formatHoursMetric(selectedBookedHours)} booked across the selected day.`}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
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
                  Switch days directly from the planner header to review the rest of the week.
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

                {weekRowsByDay.map(({ dayKey, rows }) => (
                  <CalendarDayColumn
                    key={dayKey}
                    dayKey={dayKey}
                    rows={rows}
                    locale={locale}
                    selected={dayKey === selectedDay}
                    today={dayKey === todayKey}
                    todayKey={todayKey}
                    gridHeight={gridHeight}
                    gridStartHour={gridStartHour}
                    hours={hours}
                    showNowLine={showNowLine}
                    todayOffsetHours={todayOffsetHours}
                    onSelectDay={onSelectDay}
                  />
                ))}
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
