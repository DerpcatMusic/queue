import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  SectionList,
  type SectionListRenderItemInfo,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeInDown, FadeInUp, runOnJS } from "react-native-reanimated";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { LoadingScreen } from "@/components/loading-screen";
import { AppSymbol } from "@/components/ui/app-symbol";
import { KitButton, KitPressable } from "@/components/ui/kit";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { formatTime } from "@/lib/jobs-utils";
import { CalendarWebBoard } from "./calendar-web-board";
import {
  type AgendaItem,
  type AgendaSection,
  compareDayKey,
  dayKeyToTimestamp,
  type TimelineRow,
  toDayKey,
  useCalendarTabController,
} from "./use-calendar-tab-controller";

const WEEK_SWIPE_THRESHOLD = 42;

function formatMonthLabel(dayKey: string, locale: string) {
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

function formatSectionTitle(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
  });
}

function formatSectionSubtitle(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "long",
  });
}

function formatWeekdayLabel(dayKey: string, locale: string) {
  const label = new Date(dayKeyToTimestamp(dayKey))
    .toLocaleDateString(locale, { weekday: "short" })
    .replace(/\./g, "")
    .replace(/\s+/g, "");
  const glyphs = Array.from(label);
  if (glyphs.length <= 2) {
    return label.toUpperCase();
  }
  return glyphs.slice(0, 2).join("").toUpperCase();
}

function formatDayNumber(dayKey: string) {
  return String(new Date(dayKeyToTimestamp(dayKey)).getDate());
}

function isToday(dayKey: string, todayKey: string) {
  return compareDayKey(dayKey, todayKey) === 0;
}

function hashSport(sport: string) {
  let hash = 0;
  for (let index = 0; index < sport.length; index += 1) {
    hash = sport.charCodeAt(index) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// ─── WeekRail ────────────────────────────────────────────────────────────────

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

  const railGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-12, 12])
        .onEnd((event) => {
          if (event.translationX <= -WEEK_SWIPE_THRESHOLD || event.velocityX <= -650) {
            runOnJS(handleSwipeWeek)(1);
            return;
          }
          if (event.translationX >= WEEK_SWIPE_THRESHOLD || event.velocityX >= 650) {
            runOnJS(handleSwipeWeek)(-1);
          }
        }),
    [handleSwipeWeek],
  );

  return (
    <GestureDetector gesture={railGesture}>
      <View style={{ flexDirection: "row", paddingVertical: 2, gap: 4 }}>
        {weekDays.map((dayKey, index) => {
          const selected = dayKey === selectedDay;
          const lessonCount = lessonCountByDay.get(dayKey) ?? 0;
          const today = isToday(dayKey, todayKey);

          return (
            <Animated.View
              key={dayKey}
              style={{ flex: 1 }}
              entering={FadeInDown.delay(index * 35)
                .duration(300)
                .springify()
                .damping(22)}
            >
              <KitPressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={formatSelectedDayLabel(dayKey, locale)}
                onPress={() => handleSelectDay(dayKey)}
                style={{ flex: 1 }}
              >
                <View
                  style={{
                    minHeight: 72,
                    borderRadius: 12,
                    borderCurve: "continuous",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    paddingHorizontal: 4,
                    backgroundColor: selected
                      ? (palette.text as string)
                      : today
                        ? (palette.surfaceAlt as string)
                        : "transparent",
                  }}
                >
                  {/* Today dot indicator at top */}
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
                      color: selected
                        ? (palette.surface as string)
                        : today
                          ? (palette.text as string)
                          : (palette.textMuted as string),
                    }}
                  >
                    {formatWeekdayLabel(dayKey, locale)}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.heading,
                      fontSize: 20,
                      includeFontPadding: false,
                      color: selected ? (palette.surface as string) : (palette.text as string),
                    }}
                  >
                    {formatDayNumber(dayKey)}
                  </Text>

                  {/* Lesson dot/count */}
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
              </KitPressable>
            </Animated.View>
          );
        })}
      </View>
    </GestureDetector>
  );
}

// ─── AgendaLessonCard ─────────────────────────────────────────────────────────

function AgendaLessonCard({
  locale,
  row,
  index,
}: {
  locale: string;
  row: TimelineRow;
  index: number;
}) {
  const palette = useBrand();
  const swatches = palette.calendar.eventSwatches;
  const swatch = swatches[hashSport(row.sport) % Math.max(swatches.length, 1)] ?? undefined;
  const accent = (swatch?.background as string) ?? (palette.primary as string);
  const counterpart =
    row.roleView === "instructor"
      ? row.studioName
      : (row.instructorName ?? "Unassigned instructor");

  const lifecycleTone =
    row.lifecycle === "live"
      ? { fg: palette.success as string, bg: palette.successSubtle as string, label: "Live now" }
      : row.lifecycle === "upcoming"
        ? { fg: palette.primary as string, bg: palette.primarySubtle as string, label: "Upcoming" }
        : row.lifecycle === "cancelled"
          ? { fg: palette.danger as string, bg: palette.dangerSubtle as string, label: "Cancelled" }
          : { fg: palette.textMuted as string, bg: palette.surfaceAlt as string, label: "Past" };

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index, 8) * 40)
        .duration(350)
        .springify()
        .damping(20)}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          gap: BrandSpacing.md,
          borderRadius: BrandRadius.card,
          borderCurve: "continuous",
          backgroundColor: palette.surfaceAlt as string,
          paddingVertical: BrandSpacing.lg,
          paddingHorizontal: BrandSpacing.md,
        }}
      >
        {/* Timeline accent line */}
        <View
          style={{
            width: 6,
            backgroundColor: accent,
            borderRadius: 999,
          }}
        />

        {/* Content */}
        <View style={{ flex: 1, gap: 4 }}>
          {/* Top row: time + lifecycle */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                ...BrandType.micro,
                color: palette.text as string,
              }}
            >
              {formatTime(row.startTime, locale)} – {formatTime(row.endTime, locale)}
            </Text>

            {/* Simple colored dot for lifecycle status */}
            {row.lifecycle !== "past" && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: lifecycleTone.fg,
                  }}
                />
                <Text
                  style={{
                    ...BrandType.micro,
                    fontSize: 11,
                    textTransform: "uppercase",
                    color: lifecycleTone.fg,
                  }}
                >
                  {lifecycleTone.label}
                </Text>
              </View>
            )}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  ...BrandType.heading,
                  fontSize: 22,
                  lineHeight: 25,
                  color: palette.text as string,
                }}
              >
                {row.sport}
              </Text>
              <Text
                style={{
                  ...BrandType.caption,
                  color: palette.textMuted as string,
                }}
              >
                {counterpart}
              </Text>
            </View>
            <Text style={{ ...BrandType.micro, color: lifecycleTone.fg }}>
              {lifecycleTone.label}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── CalendarTabScreen ────────────────────────────────────────────────────────

export default function CalendarTabScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { tabContentBottom } = useAppInsets();
  const { width } = useWindowDimensions();
  const locale = i18n.language;
  const isDesktopWeb = Platform.OS === "web" && width >= 1180;
  const todayKey = useMemo(() => toDayKey(Date.now()), []);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const {
    selectedDay,
    selectedWeekDays,
    listRef,
    sections,
    lessonCountByDay,
    handleDayPress,
    handleWeekChange,
    handleTodayPress,
    isLoading,
  } = useCalendarTabController({ locale });
  const [pickerDate, setPickerDate] = useState(() => new Date(dayKeyToTimestamp(selectedDay)));

  const selectedLessonCount = lessonCountByDay.get(selectedDay) ?? 0;
  const selectedWeekLessonCount = useMemo(
    () =>
      selectedWeekDays.reduce((total, dayKey) => total + (lessonCountByDay.get(dayKey) ?? 0), 0),
    [lessonCountByDay, selectedWeekDays],
  );

  useEffect(() => {
    setPickerDate(new Date(dayKeyToTimestamp(selectedDay)));
  }, [selectedDay]);

  const handleDateChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      if (!selectedDate) {
        if (Platform.OS !== "ios") {
          setShowDatePicker(false);
        }
        return;
      }

      if (Platform.OS === "ios") {
        setPickerDate(selectedDate);
        return;
      }

      setShowDatePicker(false);
      handleDayPress(toDayKey(selectedDate.getTime()));
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

  const renderItem = useCallback(
    ({ item, index }: SectionListRenderItemInfo<AgendaItem, AgendaSection> & { index: number }) => {
      if (item.kind === "empty") {
        return (
          <Animated.View entering={FadeInUp.duration(300).springify().damping(20)}>
            <View
              style={{
                alignItems: "center",
                gap: BrandSpacing.sm,
                paddingVertical: BrandSpacing.xl,
              }}
            >
              <AppSymbol
                name="calendar.badge.exclamationmark"
                size={32}
                tintColor={palette.textMuted as string}
              />
              <Text
                style={{
                  ...BrandType.bodyStrong,
                  color: palette.textMuted as string,
                  textAlign: "center",
                }}
              >
                {t("calendarTab.timeline.noLessons", { defaultValue: "No lessons" })}
              </Text>
              <Text
                style={{
                  ...BrandType.caption,
                  color: palette.textMuted as string,
                  textAlign: "center",
                }}
              >
                {t("calendarTab.timeline.noLessonsHint", {
                  defaultValue: "Nothing is scheduled for this day yet.",
                })}
              </Text>
            </View>
          </Animated.View>
        );
      }

      return <AgendaLessonCard locale={locale} row={item.lesson} index={index} />;
    },
    [locale, palette, t],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: AgendaSection }) => {
      const lessonCount = lessonCountByDay.get(section.dayKey) ?? 0;
      const hasSessions = lessonCount > 0;

      return (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingTop: BrandSpacing.lg,
            paddingBottom: BrandSpacing.sm,
            backgroundColor: palette.appBg as string,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                ...BrandType.heading,
                fontSize: 19,
                lineHeight: 22,
                color: palette.text as string,
              }}
            >
              {formatSectionTitle(section.dayKey, locale)}
            </Text>
            <Text
              style={{
                ...BrandType.micro,
                marginTop: 2,
                color: palette.textMuted as string,
              }}
            >
              {formatSectionSubtitle(section.dayKey, locale)}
            </Text>
          </View>

          {/* Session count pill */}
          <View
            style={{
              borderRadius: BrandRadius.pill,
              paddingHorizontal: 12,
              paddingVertical: 4,
              backgroundColor: hasSessions
                ? (palette.primarySubtle as string)
                : (palette.surfaceAlt as string),
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: hasSessions ? (palette.primary as string) : (palette.textMuted as string),
                letterSpacing: 0.2,
              }}
            >
              {lessonCount === 0
                ? "Free"
                : lessonCount === 1
                  ? "1 lesson"
                  : `${String(lessonCount)} lessons`}
            </Text>
          </View>
        </View>
      );
    },
    [lessonCountByDay, locale, palette],
  );

  const listHeaderComponent = useMemo(() => <View style={{ height: 8 }} />, []);

  if (isLoading) {
    return <LoadingScreen label={t("calendarTab.loading")} />;
  }

  if (isDesktopWeb) {
    return (
      <TabScreenRoot mode="static" style={{ backgroundColor: palette.surface as string }}>
        <CalendarWebBoard
          locale={locale}
          selectedDay={selectedDay}
          todayKey={todayKey}
          weekDays={selectedWeekDays}
          sections={sections}
          onSelectDay={handleDayPress}
          onChangeWeek={handleWeekChange}
          onTodayPress={handleTodayPress}
          showDatePicker={showDatePicker}
          pickerDate={pickerDate}
          onDateChange={handleDateChange}
          onToggleDatePicker={() => {
            if (showDatePicker) {
              handleDoneWithDatePicker();
              return;
            }
            setShowDatePicker(true);
          }}
          onDismissDatePicker={() => setShowDatePicker(false)}
        />
      </TabScreenRoot>
    );
  }

  return (
    <TabScreenRoot mode="static" style={{ backgroundColor: palette.appBg }}>
      <View
        style={{
          paddingHorizontal: BrandSpacing.lg,
          paddingTop: BrandSpacing.sm,
          paddingBottom: BrandSpacing.md,
          gap: BrandSpacing.md,
          backgroundColor: palette.appBg as string,
        }}
      >
        <View
          style={{
            gap: BrandSpacing.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.primary as string,
                  letterSpacing: 0.9,
                  textTransform: "uppercase",
                }}
              >
                Calendar
              </Text>
              <Text
                style={{
                  fontFamily: "BarlowCondensed_800ExtraBold",
                  fontSize: 30,
                  lineHeight: 30,
                  letterSpacing: -0.8,
                  color: palette.text as string,
                }}
              >
                {formatMonthLabel(selectedDay, locale)}
              </Text>
              <Text
                style={{
                  ...BrandType.caption,
                  color: palette.textMuted as string,
                }}
              >
                {formatSelectedDayLabel(selectedDay, locale)}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end", gap: BrandSpacing.sm }}>
              {selectedDay !== todayKey ? (
                <KitButton
                  label={t("common.today", { defaultValue: "Today" })}
                  onPress={handleTodayPress}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                />
              ) : null}
              <KitButton
                label={showDatePicker ? t("common.done", { defaultValue: "Done" }) : "Jump"}
                onPress={() => {
                  if (showDatePicker) {
                    handleDoneWithDatePicker();
                    return;
                  }
                  setShowDatePicker(true);
                }}
                variant="secondary"
                size="sm"
                fullWidth={false}
              />
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: BrandSpacing.md,
              borderRadius: 24,
              borderCurve: "continuous",
              backgroundColor: palette.surfaceAlt as string,
              paddingHorizontal: BrandSpacing.md,
              paddingVertical: BrandSpacing.md,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.textMuted as string,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                }}
              >
                Focus lane
              </Text>
              <Text style={{ ...BrandType.bodyStrong, color: palette.text as string }}>
                {selectedLessonCount === 0
                  ? "Open day"
                  : selectedLessonCount === 1
                    ? "1 session on deck"
                    : `${String(selectedLessonCount)} sessions on deck`}
              </Text>
              <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                {selectedWeekLessonCount === 0
                  ? "Use jump or swipe the week rail to plan ahead."
                  : `${String(selectedWeekLessonCount)} total sessions in this week`}
              </Text>
            </View>

            <View
              style={{
                minWidth: 76,
                alignItems: "flex-end",
                gap: 2,
              }}
            >
              <Text
                style={{
                  fontFamily: "BarlowCondensed_800ExtraBold",
                  fontSize: 34,
                  lineHeight: 30,
                  letterSpacing: -0.8,
                  fontVariant: ["tabular-nums"],
                  color:
                    selectedLessonCount > 0
                      ? (palette.primary as string)
                      : (palette.textMuted as string),
                }}
              >
                {selectedLessonCount === 0 ? "OPEN" : String(selectedLessonCount)}
              </Text>
              <Text style={{ ...BrandType.micro, color: palette.textMuted as string }}>
                {selectedDay === todayKey ? "today" : "selected"}
              </Text>
            </View>
          </View>
        </View>

        <WeekRail
          locale={locale}
          selectedDay={selectedDay}
          todayKey={todayKey}
          weekDays={selectedWeekDays}
          lessonCountByDay={lessonCountByDay}
          onSelectDay={handleDayPress}
          onChangeWeek={handleWeekChange}
        />

        {showDatePicker ? (
          <Animated.View
            entering={FadeInDown.duration(220).springify().damping(22)}
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
              <View style={{ alignItems: "flex-end", paddingHorizontal: 14, paddingBottom: 14 }}>
                <KitButton
                  label={t("common.done", { defaultValue: "Done" })}
                  onPress={handleDoneWithDatePicker}
                  size="sm"
                  fullWidth={false}
                />
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </View>

      {/* Agenda list */}
      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeaderComponent}
        contentContainerStyle={{
          paddingBottom: tabContentBottom + 28,
          paddingHorizontal: BrandSpacing.lg,
          gap: BrandSpacing.sm,
        }}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={60}
        windowSize={6}
        removeClippedSubviews={Platform.OS === "android"}
        SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
        ItemSeparatorComponent={() => <View style={{ height: BrandSpacing.sm }} />}
      />
    </TabScreenRoot>
  );
}
