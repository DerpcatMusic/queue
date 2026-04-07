import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { memo, type RefObject } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { BrandSpacing } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";
import type { TimelineListItem } from "../calendar-controller-helpers";
import { calendarTimelineStyles, RAIL_LEFT } from "./calendar-date-utils";

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
  const contentBackgroundColor = palette.appBg;
  return (
    <TabScreenRoot
      mode="static"
      topInsetTone="sheet"
      style={{ backgroundColor: contentBackgroundColor }}
      sheetInsets={{ topSpacing: 0 }}
    >
      <Box
        style={[
          calendarTimelineStyles.timelineViewport,
          { backgroundColor: contentBackgroundColor },
        ]}
      >
        {/* Central Timeline Line */}
        <View
          style={[
            styles.timelineLine,
            {
              left: RAIL_LEFT + 11, // Center of the 24px timeline rail
              backgroundColor: palette.border,
            },
          ]}
        />
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
          contentContainerStyle={[
            calendarTimelineStyles.timelineContent,
            { paddingBottom: safeBottom + BrandSpacing.xl },
            contentContainerStyle,
          ]}
        />
      </Box>
    </TabScreenRoot>
  );
}

const styles = StyleSheet.create({
  timelineLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    zIndex: 0,
  },
});

export default memo(CalendarTimelineList);
