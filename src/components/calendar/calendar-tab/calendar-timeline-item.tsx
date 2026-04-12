import { Image as ExpoImage } from "expo-image";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from "react-native-svg";
import { FilterImage, type Filters } from "react-native-svg/filter-image";
import { StyleSheet } from "react-native-unistyles";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useSheetContext } from "@/contexts/sheet-context";
import type { CalendarLessonSheetRole } from "@/contexts/sheet-context";
import type { Id } from "@/convex/_generated/dataModel";
import { useTheme } from "@/hooks/use-theme";
import { formatTime } from "@/lib/jobs-utils";
import { toSportLabelI18n } from "@/lib/sport-i18n";
import { Text } from "@/primitives";
import { FontFamily, FontSize, LetterSpacing } from "@/theme/theme";
import type { TimelineRow } from "../calendar-controller-helpers";
import { useLessonCheckIn } from "../use-lesson-check-in";

type CalendarTimelineItemProps = {
  item: TimelineRow;
  isLive: boolean;
};

const ONE_HOUR_MS = 60 * 60 * 1000;
const CALENDAR_CARD_NATIVE_FILTERS: Filters = [
  { name: "feColorMatrix", type: "saturate", values: 0 },
  {
    name: "feColorMatrix",
    type: "matrix",
    values: [1.12, 0, 0, 0, -0.06, 0, 1.12, 0, 0, -0.06, 0, 0, 1.12, 0, -0.06, 0, 0, 0, 1, 0],
  },
];

function CalendarTimelineItem({ item, isLive }: CalendarTimelineItemProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { color: palette } = theme;
  const { isSubmitting, submitCheckIn } = useLessonCheckIn();
  const { openCalendarLesson } = useSheetContext();
  const isLightTheme = theme.scheme === "light";

  const timeStartLabel = item.isAllDay
    ? t("calendarTab.timeline.allDay")
    : formatTime(item.startTime, "en-US");
  const timeEndLabel = item.isAllDay ? null : formatTime(item.endTime, "en-US");

  const counterpart =
    item.source === "google"
      ? (item.location ?? t("calendarTab.googleCalendar"))
      : item.roleView === "instructor"
        ? item.studioName
        : (item.instructorName ?? t("calendarTab.unassignedInstructor"));
  const sportLabel = toSportLabelI18n(item.sport, t);
  const counterpartImageUrl =
    item.source !== "job"
      ? undefined
      : item.roleView === "instructor"
        ? item.studioProfileImageUrl
        : item.instructorProfileImageUrl;
  const fallbackLabel = counterpart || item.sport;
  const imageFadeId = useMemo(() => `calendar-card-fade-${item.lessonId}`, [item.lessonId]);
  const webFilterStyle = useMemo(
    () => ({
      filter: isLightTheme
        ? "grayscale(100%) contrast(120%) brightness(82%)"
        : "grayscale(100%) contrast(116%) brightness(48%)",
    }),
    [isLightTheme],
  );

  const now = Date.now();
  const canCheckInWindow =
    !item.isAllDay && item.startTime - now <= ONE_HOUR_MS && item.endTime >= now;
  const canOpenDetails = item.source === "job";
  const isCheckedIn = item.checkInStatus === "verified";
  const hasRejectedCheckIn = item.checkInStatus === "rejected";
  const canShowCheckIn =
    canOpenDetails &&
    item.roleView === "instructor" &&
    canCheckInWindow &&
    item.lifecycle !== "past" &&
    item.lifecycle !== "cancelled" &&
    !isCheckedIn;

  const isPast = item.lifecycle === "past";
  const isCancelled = item.status === "cancelled" || item.lifecycle === "cancelled";

  // Determine status icon + color
  const statusIcon = isCheckedIn
    ? "checkmark.circle.fill"
    : hasRejectedCheckIn
      ? "xmark.circle.fill"
      : isCancelled
        ? "xmark.circle.fill"
        : isLive
          ? "bolt.circle.fill"
          : isPast
            ? "checkmark.circle"
            : "clock.fill";

  const statusColor = isCheckedIn
    ? palette.primary
    : hasRejectedCheckIn
      ? palette.danger
      : isCancelled
        ? palette.danger
        : isLive
          ? palette.secondary
          : isPast
            ? palette.textMicro
            : palette.primary;

  const handleOpenDetails = () => {
    if (!canOpenDetails) return;
    openCalendarLesson(item.lessonId, item.roleView as CalendarLessonSheetRole);
  };

  const handleCheckIn = () => {
    if (!canShowCheckIn) return;
    void submitCheckIn(item.lessonId as Id<"jobs">);
  };

  return (
    <Animated.View entering={FadeInUp.duration(200)} style={styles.container}>
      {/* Timeline rail dot */}
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, { backgroundColor: statusColor }]} />
      </View>

      <Pressable
        accessibilityRole={canOpenDetails ? "button" : undefined}
        disabled={!canOpenDetails}
        onPress={handleOpenDetails}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isLightTheme ? palette.surface : palette.surfaceElevated,
            transform: [{ scale: canOpenDetails && pressed ? 0.98 : 1 }],
          },
        ]}
      >
        {/* Left accent stripe */}
        <View style={[styles.accentStripe, { backgroundColor: statusColor }]} />

        {/* Background image layer */}
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          {counterpartImageUrl ? (
            Platform.select({
              web: (
                <View style={[StyleSheet.absoluteFillObject, webFilterStyle]}>
                  <ExpoImage
                    source={{ uri: counterpartImageUrl }}
                    contentFit="cover"
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              ),
              default: (
                <FilterImage
                  source={{ uri: counterpartImageUrl }}
                  filters={CALENDAR_CARD_NATIVE_FILTERS}
                  style={StyleSheet.absoluteFillObject}
                />
              ),
            })
          ) : (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: isLightTheme ? palette.surfaceMuted : palette.surface },
              ]}
            >
              <View style={styles.fallbackInitialWrap}>
                <Text
                  style={[
                    styles.fallbackInitial,
                    { color: isLightTheme ? palette.primaryPressed : palette.primary },
                  ]}
                >
                  {fallbackLabel.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            </View>
          )}
          <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <SvgLinearGradient id={imageFadeId} x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#000000" stopOpacity="0.28" />
                <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </SvgLinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${imageFadeId})`} />
          </Svg>
        </View>

        {/* Content layer */}
        <View style={styles.topRow}>
          {/* Left: Status icon + sport */}
          <View style={styles.topLeft}>
            <View style={styles.sportRow}>
              <IconSymbol name={statusIcon} size={18} color={statusColor} />
              <Text style={[styles.sportTitle, { color: palette.text }]} numberOfLines={1}>
                {sportLabel}
              </Text>
            </View>
            <View style={styles.locationRow}>
              <IconSymbol name="location_on" size={12} color={palette.textMuted} />
              <Text style={[styles.locationText, { color: palette.textMuted }]} numberOfLines={1}>
                {counterpart}
              </Text>
            </View>
          </View>

          {/* Right: Time block */}
          <View style={styles.timeBlock}>
            <Text style={[styles.timePrimary, { color: palette.text }]}>{timeStartLabel}</Text>
            {timeEndLabel ? (
              <Text style={[styles.timeSecondary, { color: palette.textMuted }]}>
                {timeEndLabel}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Live / check-in banner */}
        {isLive && !isCheckedIn ? (
          <View style={[styles.liveBanner, { backgroundColor: palette.secondary }]}>
            <IconSymbol name="bolt.fill" size={14} color="#FFFFFF" />
            <Text style={[styles.liveBannerText, { color: "#FFFFFF" }]}>
              {t("calendarTab.card.indicators.arriveNow")}
            </Text>
          </View>
        ) : null}

        {isCheckedIn ? (
          <View style={[styles.checkedBanner, { backgroundColor: palette.primary }]}>
            <IconSymbol name="checkmark" size={14} color={palette.onPrimary} />
            <Text style={[styles.liveBannerText, { color: palette.onPrimary }]}>
              {t("calendarTab.card.indicators.checkedIn")}
            </Text>
          </View>
        ) : null}

        {/* Google source tag */}
        {item.source === "google" ? (
          <View style={styles.googleTag}>
            <Text style={[styles.googleTagText, { color: palette.textMuted }]}>
              {t("calendarTab.timeline.googleBadge")}
            </Text>
          </View>
        ) : null}

        {/* Note */}
        {item.note ? (
          <View style={[styles.noteBox, { backgroundColor: palette.primarySubtle }]}>
            <Text style={[styles.noteText, { color: palette.text }]} numberOfLines={2}>
              {item.note}
            </Text>
          </View>
        ) : null}

        {/* Check-in CTA */}
        {canShowCheckIn ? (
          <Pressable
            onPress={handleCheckIn}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.checkInChip,
              {
                backgroundColor: palette.primary,
                transform: [{ scale: pressed && !isSubmitting ? 0.97 : 1 }],
                opacity: isSubmitting ? 0.7 : 1,
              },
            ]}
          >
            <IconSymbol name="checkmark" size={14} color={palette.onPrimary} />
            <Text style={[styles.checkInChipText, { color: palette.onPrimary }]}>
              {isSubmitting ? t("common.loading") : t("calendarTab.card.checkIn")}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginBottom: BrandSpacing.sm,
  },
  timelineRail: {
    width: 16,
    alignItems: "center",
    paddingTop: BrandSpacing.md,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  card: {
    flex: 1,
    marginLeft: BrandSpacing.sm,
    borderRadius: BrandRadius.cardSubtle,
    padding: BrandSpacing.md,
    gap: BrandSpacing.sm,
    overflow: "hidden",
  },
  accentStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 4,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  topLeft: {
    flex: 1,
    gap: BrandSpacing.xxs,
    marginRight: BrandSpacing.sm,
  },
  sportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
  sportTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.body,
    fontWeight: "800",
    letterSpacing: LetterSpacing.label,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
  },
  timeBlock: {
    alignItems: "flex-end",
    gap: 2,
  },
  timePrimary: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  timeSecondary: {
    fontFamily: FontFamily.title,
    fontSize: 12,
    fontWeight: "500",
  },
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: BrandSpacing.sm,
    paddingVertical: BrandSpacing.xs,
    borderRadius: BrandRadius.pill,
  },
  checkedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: BrandSpacing.sm,
    paddingVertical: BrandSpacing.xs,
    borderRadius: BrandRadius.pill,
  },
  liveBannerText: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  googleTag: {
    alignSelf: "flex-start",
  },
  googleTagText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  noteBox: {
    borderRadius: BrandRadius.md,
    paddingHorizontal: BrandSpacing.sm,
    paddingVertical: BrandSpacing.xs,
  },
  noteText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  checkInChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.sm,
    borderRadius: BrandRadius.pill,
  },
  checkInChipText: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  fallbackInitialWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackInitial: {
    fontFamily: FontFamily.displayBold,
    fontSize: 44,
    fontWeight: "800",
  },
});

export default memo(CalendarTimelineItem);
