import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import {
  createContentDrivenTopSheetConfig,
  useGlobalTopSheet,
} from "@/components/layout/top-sheet-registry";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { LoadingScreen } from "@/components/loading-screen";
import { BrandSpacing } from "@/constants/brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import type { TimelineListItem } from "../calendar-controller-helpers";
import { useCalendarTabController } from "../use-calendar-tab-controller";
import CalendarSheetHeader from "./calendar-sheet-header";
import CalendarTimelineList from "./calendar-timeline-list";
import CalendarTimelineRow from "./calendar-timeline-row";

type CalendarTabScreenProps = {
  controller: ReturnType<typeof useCalendarTabController>;
  todayKey: string;
};

export default function CalendarTabScreen({ controller, todayKey }: CalendarTabScreenProps) {
  const { t } = useTranslation();
  const { isDesktopWeb } = useLayoutBreakpoint();
  const theme = useTheme();
  const { color: palette } = theme;
  const sheetBackgroundColor = palette.primary;
  const sheetContentInsets = useMemo(
    () => ({
      paddingTop: BrandSpacing.xs,
      paddingHorizontal: BrandSpacing.lg,
    }),
    [],
  );
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
  } = controller;
  const calendarSheetConfig = useMemo(
    () =>
      createContentDrivenTopSheetConfig({
        collapsedContent: <CalendarSheetHeader selectedDay={selectedDay} todayKey={todayKey} />,
        padding: {
          vertical: BrandSpacing.sm,
          horizontal: BrandSpacing.xl,
        },
        backgroundColor: sheetBackgroundColor,
        topInsetColor: sheetBackgroundColor,
        style: {
          shadowOpacity: 0,
          shadowRadius: 0,
          elevation: 0,
          borderColor: sheetBackgroundColor,
          borderBottomColor: sheetBackgroundColor,
          borderLeftColor: sheetBackgroundColor,
          borderRightColor: sheetBackgroundColor,
        },
      }),
    [selectedDay, sheetBackgroundColor, todayKey],
  );
  useGlobalTopSheet("calendar", calendarSheetConfig, "calendar:tab-screen");
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
