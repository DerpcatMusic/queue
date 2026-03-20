import { Pressable, Text, View } from "react-native";

import { BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import {
  buildLaneLayout,
  DAY_COLUMN_WIDTH,
  formatDayNumber,
  formatHoursMetric,
  formatLessonTimeRange,
  formatWeekdayLabel,
  getDurationHours,
  HOUR_ROW_HEIGHT,
  hashSport,
} from "./calendar-web-board.helpers";
import type { TimelineRow } from "./use-calendar-tab-controller";
import { dayKeyToTimestamp } from "./use-calendar-tab-controller";

export function MetricTile({
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

export function FocusAgendaCard({ locale, row }: { locale: string; row: TimelineRow }) {
  const palette = useBrand();
  const swatches = palette.calendar.eventSwatches;
  const swatch = swatches[hashSport(row.sport) % Math.max(swatches.length, 1)] ?? undefined;
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
      <Text style={{ ...BrandType.title, color: palette.text as string }} numberOfLines={1}>
        {row.sport}
      </Text>
      <Text style={{ ...BrandType.caption, color: palette.textMuted as string }} numberOfLines={2}>
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
        {formatLessonTimeRange(row, locale)}
      </Text>
    </View>
  );
}

export function CalendarDayColumn({
  dayKey,
  rows,
  locale,
  selected,
  today,
  todayKey,
  gridHeight,
  gridStartHour,
  hours,
  showNowLine,
  todayOffsetHours,
  onSelectDay,
}: {
  dayKey: string;
  rows: TimelineRow[];
  locale: string;
  selected: boolean;
  today: boolean;
  todayKey: string;
  gridHeight: number;
  gridStartHour: number;
  hours: number[];
  showNowLine: boolean;
  todayOffsetHours: number;
  onSelectDay: (dayKey: string) => void;
}) {
  const palette = useBrand();
  const { laneAssignments, laneCount } = buildLaneLayout(rows);
  const dayLoadHours = getDurationHours(rows);
  const laneWidth = laneCount > 1 ? (DAY_COLUMN_WIDTH - 28) / laneCount : DAY_COLUMN_WIDTH - 28;

  return (
    <View key={dayKey} style={{ width: DAY_COLUMN_WIDTH, marginRight: 12 }}>
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
                color: selected ? (palette.surface as string) : (palette.text as string),
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
          backgroundColor: selected ? (palette.surface as string) : (palette.appBg as string),
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

        {dayKey === todayKey && showNowLine ? (
          <View
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              top: (todayOffsetHours - gridStartHour) * HOUR_ROW_HEIGHT,
              height: 2,
              borderRadius: 999,
              backgroundColor: palette.primary as string,
            }}
          />
        ) : null}

        {rows.map((row) => {
          const lane = laneAssignments.get(row.lessonId) ?? 0;
          const dayStart = dayKeyToTimestamp(dayKey);
          const startHourOffset = (row.startTime - dayStart) / 3_600_000 - gridStartHour;
          const durationHours = Math.max(0.75, (row.endTime - row.startTime) / 3_600_000);
          const swatches = palette.calendar.eventSwatches;
          const swatch = swatches[hashSport(row.sport) % Math.max(swatches.length, 1)] ?? undefined;
          const accent = (swatch?.background as string) ?? (palette.primary as string);
          const top = Math.max(8, startHourOffset * HOUR_ROW_HEIGHT + 8);
          const height = Math.max(58, durationHours * HOUR_ROW_HEIGHT - 10);

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
                {formatLessonTimeRange(row, locale)}
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
                  : (row.instructorName ?? "Unassigned instructor")}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
