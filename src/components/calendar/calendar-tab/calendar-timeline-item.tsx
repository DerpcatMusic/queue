import { Image as ExpoImage } from "expo-image";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from "react-native-svg";
import { FilterImage, type Filters } from "react-native-svg/filter-image";
import { StyleSheet } from "react-native-unistyles";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useSheetContext } from "@/contexts/sheet-context";
import type { CalendarLessonSheetRole } from "@/contexts/sheet-context";
import type { Id } from "@/convex/_generated/dataModel";
import { useTheme } from "@/hooks/use-theme";
import { formatTime } from "@/lib/jobs-utils";
import { toSportLabelI18n } from "@/lib/sport-i18n";
import { Text } from "@/primitives";
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

function getTimelineIndicator(
  item: TimelineRow,
  isLive: boolean,
  canCheckIn: boolean,
  t: (key: string) => string,
) {
  if (item.checkInStatus === "verified") {
    return {
      tone: "good" as const,
      label: t("calendarTab.card.indicators.checkedIn"),
      hint: t("calendarTab.card.hints.checkedIn"),
    };
  }

  if (item.checkInStatus === "rejected") {
    return {
      tone: "danger" as const,
      label: t("calendarTab.card.indicators.checkInFailed"),
      hint: t("calendarTab.card.hints.checkInFailed"),
    };
  }

  if (item.status === "cancelled" || item.lifecycle === "cancelled") {
    return {
      tone: "danger" as const,
      label: t("calendarTab.card.indicators.cancelled"),
      hint: t("calendarTab.card.hints.cancelled"),
    };
  }

  if (isLive) {
    return {
      tone: "secondary" as const,
      label: t("calendarTab.card.indicators.arriveNow"),
      hint: t("calendarTab.card.hints.arriveNow"),
    };
  }

  if (canCheckIn) {
    return {
      tone: "warning" as const,
      label: t("calendarTab.card.indicators.getReady"),
      hint: t("calendarTab.card.hints.getReady"),
    };
  }

  if (item.lifecycle === "past") {
    return {
      tone: "muted" as const,
      label: t("calendarTab.card.indicators.complete"),
      hint: t("calendarTab.card.hints.complete"),
    };
  }

  return {
    tone: "good" as const,
    label: t("calendarTab.card.indicators.goodToGo"),
    hint: t("calendarTab.card.hints.goodToGo"),
  };
}

function CalendarTimelineItem({ item, isLive }: CalendarTimelineItemProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { color: palette } = theme;
  const { isSubmitting, submitCheckIn } = useLessonCheckIn();
  const { openCalendarLesson } = useSheetContext();
  const isLightTheme = theme.scheme === "light";
  const lightCardBg = "#FFFFFF";
  const lightCardBorder = "#E1D8CE";
  const lightText = "#1A1C1C";
  const lightTextMuted = "#444933";
  const lightTextSubtle = "#7A7A7A";
  const lightButtonBg = "#EEEEEE";
  const lightButtonBorder = "#D8CEC5";
  const lightButtonText = "#1A1C1C";
  const lightAccentContainer = "#CCFF00";
  const lightAccentContainerText = "#161E00";
  const lightPrimarySurface = "#F7FBE8";
  const lightPrimaryTint = "#CCFF0022";

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
  const tintFadeId = useMemo(() => `calendar-card-tint-${item.lessonId}`, [item.lessonId]);
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
  const indicator = useMemo(
    () => getTimelineIndicator(item, isLive, canCheckInWindow, t),
    [canCheckInWindow, isLive, item, t],
  );
  const indicatorColors = {
    good: {
      accentColor: isLightTheme ? lightAccentContainerText : palette.primary,
      backgroundColor: isLightTheme ? lightAccentContainer : palette.primary,
      labelColor: isLightTheme ? lightAccentContainerText : palette.onPrimary,
    },
    warning: {
      accentColor: palette.warning,
      backgroundColor: palette.warning,
      labelColor: palette.text,
    },
    secondary: {
      accentColor: palette.secondary,
      backgroundColor: palette.secondary,
      labelColor: "#FFFFFF",
    },
    danger: {
      accentColor: palette.danger,
      backgroundColor: palette.danger,
      labelColor: "#FFFFFF",
    },
    muted: {
      accentColor: palette.textMuted,
      backgroundColor: isLightTheme ? lightPrimarySurface : palette.surfaceAlt,
      labelColor: palette.textMuted,
    },
  }[indicator.tone];

  const handleOpenDetails = () => {
    if (!canOpenDetails) {
      return;
    }
    openCalendarLesson(item.lessonId, item.roleView as CalendarLessonSheetRole);
  };

  const handleCheckIn = () => {
    if (!canShowCheckIn) {
      return;
    }
    void submitCheckIn(item.lessonId as Id<"jobs">);
  };

  return (
    <Animated.View entering={FadeInUp.duration(200)} style={styles.container}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, { backgroundColor: palette.surface }]}>
          <View
            style={[
              styles.timelineDotInner,
              {
                backgroundColor: isCheckedIn
                  ? palette.primary
                  : hasRejectedCheckIn
                    ? palette.danger
                    : indicatorColors.accentColor,
              },
            ]}
          />
        </View>
      </View>

      <Pressable
        accessibilityRole={canOpenDetails ? "button" : undefined}
        disabled={!canOpenDetails}
        onPress={handleOpenDetails}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isLightTheme ? lightCardBg : palette.surfaceElevated,
            borderColor:
              item.source === "job"
                ? indicatorColors.accentColor
                : isLightTheme
                  ? lightCardBorder
                  : palette.outline,
            shadowColor: isLightTheme ? "#1A1C1C12" : palette.shadow,
            transform: [{ scale: canOpenDetails && pressed ? 0.992 : 1 }],
          },
        ]}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          {item.source === "job" ? (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: isLightTheme ? lightPrimaryTint : palette.primarySubtle,
                  opacity: isLightTheme ? 1 : 0.16,
                },
              ]}
            />
          ) : null}
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
                {
                  backgroundColor: isLightTheme ? palette.surfaceAlt : palette.surface,
                },
              ]}
            >
              <View style={styles.fallbackInitialWrap}>
                <Text
                  style={[
                    styles.fallbackInitial,
                    {
                      color: isLightTheme ? palette.primaryPressed : palette.primary,
                    },
                  ]}
                >
                  {fallbackLabel.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            </View>
          )}
          <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <SvgLinearGradient id={tintFadeId} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#000000" stopOpacity={isLightTheme ? 0.22 : 0.24} />
                <Stop offset="32%" stopColor="#000000" stopOpacity={isLightTheme ? 0.12 : 0.12} />
                <Stop offset="100%" stopColor="#000000" stopOpacity={isLightTheme ? 0.01 : 0.02} />
              </SvgLinearGradient>
              <SvgLinearGradient id={imageFadeId} x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop
                  offset="0%"
                  stopColor="#000000"
                  stopOpacity={isLightTheme ? "0.68" : "0.72"}
                />
                <Stop
                  offset="20%"
                  stopColor="#000000"
                  stopOpacity={isLightTheme ? "0.34" : "0.38"}
                />
                <Stop
                  offset="48%"
                  stopColor="#000000"
                  stopOpacity={isLightTheme ? "0.12" : "0.14"}
                />
                <Stop
                  offset="100%"
                  stopColor="#000000"
                  stopOpacity={isLightTheme ? "0.01" : "0.03"}
                />
              </SvgLinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${tintFadeId})`} />
            <Rect width="100%" height="100%" fill={`url(#${imageFadeId})`} />
          </Svg>
        </View>

        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.badgesRow}>
              <View style={[styles.badge, { backgroundColor: indicatorColors.backgroundColor }]}>
                <Text style={[styles.badgeText, { color: indicatorColors.labelColor }]}>
                  {indicator.label}
                </Text>
              </View>
              {item.source === "google" ? (
                <View style={[styles.badge, { backgroundColor: palette.tertiarySubtle }]}>
                  <Text style={[styles.badgeText, { color: palette.tertiary }]}>
                    {t("calendarTab.timeline.googleBadge")}
                  </Text>
                </View>
              ) : null}
              {isCheckedIn ? (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isLightTheme ? lightAccentContainer : palette.primarySubtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: isLightTheme ? lightAccentContainerText : palette.primary },
                    ]}
                  >
                    {t("calendarTab.card.indicators.checkedIn")}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[styles.cardTitle, { color: isLightTheme ? lightText : "#FFFFFF" }]}
              numberOfLines={1}
            >
              {sportLabel}
            </Text>
            <Text
              style={[styles.indicatorHint, { color: isLightTheme ? lightTextMuted : "#D9D2C8" }]}
              numberOfLines={2}
            >
              {indicator.hint}
            </Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={[styles.timeStart, { color: isLightTheme ? lightText : "#FFFFFF" }]}>
              {timeStartLabel}
            </Text>
            {timeEndLabel ? (
              <Text style={[styles.timeEnd, { color: isLightTheme ? lightTextSubtle : "#CEC7BD" }]}>
                {t("calendarTab.card.to")} {timeEndLabel}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.locationRow}>
          <IconSymbol
            name="location_on"
            size={14}
            color={isLightTheme ? lightTextMuted : "#D4CDC2"}
          />
          <Text
            style={[styles.locationText, { color: isLightTheme ? lightTextMuted : "#D9D2C8" }]}
            numberOfLines={1}
          >
            {counterpart}
          </Text>
        </View>

        {item.note ? (
          <View
            style={[
              styles.noteBox,
              {
                backgroundColor: isLightTheme ? lightPrimarySurface : palette.primarySubtle,
              },
            ]}
          >
            <Text style={[styles.noteLabel, { color: isLightTheme ? lightTextSubtle : "#BEB5A8" }]}>
              {t("calendarTab.card.noteLabel")}
            </Text>
            <Text
              style={[styles.noteText, { color: isLightTheme ? lightText : "#FFFFFF" }]}
              numberOfLines={2}
            >
              {item.note}
            </Text>
          </View>
        ) : null}

        <View style={styles.ctaRow}>
          <View
            style={[
              styles.ctaButton,
              {
                backgroundColor: isLightTheme ? lightButtonBg : "#161616",
                borderWidth: 1,
                borderColor: isLightTheme ? lightButtonBorder : "#2B2B2B",
              },
            ]}
          >
            <IconSymbol
              name={canOpenDetails ? "arrow_outward" : "calendar_today"}
              size={16}
              color={isLightTheme ? lightButtonText : "#FFFFFF"}
            />
            <Text style={[styles.ctaText, { color: isLightTheme ? lightButtonText : "#FFFFFF" }]}>
              {canOpenDetails ? t("calendarTab.card.viewDetails") : t("calendarTab.card.viewEvent")}
            </Text>
          </View>

          {canShowCheckIn ? (
            <Pressable
              onPress={handleCheckIn}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.ctaButton,
                {
                  backgroundColor: isLightTheme
                    ? lightAccentContainer
                    : isCheckedIn
                      ? palette.primaryPressed
                      : palette.primary,
                  transform: [{ scale: pressed && !isSubmitting ? 0.985 : 1 }],
                },
              ]}
            >
              <IconSymbol
                name="checkmark"
                size={16}
                color={isLightTheme ? lightAccentContainerText : palette.onPrimary}
              />
              <Text
                style={[
                  styles.ctaText,
                  { color: isLightTheme ? lightAccentContainerText : palette.onPrimary },
                ]}
              >
                {isSubmitting
                  ? t("common.loading")
                  : isCheckedIn
                    ? t("calendarTab.card.checkedIn")
                    : t("calendarTab.card.checkIn")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
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
    overflow: "hidden",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 10,
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
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandSpacing.xs,
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
    fontSize: BrandType.titleLarge.fontSize,
    fontWeight: "700",
    letterSpacing: -0.24,
  },
  indicatorHint: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
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
  noteBox: {
    borderRadius: BrandRadius.lg,
    paddingHorizontal: BrandSpacing.sm,
    paddingVertical: BrandSpacing.sm,
    gap: BrandSpacing.xxs,
  },
  noteLabel: {
    fontFamily: "Manrope_700Bold",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  noteText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
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
  fallbackInitialWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackInitial: {
    fontFamily: "Lexend_800ExtraBold",
    fontSize: 52,
    fontWeight: "800",
  },
});

export default memo(CalendarTimelineItem);
