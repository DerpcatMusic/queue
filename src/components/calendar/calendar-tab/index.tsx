import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { useTopSheetContentInsets } from "@/components/layout/use-top-sheet-content-insets";
import { LoadingScreen } from "@/components/loading-screen";
import { BrandSpacing } from "@/constants/brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import type { TimelineListItem } from "../calendar-controller-helpers";
import { useCalendarTabController } from "../use-calendar-tab-controller";
import { toDayKey } from "./calendar-date-utils";
import CalendarTimelineList from "./calendar-timeline-list";
import CalendarTimelineRow from "./calendar-timeline-row";

export default function CalendarTabScreen() {
  const { t } = useTranslation();
  const { isDesktopWeb } = useLayoutBreakpoint();
  const { color: palette } = useTheme();
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
    viewabilityConfig,
    onViewableItemsChanged,
    handleTimelineScrollBegin,
    overrideItemLayout,
    isLoading,
  } = useCalendarTabController();
  const listAnimationKey = `${selectedDay}:${listItems.length}`;

  const renderItem = useMemo(
    () =>
      ({ item }: { item: TimelineListItem }) => (
        <CalendarTimelineRow item={item} todayKey={todayKey} />
      ),
    [todayKey],
  );

  if (isLoading) {
    return <LoadingScreen label={t("calendarTab.loading")} />;
  }

  if (isDesktopWeb) {
    return (
      <TabScreenRoot mode="static">
        <View style={styles.desktopEmptyState}>
          <Text
            style={{
              fontFamily: "Manrope_600SemiBold",
              fontSize: 16,
              fontWeight: "600",
              lineHeight: 22,
              color: palette.textMuted,
            }}
          >
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
      extraData={listAnimationKey}
      initialScrollIndex={initialScrollIndex}
      overrideItemLayout={overrideItemLayout}
      onScrollBeginDrag={handleTimelineScrollBegin}
      onViewableItemsChanged={onViewableItemsChanged as (info: unknown) => void}
      viewabilityConfig={viewabilityConfig as Record<string, unknown>}
      contentContainerStyle={sheetContentInsets}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  desktopEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: BrandSpacing.xl,
  },
});
