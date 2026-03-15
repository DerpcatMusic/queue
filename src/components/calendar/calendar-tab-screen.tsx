import DateTimePicker from "@react-native-community/datetimepicker";
import { FlashList } from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  I18nManager,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { TopSheet } from "@/components/layout/top-sheet";
import { LoadingScreen } from "@/components/loading-screen";
import { ActionButton } from "@/components/ui/action-button";
import { AppSymbol } from "@/components/ui/app-symbol";
import { KitSegmentedToggle } from "@/components/ui/kit";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { formatTime } from "@/lib/jobs-utils";
import {
  type CalendarViewMode,
  type TimelineListItem,
  useCalendarTabController,
} from "./use-calendar-tab-controller";

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

const RAIL_LEFT = 24;
const RAIL_DOT_DAY = 10;
const RAIL_DOT_LESSON = 6;
const SWIPE_THRESHOLD = 50;
const WEEK_RAIL_SPRING = {
  damping: 24,
  stiffness: 220,
  mass: 0.7,
  overshootClamping: true,
};

// ─── Date helpers ────────────────────────────────────────────────────────────

function toDayKey(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayKeyToTimestamp(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getTime();
}

function addDays(dayKey: string, delta: number) {
  return toDayKey(dayKeyToTimestamp(dayKey) + delta * DAY_MS);
}

function getWeekStart(dayKey: string) {
  const ts = dayKeyToTimestamp(dayKey);
  const d = new Date(ts);
  const dow = d.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return toDayKey(ts + mondayOffset * DAY_MS);
}

function getWeekDays(weekStartKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartKey, i));
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

function formatWeekdayLetter(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey))
    .toLocaleDateString(locale, { weekday: "narrow" })
    .charAt(0)
    .toUpperCase();
}

function formatDayNumber(dayKey: string) {
  return String(new Date(dayKeyToTimestamp(dayKey)).getDate());
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

// ─── WeekStrip (live-sliding, dynamic height) ────────────────────────────────

function shiftDayKey(dayKey: string, deltaDays: number) {
  return toDayKey(dayKeyToTimestamp(dayKey) + deltaDays * DAY_MS);
}

function WeekRail({
  locale,
  selectedDay,
  todayKey,
  weekDays,
  lessonCountByDay,
  onSelectDay,
  onChangeWeek,
}: {
  locale: string;
  selectedDay: string;
  todayKey: string;
  weekDays: string[];
  lessonCountByDay: Map<string, number>;
  onSelectDay: (dayKey: string) => void;
  onChangeWeek: (deltaWeeks: number) => void;
}) {
  const palette = useBrand();
  const translateX = useSharedValue(-1);
  const railWidth = useSharedValue(1);
  const isRtl = I18nManager.isRTL;
  const previousWeekDays = useMemo(
    () => weekDays.map((dayKey) => shiftDayKey(dayKey, -7)),
    [weekDays],
  );
  const nextWeekDays = useMemo(() => weekDays.map((dayKey) => shiftDayKey(dayKey, 7)), [weekDays]);

  const handleSwipeWeek = useCallback(
    (deltaWeeks: number) => {
      triggerSelectionHaptic();
      onChangeWeek(deltaWeeks);
    },
    [onChangeWeek],
  );
  const handleSelectDay = useCallback(
    (dayKey: string) => {
      triggerSelectionHaptic();
      onSelectDay(dayKey);
    },
    [onSelectDay],
  );

  const onRailLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextWidth = Math.max(1, event.nativeEvent.layout.width);
      railWidth.value = nextWidth;
      translateX.value = -nextWidth;
    },
    [railWidth, translateX],
  );

  const railGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-12, 12])
        .onUpdate((event) => {
          const width = railWidth.value || 1;
          const nextX = -width + event.translationX;
          translateX.value = Math.max(-width * 2, Math.min(0, nextX));
        })
        .onEnd((event) => {
          const width = railWidth.value || 1;
          const shouldAdvance =
            event.translationX <= -Math.max(SWIPE_THRESHOLD, width * 0.2) ||
            event.velocityX <= -650;
          const shouldRewind =
            event.translationX >= Math.max(SWIPE_THRESHOLD, width * 0.2) || event.velocityX >= 650;

          if (shouldAdvance) {
            translateX.value = withSpring(-width * 2, WEEK_RAIL_SPRING, (finished) => {
              if (!finished) return;
              translateX.value = -width;
              runOnJS(handleSwipeWeek)(1);
            });
            return;
          }

          if (shouldRewind) {
            translateX.value = withSpring(0, WEEK_RAIL_SPRING, (finished) => {
              if (!finished) return;
              translateX.value = -width;
              runOnJS(handleSwipeWeek)(-1);
            });
            return;
          }

          translateX.value = withSpring(-width, WEEK_RAIL_SPRING);
        }),
    [handleSwipeWeek, railWidth, translateX],
  );

  const railTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const renderWeekPage = useCallback(
    (days: string[], pageKey: string) => (
      <View
        key={pageKey}
        style={{
          flex: 1,
          flexDirection: isRtl ? "row-reverse" : "row",
          gap: 4,
        }}
      >
        {days.map((dayKey) => {
          const selected = dayKey === selectedDay;
          const lessonCount = lessonCountByDay.get(dayKey) ?? 0;
          const today = dayKey === todayKey;

          return (
            <View key={dayKey} style={{ flex: 1 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={formatSelectedDayLabel(dayKey, locale)}
                onPress={() => handleSelectDay(dayKey)}
                style={{ flex: 1 }}
              >
                <View
                  style={{
                    minHeight: 76,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    paddingHorizontal: 4,
                  }}
                >
                  {today && !selected ? (
                    <View
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: palette.text as string,
                        position: "absolute",
                        top: 6,
                      }}
                    />
                  ) : null}
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: today ? (palette.text as string) : (palette.textMuted as string),
                    }}
                  >
                    {formatWeekdayLetter(dayKey, locale)}
                  </Text>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 999,
                      borderCurve: "continuous",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: selected ? (palette.text as string) : "transparent",
                      borderWidth: today && !selected ? 1 : 0,
                      borderColor: today ? (palette.borderStrong as string) : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        ...BrandType.bodyStrong,
                        fontSize: 19,
                        lineHeight: 22,
                        fontVariant: ["tabular-nums"],
                        includeFontPadding: false,
                        color: selected ? (palette.surface as string) : (palette.text as string),
                      }}
                    >
                      {formatDayNumber(dayKey)}
                    </Text>
                  </View>
                  <View
                    style={{
                      minHeight: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    {lessonCount > 0 ? (
                      <>
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: selected
                              ? (palette.surface as string)
                              : (palette.primary as string),
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: selected
                              ? (palette.surface as string)
                              : (palette.textMuted as string),
                          }}
                        >
                          {lessonCount}
                        </Text>
                      </>
                    ) : (
                      <View style={{ height: 12 }} />
                    )}
                  </View>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    ),
    [handleSelectDay, lessonCountByDay, locale, palette, selectedDay, todayKey],
  );

  return (
    <GestureDetector gesture={railGesture}>
      <View onLayout={onRailLayout} style={{ overflow: "hidden" }}>
        <Animated.View
          style={[
            {
              width: "300%",
              flexDirection: isRtl ? "row-reverse" : "row",
            },
            railTrackStyle,
          ]}
        >
          {renderWeekPage(previousWeekDays, "previous")}
          {renderWeekPage(weekDays, "current")}
          {renderWeekPage(nextWeekDays, "next")}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CalendarTabScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { safeBottom } = useAppInsets();
  const { isDesktopWeb } = useLayoutBreakpoint();
  const todayKey = useMemo(() => toDayKey(Date.now()), []);
  const {
    selectedDay,
    listRef,
    listItems,
    initialScrollIndex,
    lessonCountByDay,
    canShowGoogleAgenda,
    viewMode,
    setViewMode,
    viewabilityConfig,
    onViewableItemsChanged,
    handleTimelineScrollBegin,
    handleDayPress,
    handleWeekChange,
    handleTodayPress,
    openMonthPicker,
    overrideItemLayout,
    selectedDayTimestamp,
    isLoading,
  } = useCalendarTabController();
  const selectedWeekDays = useMemo(() => getWeekDays(getWeekStart(selectedDay)), [selectedDay]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => new Date(selectedDayTimestamp));
  const selectedLessonCount = lessonCountByDay.get(selectedDay) ?? 0;

  // ─── Render items ───────────────────────────────────────────────────────────

  const railColor = (palette.border as string) ?? "#E5E5E5";

  useEffect(() => {
    setPickerDate(new Date(selectedDayTimestamp));
  }, [selectedDayTimestamp]);

  const handleDateChange = useCallback(
    (_event: unknown, nextDate?: Date) => {
      if (!nextDate) {
        if (Platform.OS !== "ios") {
          setShowDatePicker(false);
        }
        return;
      }

      if (Platform.OS === "ios") {
        setPickerDate(nextDate);
        return;
      }

      setShowDatePicker(false);
      handleDayPress(toDayKey(nextDate.getTime()));
    },
    [handleDayPress],
  );

  const handleDoneWithDatePicker = useCallback(() => {
    setShowDatePicker(false);
    const nextDayKey = toDayKey(pickerDate.getTime());
    if (nextDayKey !== selectedDay) {
      handleDayPress(nextDayKey);
    }
  }, [handleDayPress, pickerDate, selectedDay]);

  const agendaHeaderComponent = useMemo(
    () => (
      <View
        style={{
          gap: BrandSpacing.sm,
          paddingTop: BrandSpacing.sm,
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
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ ...BrandType.title, color: palette.text as string }}>
              {t("calendarTab.agenda.title")}
            </Text>
            <Text style={{ ...BrandType.micro, color: palette.textMuted as string }}>
              {formatSelectedDayLabel(selectedDay, i18n.language)}
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
                ? t("calendarTab.agenda.oneSession")
                : t("calendarTab.agenda.sessionCount", {
                    count: selectedLessonCount,
                  })}
            </Text>
          </View>
        </View>
      </View>
    ),
    [i18n.language, palette, selectedDay, selectedLessonCount, t],
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
              <AppSymbol
                name="calendar.badge.exclamationmark"
                size={28}
                tintColor={palette.textMuted as string}
              />
              <Text style={[styles.emptyStateTitle, { color: palette.textMuted as string }]}>
                {t("calendarTab.timeline.noLessons")}
              </Text>
              <Text style={[styles.emptyStateBody, { color: palette.textMuted as string }]}>
                {t("calendarTab.timeline.noLessonsHint")}
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
      const timeLabel = row.isAllDay
        ? t("calendarTab.timeline.allDay")
        : `${formatTime(row.startTime, i18n.language)} – ${formatTime(row.endTime, i18n.language)}`;

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
            <View style={styles.lessonContent}>
              <View style={styles.lessonTopRow}>
                <Text style={[styles.lessonTime, { color: palette.textMuted as string }]}>
                  {timeLabel}
                </Text>
                <View style={styles.lessonBadgeRow}>
                  {row.source === "google" ? (
                    <View
                      style={[
                        styles.sourceBadge,
                        { backgroundColor: palette.primarySubtle as string },
                      ]}
                    >
                      <Text style={[styles.sourceBadgeText, { color: palette.primary as string }]}>
                        {t("calendarTab.timeline.googleBadge")}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.lifecycleBadge, { backgroundColor: lifecycleTone.bg }]}>
                    <Text style={[styles.lifecycleBadgeText, { color: lifecycleTone.fg }]}>
                      {lifecycleLabel}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.lessonTitle, { color: palette.text as string }]}>
                {row.sport}
              </Text>
              <Text style={[styles.lessonMeta, { color: palette.textMuted as string }]}>
                {counterpart}
              </Text>
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
      <TopSheet
        topInsetColor={palette.primary}
        style={{
          gap: BrandSpacing.md,
          marginBottom: BrandSpacing.md,
        }}
        padding={{
          vertical: BrandSpacing.lg,
          horizontal: BrandSpacing.lg,
        }}
      >
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
                  color: palette.text as string,
                }}
              >
                {formatMonthYear(selectedDay, i18n.language)}
              </Text>
              <Text
                style={{
                  ...BrandType.caption,
                  color: palette.textMuted as string,
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
                  ? t("calendarTab.agenda.oneSession")
                  : t("calendarTab.agenda.sessionCount", {
                      count: selectedLessonCount,
                    })}
              </Text>
            </View>
          </View>
        </View>

        <WeekRail
          locale={i18n.language}
          selectedDay={selectedDay}
          todayKey={todayKey}
          weekDays={selectedWeekDays}
          lessonCountByDay={lessonCountByDay}
          onSelectDay={handleDayPress}
          onChangeWeek={handleWeekChange}
        />

        {canShowGoogleAgenda ? (
          <KitSegmentedToggle<CalendarViewMode>
            value={viewMode}
            onChange={setViewMode}
            options={[
              {
                value: "jobs_only",
                label: t("calendarTab.filters.jobsOnly"),
              },
              {
                value: "jobs_and_google",
                label: t("calendarTab.filters.jobsAndGoogle"),
              },
            ]}
          />
        ) : null}

        {showDatePicker ? (
          <View
            style={{
              borderRadius: 24,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: palette.surface as string,
            }}
          >
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={handleDateChange}
            />
            {Platform.OS === "ios" ? (
              <View
                style={{
                  alignItems: "flex-end",
                  paddingHorizontal: 14,
                  paddingBottom: 14,
                }}
              >
                <ActionButton
                  label={t("common.done")}
                  onPress={handleDoneWithDatePicker}
                  palette={palette}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </TopSheet>

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
          contentContainerStyle={[
            styles.timelineContent,
            {
              paddingHorizontal: BrandSpacing.lg,
              paddingBottom: safeBottom + BrandSpacing.xl,
            },
          ]}
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
    paddingTop: 12,
    paddingBottom: 6,
    paddingRight: 16,
  },
  dayHeading: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 26,
  },
  daySubtitle: {
    fontSize: 13,
    fontWeight: "400",
    marginTop: 1,
  },

  // ── Lesson card ──────────────────────────────────
  lessonCard: {
    flex: 1,
    marginRight: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderCurve: "continuous",
  },
  lessonContent: {
    gap: 3,
  },
  lessonTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  lessonTime: {
    fontSize: 13,
    fontWeight: "500",
  },
  lessonBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lifecycleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderCurve: "continuous",
  },
  lifecycleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderCurve: "continuous",
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 21,
  },
  lessonMeta: {
    fontSize: 14,
    fontWeight: "400",
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
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 20,
    borderCurve: "continuous",
    alignItems: "center",
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyStateBody: {
    fontSize: 13,
    fontWeight: "400",
    textAlign: "center",
  },
});
