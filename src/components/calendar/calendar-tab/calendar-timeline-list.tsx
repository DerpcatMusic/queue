import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { memo, type RefObject } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { BrandSpacing } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useTheme } from "@/hooks/use-theme";
import type { TimelineListItem } from "../calendar-controller-helpers";
import { calendarTimelineStyles } from "./calendar-date-utils";

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
  renderItem,
}: CalendarTimelineListProps) {
  const { safeBottom } = useAppInsets();
  const { color: palette } = useTheme();
  const collapsedSheetHeight = useCollapsedSheetHeight();

  return (
    <TabScreenRoot mode="static" topInsetTone="sheet" style={{ backgroundColor: palette.appBg }}>
      <View
        style={[
          calendarTimelineStyles.timelineViewport,
          { backgroundColor: palette.appBg, paddingTop: collapsedSheetHeight + BrandSpacing.xl },
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
        />
      </View>
    </TabScreenRoot>
  );
}

export default memo(CalendarTimelineList);
