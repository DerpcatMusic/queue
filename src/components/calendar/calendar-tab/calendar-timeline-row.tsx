import { memo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Text } from "@/primitives";
import type { TimelineListItem } from "../calendar-controller-helpers";
import { calendarTimelineStyles, formatDayHeading, formatDaySubtitle } from "./calendar-date-utils";
import CalendarTimelineItem from "./calendar-timeline-item";

type CalendarTimelineRowProps = {
  item: TimelineListItem;
  todayKey: string;
};

function CalendarTimelineRow({ item, todayKey }: CalendarTimelineRowProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { color: palette } = theme;

  if (item.kind === "dayHeader") {
    const isToday = item.dayKey === todayKey;

    return (
      <Animated.View entering={FadeInUp.duration(180)} style={calendarTimelineStyles.timelineRow}>
        <View style={calendarTimelineStyles.dayHeaderContent}>
          <Text
            style={{
              fontFamily: "Lexend_700Bold",
              fontSize: 15,
              fontWeight: "700",
              letterSpacing: -0.2,
              lineHeight: 20,
              color: isToday ? palette.primary : palette.text,
            }}
          >
            {formatDayHeading(item.dayKey, i18n.language).toUpperCase()}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope_500Medium",
              fontSize: 11,
              fontWeight: "500",
              color: palette.textMuted,
            }}
          >
            {formatDaySubtitle(item.dayKey, i18n.language)}
          </Text>
        </View>
      </Animated.View>
    );
  }

  if (item.kind === "empty") {
    return (
      <Animated.View entering={FadeInUp.duration(160)} style={calendarTimelineStyles.timelineRow}>
        <View
          style={{
            paddingTop: BrandSpacing.md,
            paddingBottom: BrandSpacing.sm,
          }}
        >
          <Text
            style={{
              ...BrandType.caption,
              color: palette.textMicro,
            }}
          >
            {t("calendarTab.timeline.noLessons")}
          </Text>
        </View>
      </Animated.View>
    );
  }

  const row = item.lesson;
  const isLive = row.lifecycle === "live";

  return (
    <Animated.View entering={FadeInUp.duration(200)} style={calendarTimelineStyles.timelineRow}>
      <CalendarTimelineItem item={row} isLive={isLive} />
    </Animated.View>
  );
}

export default memo(CalendarTimelineRow);
