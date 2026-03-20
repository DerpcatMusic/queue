import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { useTopSheetContentInsets } from "@/components/layout/use-top-sheet-content-insets";
import { LoadingScreen } from "@/components/loading-screen";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import type { TimelineListItem } from "../calendar-controller-helpers";
import { useCalendarTabController } from "../use-calendar-tab-controller";
import { toDayKey } from "./calendar-date-utils";
import CalendarSheetHeader from "./calendar-sheet-header";
import CalendarTimelineList from "./calendar-timeline-list";
import CalendarTimelineRow from "./calendar-timeline-row";

export default function CalendarTabScreen() {
  const { t } = useTranslation();
  const palette = useBrand();
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

  const handleChooseDatePress = useCallback(() => {
    if (showDatePicker) {
      handleDoneWithDatePicker();
      return;
    }
    setShowDatePicker(true);
    openMonthPicker();
  }, [handleDoneWithDatePicker, openMonthPicker, showDatePicker]);

  const calendarSheetConfig = useMemo(
    () => ({
      content: (
        <CalendarSheetHeader
          canShowGoogleAgenda={canShowGoogleAgenda}
          selectedDay={selectedDay}
          selectedLessonCount={selectedLessonCount}
          selectedDayIsToday={selectedDay === todayKey}
          showCalendarFilters={showCalendarFilters}
          showDatePicker={showDatePicker}
          visibilityFilters={visibilityFilters}
          onToggleFilters={() => setShowCalendarFilters((current) => !current)}
          onTodayPress={handleTodayPress}
          onChooseDatePress={handleChooseDatePress}
          onToggleVisibilityFilter={toggleVisibilityFilter}
        />
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
      canShowGoogleAgenda,
      handleChooseDatePress,
      handleTodayPress,
      palette,
      selectedDay,
      selectedLessonCount,
      showCalendarFilters,
      showDatePicker,
      todayKey,
      toggleVisibilityFilter,
      visibilityFilters,
    ],
  );

  useGlobalTopSheet("calendar", calendarSheetConfig);

  const eventCountLabel =
    selectedLessonCount === 1
      ? t("calendarTab.agenda.oneEvent")
      : t("calendarTab.agenda.eventCount", { count: selectedLessonCount });

  const renderItem = useCallback(
    ({ item }: { item: TimelineListItem }) => (
      <CalendarTimelineRow
        item={item}
        todayKey={todayKey}
        railColor={railColor}
        onDayPress={handleDayPress}
      />
    ),
    [handleDayPress, railColor, todayKey],
  );

  if (isLoading) {
    return <LoadingScreen label={t("calendarTab.loading")} />;
  }

  if (isDesktopWeb) {
    return (
      <TabScreenRoot mode="static" style={{ backgroundColor: palette.surface as string }}>
        <View style={styles.desktopEmptyState}>
          <Text style={{ ...BrandType.bodyStrong, color: palette.textMuted as string }}>
            {t("calendarTab.desktopSoon")}
          </Text>
        </View>
      </TabScreenRoot>
    );
  }

  return (
    <CalendarTimelineList
      listRef={listRef}
      listItems={listItems}
      initialScrollIndex={initialScrollIndex}
      overrideItemLayout={overrideItemLayout}
      onScrollBeginDrag={handleTimelineScrollBegin}
      onViewableItemsChanged={onViewableItemsChanged as (info: unknown) => void}
      viewabilityConfig={viewabilityConfig as Record<string, unknown>}
      contentContainerStyle={sheetContentInsets}
      selectedLessonCount={selectedLessonCount}
      agendaTitle={t("calendarTab.agenda.title")}
      eventCountLabel={eventCountLabel}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  desktopEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
});
