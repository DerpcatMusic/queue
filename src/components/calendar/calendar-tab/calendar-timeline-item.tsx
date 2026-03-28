import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { formatTime } from "@/lib/jobs-utils";
import type { TimelineRow } from "../calendar-controller-helpers";

type CalendarTimelineItemProps = {
  item: TimelineRow;
  isLive: boolean;
};

const ONE_HOUR_MS = 60 * 60 * 1000;

function CalendarTimelineItem({ item, isLive }: CalendarTimelineItemProps) {
  const { color: palette } = useTheme();

  const timeStartLabel = item.isAllDay ? "All Day" : formatTime(item.startTime, "en-US");
  const timeEndLabel = item.isAllDay ? null : formatTime(item.endTime, "en-US");

  const counterpart =
    item.source === "google"
      ? (item.location ?? "Google Calendar")
      : item.roleView === "instructor"
        ? item.studioName
        : (item.instructorName ?? "Unassigned");

  // Check if within 1 hour of lesson start (for Check In button)
  const now = Date.now();
  const canCheckIn =
    !item.isAllDay && !isLive && item.startTime - now <= ONE_HOUR_MS && item.startTime - now > 0;

  return (
    <Animated.View entering={FadeInUp.duration(200)} style={styles.container}>
      {/* Timeline Dot */}
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, { backgroundColor: palette.surface }]}>
          <View
            style={[
              styles.timelineDotInner,
              {
                backgroundColor: isLive ? palette.secondary : palette.textMicro,
                opacity: isLive ? 1 : 0.3,
              },
            ]}
          />
        </View>
      </View>

      {/* Shift Card */}
      <View style={[styles.card, { backgroundColor: palette.surfaceElevated }]}>
        {/* Card Header Row */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {isLive && (
              <View style={[styles.badge, { backgroundColor: palette.warningSubtle }]}>
                <Text style={[styles.badgeText, { color: palette.warning }]}>Next Up</Text>
              </View>
            )}
            <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
              {item.sport}
            </Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={[styles.timeStart, { color: palette.primary }]}>{timeStartLabel}</Text>
            {timeEndLabel && (
              <Text style={[styles.timeEnd, { color: palette.textMuted }]}>to {timeEndLabel}</Text>
            )}
          </View>
        </View>

        {/* Location Row */}
        <View style={styles.locationRow}>
          <IconSymbol name="location_on" size={14} color={palette.textMuted} />
          <Text style={[styles.locationText, { color: palette.textMuted }]} numberOfLines={1}>
            {counterpart}
          </Text>
        </View>

        {/* CTA Buttons Row */}
        <View style={styles.ctaRow}>
          {/* View Map Button */}
          <View style={[styles.ctaButton, { backgroundColor: palette.surfaceAlt }]}>
            <IconSymbol name="map" size={16} color={palette.text} />
            <Text style={[styles.ctaText, { color: palette.text }]}>View Map</Text>
          </View>

          {/* Check In Button - only available within 1 hour of lesson */}
          {canCheckIn && (
            <View style={[styles.ctaButton, { backgroundColor: palette.primary }]}>
              <IconSymbol name="checkmark" size={16} color={palette.onPrimary} />
              <Text style={[styles.ctaText, { color: palette.onPrimary }]}>Check In</Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginBottom: BrandSpacing.lg,
  },
  timelineRail: {
    width: 24,
    alignItems: "center",
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  card: {
    flex: 1,
    marginLeft: BrandSpacing.md,
    borderRadius: BrandRadius.card,
    padding: BrandSpacing.md,
    gap: BrandSpacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: BrandSpacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
    gap: BrandSpacing.xs,
  },
  cardHeaderRight: {
    alignItems: "flex-end",
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: BrandSpacing.sm,
    paddingVertical: 2,
    borderRadius: BrandRadius.pill,
  },
  badgeText: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  cardTitle: {
    fontFamily: "Lexend_700Bold",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.24,
  },
  timeStart: {
    fontFamily: "Lexend_800ExtraBold",
    fontSize: 18,
    fontWeight: "800",
  },
  timeEnd: {
    fontFamily: "Lexend_700Bold",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    opacity: 0.4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
  locationText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  ctaRow: {
    flexDirection: "row",
    gap: BrandSpacing.sm,
    marginTop: BrandSpacing.xs,
  },
  ctaButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: BrandSpacing.xs,
    paddingVertical: BrandSpacing.sm + 2,
    borderRadius: BrandRadius.button,
  },
  ctaText: {
    fontFamily: "Lexend_800ExtraBold",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

export default memo(CalendarTimelineItem);
