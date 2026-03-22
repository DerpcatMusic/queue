import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { memo, type RefObject } from "react";
import { type StyleProp, Text, View, type ViewStyle } from "react-native";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import type { TimelineListItem } from "../calendar-controller-helpers";
import { calendarSheetStyles, calendarTimelineStyles } from "./calendar-date-utils";

type CalendarTimelineListProps = {
  listRef: RefObject<FlashListRef<TimelineListItem> | null>;
  listItems: TimelineListItem[];
  extraData: string;
  initialScrollIndex: number;
  overrideItemLayout:
    | ((layout: { span?: number; size?: number }, item: TimelineListItem) => void)
    | undefined;
  onScrollBeginDrag: () => void;
  onViewableItemsChanged: ((info: unknown) => void) | undefined;
  viewabilityConfig: Record<string, unknown>;
  contentContainerStyle: StyleProp<ViewStyle>;
  selectedLessonCount: number;
  agendaTitle: string;
  eventCountLabel: string;
  renderItem: ({ item }: { item: TimelineListItem }) => React.ReactElement | null;
};

function CalendarTimelineList({
  listRef,
  listItems,
  extraData,
  initialScrollIndex,
  overrideItemLayout,
  onScrollBeginDrag,
  onViewableItemsChanged,
  viewabilityConfig,
  contentContainerStyle,
  selectedLessonCount,
  agendaTitle,
  eventCountLabel,
  renderItem,
}: CalendarTimelineListProps) {
  const palette = useBrand();
  const { safeBottom } = useAppInsets();

  const agendaHeaderComponent = (
    <View style={calendarSheetStyles.agendaHeader}>
      <View style={calendarSheetStyles.agendaHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...BrandType.bodyStrong, color: palette.text as string }}>
            {agendaTitle}
          </Text>
        </View>
        <View
          style={[
            calendarSheetStyles.summaryCountPill,
            {
              backgroundColor:
                selectedLessonCount > 0
                  ? (palette.primarySubtle as string)
                  : (palette.surface as string),
            },
          ]}
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
            {eventCountLabel}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <TabScreenRoot mode="static" topInsetTone="sheet" style={{ backgroundColor: palette.appBg }}>
      <View
        style={[
          calendarTimelineStyles.timelineViewport,
          { backgroundColor: palette.appBg as string },
        ]}
      >
        <FlashList
          ref={listRef}
          data={listItems}
          extraData={extraData}
          initialScrollIndex={initialScrollIndex}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          getItemType={(item) => item.kind}
          drawDistance={600}
          overrideItemLayout={overrideItemLayout as never}
          removeClippedSubviews
          onScrollBeginDrag={onScrollBeginDrag}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged as never}
          viewabilityConfig={viewabilityConfig as never}
          scrollIndicatorInsets={{ bottom: safeBottom + BrandSpacing.md }}
          contentContainerStyle={[calendarTimelineStyles.timelineContent, contentContainerStyle]}
          ListHeaderComponent={agendaHeaderComponent}
        />
      </View>
    </TabScreenRoot>
  );
}

export default memo(CalendarTimelineList);
