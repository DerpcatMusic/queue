import { FlashList } from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { useTopSheetContentInsets } from "@/components/layout/use-top-sheet-content-insets";
import { LoadingScreen } from "@/components/loading-screen";
import { ActionButton } from "@/components/ui/action-button";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitChip } from "@/components/ui/kit/kit-chip";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { formatTime } from "@/lib/jobs-utils";
import { type TimelineListItem, useCalendarTabController } from "./use-calendar-tab-controller";

// ─── Constants ───────────────────────────────────────────────────────────────

const RAIL_LEFT = 24;
const RAIL_DOT_DAY = 10;
const RAIL_DOT_LESSON = 6;
// ─── Date helpers ────────────────────────────────────────────────────────────

function toDayKey(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayKeyToTimestamp(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getTime();
}

// Format: "January 15" (month + day number)
function formatDayHeading(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
  });
}

// Format: "Monday"
function formatDaySubtitle(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "long",
  });
}

function formatMonthYear(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function formatSelectedDayLabel(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function hashSport(sport: string) {
  let h = 0;
  for (let i = 0; i < sport.length; i++) {
    h = sport.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CalendarTabScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { safeBottom } = useAppInsets();
  const { isDesktopWeb } = useLayoutBreakpoint();
  const { contentContainerStyle: sheetContentInsets } = useTopSheetContentInsets({
    topSpacing: BrandSpacing.md,
    bottomSpacing: BrandSpacing.xl,
    horizontalPadding: BrandSpacing.lg,
  });
  const todayKey = useMemo(() => toDayKey(Date.now()), []);
  const {
    selectedDay,
    listRef,
    listItems,
    initialScrollIndex,
    lessonCountByDay,
    viewabilityConfig,
    onViewableItemsChanged,
    handleTimelineScrollBegin,
    handleDayPress,
    handleTodayPress,
    openMonthPicker,
    overrideItemLayout,
    selectedDayTimestamp,
    isLoading,
    canShowGoogleAgenda,
    visibilityFilters,
    toggleVisibilityFilter,
  } = useCalendarTabController();
  const [showCalendarFilters, setShowCalendarFilters] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => new Date(selectedDayTimestamp));
  const selectedLessonCount = lessonCountByDay.get(selectedDay) ?? 0;

  // ─── Render items ───────────────────────────────────────────────────────────

  const railColor = (palette.border as string) ?? "#E5E5E5";

  useEffect(() => {
    setPickerDate(new Date(selectedDayTimestamp));
  }, [selectedDayTimestamp]);

  const handleDoneWithDatePicker = useCallback(() => {
    setShowDatePicker(false);
    const nextDayKey = toDayKey(pickerDate.getTime());
    if (nextDayKey !== selectedDay) {
      handleDayPress(nextDayKey);
    }
  }, [handleDayPress, pickerDate, selectedDay]);

  const calendarSheetConfig = useMemo(
    () => ({
      content: (
        <View style={{ gap: BrandSpacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  ...BrandType.heading,
                  fontSize: 30,
                  lineHeight: 34,
                  color: palette.onPrimary as string,
                }}
              >
                {formatMonthYear(selectedDay, i18n.language)}
              </Text>
              <Text
                style={{
                  ...BrandType.caption,
                  color: palette.onPrimary as string,
                  opacity: 0.72,
                }}
              >
                {formatSelectedDayLabel(selectedDay, i18n.language)}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: BrandSpacing.sm }}>
              {selectedDay !== todayKey ? (
                <ActionButton
                  label={t("common.today")}
                  onPress={handleTodayPress}
                  palette={palette}
                  tone="secondary"
                />
              ) : null}
              <ActionButton
                label={showDatePicker ? t("common.done") : t("calendarTab.header.chooseDate")}
                onPress={() => {
                  if (showDatePicker) {
                    handleDoneWithDatePicker();
                    return;
                  }
                  setShowDatePicker(true);
                  openMonthPicker();
                }}
                palette={palette}
                tone="secondary"
              />
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: BrandSpacing.md,
              borderTopWidth: 1,
              borderColor: palette.border as string,
              paddingTop: BrandSpacing.md,
            }}
          >
            <Text style={{ ...BrandType.bodyStrong, color: palette.text as string }}>
              {formatSelectedDayLabel(selectedDay, i18n.language)}
            </Text>
            <View style={styles.headerControlsRow}>
              {canShowGoogleAgenda ? (
                <IconButton
                  accessibilityLabel={t("calendarTab.filters.button")}
                  onPress={() => setShowCalendarFilters((current) => !current)}
                  tone={showCalendarFilters ? "primary" : "secondary"}
                  size={42}
                  icon={
                    <IconSymbol
                      name="line.3.horizontal.decrease.circle"
                      size={18}
                      color={
                        showCalendarFilters
                          ? (palette.onPrimary as string)
                          : (palette.textMuted as string)
                      }
                    />
                  }
                />
              ) : null}
              <View
                style={{
                  borderRadius: BrandRadius.pill,
                  borderCurve: "continuous",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor:
                    selectedLessonCount > 0
                      ? (palette.primarySubtle as string)
                      : (palette.surface as string),
                }}
              >
                <Text
                  style={{
                    ...BrandType.micro,
                    fontVariant: ["tabular-nums"],
                    color:
                      selectedLessonCount > 0
                        ? (palette.primary as string)
                        : (palette.textMuted as string),
                  }}
                >
                  {selectedLessonCount === 1
                    ? t("calendarTab.agenda.oneEvent")
                    : t("calendarTab.agenda.eventCount", { count: selectedLessonCount })}
                </Text>
              </View>
            </View>
          </View>
          {canShowGoogleAgenda && showCalendarFilters ? (
            <View style={styles.visibilitySection}>
              <Text style={{ ...BrandType.micro, color: palette.textMuted as string }}>
                {t("calendarTab.filters.show")}
              </Text>
              <View style={styles.visibilityChipRow}>
                <KitChip
                  label={t("calendarTab.filters.lessons")}
                  selected={visibilityFilters.queueLessons}
                  onPress={() => toggleVisibilityFilter("queueLessons")}
                />
                <KitChip
                  label={t("calendarTab.filters.timed")}
                  selected={visibilityFilters.timedCalendarEvents}
                  onPress={() => toggleVisibilityFilter("timedCalendarEvents")}
                />
                <KitChip
                  label={t("calendarTab.filters.allDay")}
                  selected={visibilityFilters.allDayCalendarEvents}
                  onPress={() => toggleVisibilityFilter("allDayCalendarEvents")}
                />
              </View>
            </View>
          ) : null}
        </View>
      ),
      padding: {
        vertical: BrandSpacing.lg,
        horizontal: BrandSpacing.xl,
      },
      steps: [0.28],
      initialStep: 0,
      backgroundColor: palette.primary as string,
      topInsetColor: palette.primary as string,
    }),
    [
      handleDoneWithDatePicker,
      handleTodayPress,
      i18n.language,
      openMonthPicker,
      palette,
      selectedDay,
      selectedLessonCount,
      showDatePicker,
      showCalendarFilters,
      t,
      toggleVisibilityFilter,
      todayKey,
      visibilityFilters.allDayCalendarEvents,
      visibilityFilters.queueLessons,
      visibilityFilters.timedCalendarEvents,
      canShowGoogleAgenda,
    ],
  );

  useGlobalTopSheet("calendar", calendarSheetConfig);

  const agendaHeaderComponent = useMemo(
    () => (
      <View
        style={{
          gap: BrandSpacing.xs,
          paddingTop: BrandSpacing.xs,
          paddingBottom: BrandSpacing.xs,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: BrandSpacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ ...BrandType.bodyStrong, color: palette.text as string }}>
              {t("calendarTab.agenda.title")}
            </Text>
          </View>
          <View
            style={{
              borderRadius: BrandRadius.pill,
              borderCurve: "continuous",
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor:
                selectedLessonCount > 0
                  ? (palette.primarySubtle as string)
                  : (palette.surface as string),
            }}
          >
            <Text
              style={{
                ...BrandType.micro,
                color:
                  selectedLessonCount > 0
                    ? (palette.primary as string)
                    : (palette.textMuted as string),
                fontVariant: ["tabular-nums"],
              }}
            >
              {selectedLessonCount === 1
                ? t("calendarTab.agenda.oneEvent")
                : t("calendarTab.agenda.eventCount", {
                    count: selectedLessonCount,
                  })}
            </Text>
          </View>
        </View>
      </View>
    ),
    [palette, selectedLessonCount, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: TimelineListItem }) => {
      if (item.kind === "dayHeader") {
        const isToday = item.dayKey === todayKey;
        const dotColor = isToday ? (palette.primary as string) : (palette.textMuted as string);

        return (
          <View style={styles.timelineRow}>
            <View style={styles.railGutter}>
              <View style={[styles.railLine, { backgroundColor: railColor }]} />
              <View
                style={[
                  styles.railDotDay,
                  { backgroundColor: dotColor },
                  isToday && {
                    backgroundColor: palette.primary as string,
                    width: RAIL_DOT_DAY + 2,
                    height: RAIL_DOT_DAY + 2,
                    borderRadius: (RAIL_DOT_DAY + 2) / 2,
                  },
                ]}
              />
            </View>
            <View style={styles.dayHeaderContent}>
              <Text style={[styles.dayHeading, { color: palette.text as string }]}>
                {formatDayHeading(item.dayKey, i18n.language)}
              </Text>
              <Text style={[styles.daySubtitle, { color: palette.textMuted as string }]}>
                {formatDaySubtitle(item.dayKey, i18n.language)}
              </Text>
            </View>
          </View>
        );
      }

      if (item.kind === "empty") {
        return (
          <View style={styles.timelineRow}>
            <View style={styles.railGutter}>
              <View style={[styles.railLine, { backgroundColor: railColor }]} />
            </View>
            <View style={[styles.emptyStateCard, { backgroundColor: palette.surface as string }]}>
              <Text style={[styles.emptyStateTitle, { color: palette.textMuted as string }]}>
                {t("calendarTab.timeline.noLessons")}
              </Text>
            </View>
          </View>
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
          ? {
              fg: palette.success as string,
              bg: palette.successSubtle as string,
            }
          : row.lifecycle === "upcoming"
            ? {
                fg: palette.primary as string,
                bg: palette.primarySubtle as string,
              }
            : row.lifecycle === "cancelled"
              ? {
                  fg: palette.danger as string,
                  bg: palette.dangerSubtle as string,
                }
              : {
                  fg: palette.textMuted as string,
                  bg: palette.surfaceAlt as string,
                };

      return (
        <View style={styles.timelineRow}>
          <View style={styles.railGutter}>
            <View style={[styles.railLine, { backgroundColor: railColor }]} />
            <View style={[styles.railDotLesson, { backgroundColor: accent }]} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("calendarTab.lessonRowAccessibility", {
              sport: row.sport,
              start: formatTime(row.startTime, i18n.language),
              end: formatTime(row.endTime, i18n.language),
            })}
            accessibilityHint={t("calendarTab.lessonRowAccessibilityHint")}
            onPress={() => handleDayPress(item.dayKey)}
            style={[styles.lessonCard, { backgroundColor: palette.surfaceElevated as string }]}
          >
            <View style={styles.lessonRowCompact}>
              <View style={styles.lessonTimeColumn}>
                <Text style={[styles.lessonTimePrimary, { color: palette.text as string }]}>
                  {timeStartLabel}
                </Text>
                {timeEndLabel ? (
                  <Text
                    style={[styles.lessonTimeSecondary, { color: palette.textMuted as string }]}
                  >
                    {timeEndLabel}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.lessonAccent, { backgroundColor: accent }]} />
              <View style={styles.lessonContent}>
                <View style={styles.lessonTopRow}>
                  <Text
                    style={[styles.lessonTitle, { color: palette.text as string }]}
                    numberOfLines={1}
                  >
                    {row.sport}
                  </Text>
                  <View style={[styles.lifecycleBadge, { backgroundColor: lifecycleTone.bg }]}>
                    <Text style={[styles.lifecycleBadgeText, { color: lifecycleTone.fg }]}>
                      {lifecycleLabel}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[styles.lessonMeta, { color: palette.textMuted as string }]}
                  numberOfLines={1}
                >
                  {counterpart}
                </Text>
                {row.source === "google" ? (
                  <Text style={[styles.lessonSource, { color: palette.textMicro as string }]}>
                    {t("calendarTab.timeline.googleBadge")}
                  </Text>
                ) : null}
              </View>
            </View>
          </Pressable>
        </View>
      );
    },
    [handleDayPress, i18n.language, palette, railColor, t, todayKey],
  );

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <LoadingScreen label={t("calendarTab.loading")} />;
  }

  if (isDesktopWeb) {
    return (
      <TabScreenRoot mode="static" style={{ backgroundColor: palette.surface as string }}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text
            style={{
              ...BrandType.bodyStrong,
              color: palette.textMuted as string,
            }}
          >
            {t("calendarTab.desktopSoon")}
          </Text>
        </View>
      </TabScreenRoot>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <TabScreenRoot mode="static" topInsetTone="sheet" style={{ backgroundColor: palette.appBg }}>
      {/* Sheet content (month heading, week rail, etc.) rendered by global TopSheet via setTabSheetRender */}
      <View style={[styles.timelineViewport, { backgroundColor: palette.appBg as string }]}>
        <FlashList
          ref={listRef}
          data={listItems}
          initialScrollIndex={initialScrollIndex}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          getItemType={(item) => item.kind}
          drawDistance={600}
          overrideItemLayout={overrideItemLayout}
          removeClippedSubviews
          onScrollBeginDrag={handleTimelineScrollBegin}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          scrollIndicatorInsets={{ bottom: safeBottom + BrandSpacing.md }}
          contentContainerStyle={[styles.timelineContent, sheetContentInsets]}
          ListHeaderComponent={agendaHeaderComponent}
        />
        <View
          pointerEvents="none"
          style={[styles.timelineBottomMask, { backgroundColor: palette.appBg as string }]}
        />
      </View>
    </TabScreenRoot>
  );
}

// ─── Timeline Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  timelineViewport: {
    flex: 1,
    position: "relative",
  },
  timelineContent: {
    paddingTop: 4,
  },
  timelineBottomMask: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.96,
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  visibilitySection: {
    gap: 8,
  },
  visibilityChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  headerControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // ── Rail ─────────────────────────────────────────
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingLeft: 8,
  },
  railGutter: {
    width: RAIL_LEFT * 2,
    alignItems: "center",
    position: "relative",
  },
  railLine: {
    position: "absolute",
    width: 2,
    top: 0,
    bottom: 0,
    left: RAIL_LEFT - 1,
    borderRadius: 1,
    opacity: 0.3,
  },
  railDotDay: {
    width: RAIL_DOT_DAY,
    height: RAIL_DOT_DAY,
    borderRadius: RAIL_DOT_DAY / 2,
    marginTop: 18,
    zIndex: 1,
  },
  railDotLesson: {
    width: RAIL_DOT_LESSON,
    height: RAIL_DOT_LESSON,
    borderRadius: RAIL_DOT_LESSON / 2,
    marginTop: 20,
    zIndex: 1,
  },

  // ── Day header (month+number first, weekday underneath) ──
  dayHeaderContent: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 4,
    paddingRight: 16,
  },
  dayHeading: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 22,
  },
  daySubtitle: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 1,
  },

  // ── Lesson card ──────────────────────────────────
  lessonCard: {
    flex: 1,
    marginRight: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderCurve: "continuous",
  },
  lessonRowCompact: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  lessonTimeColumn: {
    width: 64,
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 1,
  },
  lessonTimePrimary: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16,
  },
  lessonTimeSecondary: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 14,
  },
  lessonAccent: {
    width: 3,
    borderRadius: 999,
    borderCurve: "continuous",
  },
  lessonContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  lessonTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  lifecycleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderCurve: "continuous",
  },
  lifecycleBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  lessonTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 19,
  },
  lessonMeta: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  lessonSource: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 14,
  },

  // ── Empty ────────────────────────────────────────
  emptyContent: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 16,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "400",
  },
  emptyStateCard: {
    flex: 1,
    marginRight: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    justifyContent: "center",
  },
  emptyStateTitle: {
    fontSize: 13,
    fontWeight: "500",
  },
});
