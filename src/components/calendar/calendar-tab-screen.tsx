import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  SectionList,
  type SectionListRenderItemInfo,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { LoadingScreen } from "@/components/loading-screen";
import { KitButton, KitPressable } from "@/components/ui/kit";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { formatTime } from "@/lib/jobs-utils";
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
const DAY_SWATCH_SIZE = 6;

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

  const railGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-12, 12])
        .onEnd((event) => {
          if (event.translationX <= -WEEK_SWIPE_THRESHOLD || event.velocityX <= -650) {
            triggerSelectionHaptic();
            onChangeWeek(1);
            return;
          }
          if (event.translationX >= WEEK_SWIPE_THRESHOLD || event.velocityX >= 650) {
            triggerSelectionHaptic();
            onChangeWeek(-1);
          }
        }),
    [onChangeWeek],
  );

  return (
    <GestureDetector gesture={railGesture}>
      <View
        style={[
          styles.weekRail,
          {
            backgroundColor: palette.surface as string,
            borderColor: palette.border as string,
          },
        ]}
      >
        {weekDays.map((dayKey) => {
          const selected = dayKey === selectedDay;
          const lessonCount = lessonCountByDay.get(dayKey) ?? 0;
          const today = isToday(dayKey, todayKey);

          return (
            <KitPressable
              key={dayKey}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={formatSelectedDayLabel(dayKey, locale)}
              onPress={() => {
                triggerSelectionHaptic();
                onSelectDay(dayKey);
              }}
              style={styles.dayChipPressable}
            >
              <View
                style={[
                  styles.dayChip,
                  selected && { backgroundColor: palette.primary as string },
                  !selected &&
                    today && {
                      borderColor: palette.primary as string,
                      borderWidth: 1.5,
                    },
                ]}
              >
                <Text
                  style={[
                    styles.dayChipWeekday,
                    {
                      color: selected
                        ? (palette.onPrimary as string)
                        : today
                          ? (palette.primary as string)
                          : (palette.textMuted as string),
                    },
                  ]}
                >
                  {formatWeekdayLabel(dayKey, locale)}
                </Text>
                <Text
                  style={[
                    styles.dayChipNumber,
                    {
                      color: selected ? (palette.onPrimary as string) : (palette.text as string),
                    },
                  ]}
                >
                  {formatDayNumber(dayKey)}
                </Text>
                <View style={styles.dayChipMeta}>
                  {lessonCount > 0 ? (
                    <>
                      <View
                        style={[
                          styles.dayChipDot,
                          {
                            backgroundColor: selected
                              ? (palette.onPrimary as string)
                              : (palette.primary as string),
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.dayChipCount,
                          {
                            color: selected
                              ? (palette.onPrimary as string)
                              : (palette.textMuted as string),
                          },
                        ]}
                      >
                        {lessonCount}
                      </Text>
                    </>
                  ) : (
                    <View style={styles.dayChipEmptyMeta} />
                  )}
                </View>
              </View>
            </KitPressable>
          );
        })}
      </View>
    </GestureDetector>
  );
}

function AgendaLessonCard({ locale, row }: { locale: string; row: TimelineRow }) {
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
      ? {
          fg: palette.success as string,
          bg: palette.successSubtle as string,
          label: "Live now",
        }
      : row.lifecycle === "upcoming"
        ? {
            fg: palette.primary as string,
            bg: palette.primarySubtle as string,
            label: "Upcoming",
          }
        : row.lifecycle === "cancelled"
          ? {
              fg: palette.danger as string,
              bg: palette.dangerSubtle as string,
              label: "Cancelled",
            }
          : {
              fg: palette.textMuted as string,
              bg: palette.surfaceAlt as string,
              label: "Past",
            };

  return (
    <View
      style={[
        styles.lessonCard,
        {
          backgroundColor: palette.surfaceElevated as string,
          borderColor: palette.border as string,
        },
      ]}
    >
      <View style={[styles.lessonAccent, { backgroundColor: accent }]} />
      <View style={styles.lessonBody}>
        <View style={styles.lessonTopRow}>
          <Text style={[styles.lessonTime, { color: palette.textMuted as string }]}>
            {formatTime(row.startTime, locale)} - {formatTime(row.endTime, locale)}
          </Text>
          <View style={[styles.lifecyclePill, { backgroundColor: lifecycleTone.bg }]}>
            <Text style={[styles.lifecycleText, { color: lifecycleTone.fg }]}>
              {lifecycleTone.label}
            </Text>
          </View>
        </View>
        <Text style={[styles.lessonTitle, { color: palette.text as string }]}>{row.sport}</Text>
        <Text style={[styles.lessonMeta, { color: palette.textMuted as string }]}>
          {counterpart}
        </Text>
      </View>
    </View>
  );
}

export default function CalendarTabScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { tabContentBottom } = useAppInsets();
  const locale = i18n.language;
  const todayKey = useMemo(() => toDayKey(Date.now()), []);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const {
    selectedDay,
    selectedWeekDays,
    listRef,
    sections,
    lessonCountByDay,
    viewabilityConfig,
    onViewableItemsChanged,
    handleDayPress,
    handleWeekChange,
    handleTodayPress,
    isLoading,
  } = useCalendarTabController({ locale });

  const selectedLessonCount = lessonCountByDay.get(selectedDay) ?? 0;

  const handleDateChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      if (Platform.OS !== "ios") {
        setShowDatePicker(false);
      }
      if (!selectedDate) return;
      handleDayPress(toDayKey(selectedDate.getTime()));
    },
    [handleDayPress],
  );

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<AgendaItem, AgendaSection>) => {
      if (item.kind === "empty") {
        return (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: palette.surfaceAlt as string,
                borderColor: palette.border as string,
              },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: palette.text as string }]}>
              {t("calendarTab.timeline.noLessons", {
                defaultValue: "No lessons",
              })}
            </Text>
            <Text style={[styles.emptyBody, { color: palette.textMuted as string }]}>
              {t("calendarTab.timeline.noLessonsHint", {
                defaultValue: "Nothing is scheduled for this day yet.",
              })}
            </Text>
          </View>
        );
      }

      return <AgendaLessonCard locale={locale} row={item.lesson} />;
    },
    [locale, palette, t],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: AgendaSection }) => (
      <View
        style={[
          styles.sectionHeader,
          {
            backgroundColor: palette.appBg as string,
            borderBottomColor: palette.border as string,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: palette.text as string }]}>
          {formatSectionTitle(section.dayKey, locale)}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: palette.textMuted as string }]}>
          {formatSectionSubtitle(section.dayKey, locale)}
        </Text>
      </View>
    ),
    [locale, palette],
  );

  const listHeaderComponent = useMemo(() => <View style={styles.listHeaderSpacer} />, []);

  if (isLoading) {
    return <LoadingScreen label={t("calendarTab.loading")} />;
  }

  return (
    <TabScreenRoot mode="static" style={{ backgroundColor: palette.appBg }}>
      <View
        style={[
          styles.headerShell,
          {
            backgroundColor: palette.appBg as string,
            borderBottomColor: palette.border as string,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <KitPressable
            accessibilityRole="button"
            accessibilityLabel={t("calendarTab.openDatePicker", {
              defaultValue: "Choose a date",
            })}
            onPress={() => setShowDatePicker((value) => !value)}
            style={styles.monthButton}
          >
            <View>
              <Text style={[styles.monthLabel, { color: palette.text as string }]}>
                {formatMonthLabel(selectedDay, locale)}
              </Text>
              <Text style={[styles.selectedDayLabel, { color: palette.textMuted as string }]}>
                {formatSelectedDayLabel(selectedDay, locale)}
              </Text>
            </View>
          </KitPressable>

          <View style={styles.headerActions}>
            <View
              style={[
                styles.countPill,
                {
                  backgroundColor: palette.surfaceAlt as string,
                  borderColor: palette.border as string,
                },
              ]}
            >
              <Text style={[styles.countPillText, { color: palette.textMuted as string }]}>
                {selectedLessonCount === 1 ? "1 lesson" : `${String(selectedLessonCount)} lessons`}
              </Text>
            </View>
            {selectedDay !== todayKey ? (
              <KitButton
                label={t("common.today", { defaultValue: "Today" })}
                onPress={handleTodayPress}
                variant="secondary"
                size="sm"
                fullWidth={false}
              />
            ) : null}
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
          <View
            style={[
              styles.datePickerDock,
              {
                backgroundColor: palette.surface as string,
                borderColor: palette.border as string,
              },
            ]}
          >
            <DateTimePicker
              value={new Date(dayKeyToTimestamp(selectedDay))}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={handleDateChange}
            />
            {Platform.OS === "ios" ? (
              <View style={styles.datePickerActions}>
                <KitButton
                  label={t("common.done", { defaultValue: "Done" })}
                  onPress={() => setShowDatePicker(false)}
                  size="sm"
                  fullWidth={false}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListHeaderComponent={listHeaderComponent}
        contentContainerStyle={{
          paddingBottom: tabContentBottom + 28,
          paddingHorizontal: 16,
        }}
        initialNumToRender={18}
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={50}
        windowSize={8}
        removeClippedSubviews={Platform.OS === "android"}
        SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </TabScreenRoot>
  );
}

const styles = StyleSheet.create({
  headerShell: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 14,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  monthButton: {
    flex: 1,
  },
  monthLabel: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  selectedDayLabel: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "500",
  },
  headerActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  countPill: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  countPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  weekRail: {
    flexDirection: "row",
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 4,
  },
  dayChipPressable: {
    flex: 1,
  },
  dayChip: {
    minHeight: 78,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 4,
  },
  dayChipWeekday: {
    fontSize: 11,
    fontWeight: "700",
  },
  dayChipNumber: {
    fontSize: 18,
    fontWeight: "700",
    includeFontPadding: false,
  },
  dayChipMeta: {
    minHeight: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dayChipDot: {
    width: DAY_SWATCH_SIZE,
    height: DAY_SWATCH_SIZE,
    borderRadius: DAY_SWATCH_SIZE / 2,
  },
  dayChipCount: {
    fontSize: 11,
    fontWeight: "600",
  },
  dayChipEmptyMeta: {
    height: 12,
  },
  datePickerDock: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  datePickerActions: {
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  listHeaderSpacer: {
    height: 12,
  },
  sectionHeader: {
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "500",
  },
  lessonCard: {
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 104,
  },
  lessonAccent: {
    width: 6,
  },
  lessonBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  lessonTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  lessonTime: {
    fontSize: 13,
    fontWeight: "600",
  },
  lifecyclePill: {
    minHeight: 24,
    borderRadius: 999,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  lifecycleText: {
    fontSize: 11,
    fontWeight: "700",
  },
  lessonTitle: {
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  lessonMeta: {
    fontSize: 14,
    fontWeight: "500",
  },
  emptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
  },
});
