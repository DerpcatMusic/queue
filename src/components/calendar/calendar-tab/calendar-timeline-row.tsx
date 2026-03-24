import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useBrand } from "@/hooks/use-brand";
import { formatTime } from "@/lib/jobs-utils";
import type { TimelineListItem } from "../calendar-controller-helpers";
import {
  calendarTimelineStyles,
  formatDayHeading,
  formatDaySubtitle,
  hashSport,
} from "./calendar-date-utils";

type CalendarTimelineRowProps = {
  item: TimelineListItem;
  todayKey: string;
};

function CalendarTimelineRow({ item, todayKey }: CalendarTimelineRowProps) {
  const { t, i18n } = useTranslation();
  const palette = useBrand();

  if (item.kind === "dayHeader") {
    const isToday = item.dayKey === todayKey;

    return (
      <Animated.View style={calendarTimelineStyles.timelineRow}>
        <View style={calendarTimelineStyles.dayHeaderContent}>
          <Text
            style={[
              calendarTimelineStyles.dayHeading,
              { color: isToday ? (palette.primary as string) : (palette.text as string) },
            ]}
          >
            {formatDayHeading(item.dayKey, i18n.language)}
          </Text>
          <Text
            style={[calendarTimelineStyles.daySubtitle, { color: palette.textMuted as string }]}
          >
            {formatDaySubtitle(item.dayKey, i18n.language)}
          </Text>
        </View>
      </Animated.View>
    );
  }

  if (item.kind === "empty") {
    return (
      <Animated.View style={calendarTimelineStyles.timelineRow}>
        <View
          style={[
            calendarTimelineStyles.emptyStateCard,
            { backgroundColor: palette.surface as string },
          ]}
        >
          <Text
            style={[calendarTimelineStyles.emptyStateTitle, { color: palette.textMuted as string }]}
          >
            {t("calendarTab.timeline.noLessons")}
          </Text>
        </View>
      </Animated.View>
    );
  }

  const row = item.lesson;
  const swatches = palette.calendar.eventSwatches;
  const swatch = swatches[hashSport(row.sport) % Math.max(swatches.length, 1)] ?? undefined;
  const accent = (swatch?.background as string) ?? (palette.primary as string);
  const counterpart =
    row.source === "google"
      ? (row.location ?? t("calendarTab.googleCalendar"))
      : row.roleView === "instructor"
        ? row.studioName
        : (row.instructorName ?? t("calendarTab.unassignedInstructor"));
  const timeStartLabel = row.isAllDay
    ? t("calendarTab.timeline.allDay")
    : formatTime(row.startTime, i18n.language);
  const timeEndLabel = row.isAllDay ? null : formatTime(row.endTime, i18n.language);
  const lifecycleLabel =
    row.lifecycle === "live"
      ? t("calendarTab.timeline.lifecycle.live")
      : row.lifecycle === "upcoming"
        ? t("calendarTab.timeline.lifecycle.upcoming")
        : row.lifecycle === "cancelled"
          ? t("calendarTab.timeline.lifecycle.cancelled")
          : t("calendarTab.timeline.lifecycle.past");
  const lifecycleTone =
    row.lifecycle === "live"
      ? { fg: palette.success as string, bg: palette.successSubtle as string }
      : row.lifecycle === "upcoming"
        ? { fg: palette.primary as string, bg: palette.primarySubtle as string }
        : row.lifecycle === "cancelled"
          ? { fg: palette.danger as string, bg: palette.dangerSubtle as string }
          : { fg: palette.textMuted as string, bg: palette.surfaceAlt as string };

  return (
    <Animated.View  style={calendarTimelineStyles.timelineRow}>
      <View
        style={[
          calendarTimelineStyles.lessonCard,
          { backgroundColor: palette.surfaceElevated as string },
        ]}
      >
        <View style={calendarTimelineStyles.lessonRowCompact}>
          <View style={calendarTimelineStyles.lessonTimeColumn}>
            <Text
              style={[calendarTimelineStyles.lessonTimePrimary, { color: palette.text as string }]}
            >
              {timeStartLabel}
            </Text>
            {timeEndLabel ? (
              <Text
                style={[
                  calendarTimelineStyles.lessonTimeSecondary,
                  { color: palette.textMuted as string },
                ]}
              >
                {timeEndLabel}
              </Text>
            ) : null}
          </View>
          <View style={[calendarTimelineStyles.lessonAccent, { backgroundColor: accent }]} />
          <View style={calendarTimelineStyles.lessonContent}>
            <View style={calendarTimelineStyles.lessonTopRow}>
              <Text
                style={[calendarTimelineStyles.lessonTitle, { color: palette.text as string }]}
                numberOfLines={1}
              >
                {row.sport}
              </Text>
              {row.lifecycle !== "past" ? (
                <View
                  style={[
                    calendarTimelineStyles.lifecycleBadge,
                    { backgroundColor: lifecycleTone.bg },
                  ]}
                >
                  <Text
                    style={[calendarTimelineStyles.lifecycleBadgeText, { color: lifecycleTone.fg }]}
                  >
                    {lifecycleLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[calendarTimelineStyles.lessonMeta, { color: palette.textMuted as string }]}
              numberOfLines={1}
            >
              {counterpart}
            </Text>
            {row.source === "google" ? (
              <Text
                style={[
                  calendarTimelineStyles.lessonSource,
                  { color: palette.textMicro as string },
                ]}
              >
                {t("calendarTab.timeline.googleBadge")}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export default memo(CalendarTimelineRow);
