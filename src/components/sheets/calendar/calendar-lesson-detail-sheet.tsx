/**
 * Calendar Lesson Detail Sheet — bottom sheet version of the lesson detail.
 *
 * Sporty, bold, in-your-face design. Tapping studio name opens the studio's
 * public profile as a bottom sheet.
 */

import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useQuery } from "convex/react";
import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { LoadingScreen } from "@/components/loading-screen";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { FontFamily, FontSize, LetterSpacing } from "@/theme/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { CalendarLessonSheetRole } from "@/contexts/sheet-context";
import { useTheme } from "@/hooks/use-theme";
import type { ThemeColors } from "@/theme/theme";
import { formatTime } from "@/lib/jobs-utils";
import { toSportLabelI18n } from "@/lib/sport-i18n";
import { Box, Text } from "@/primitives";
import { useLessonCheckIn } from "@/components/calendar/use-lesson-check-in";
import { useSheetContext } from "@/contexts/sheet-context";

interface CalendarLessonDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  jobId: string | null;
  role: CalendarLessonSheetRole | null;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export const CalendarLessonDetailSheet = memo(function CalendarLessonDetailSheet({
  visible,
  onClose,
  jobId,
  role,
}: CalendarLessonDetailSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { openStudioPublicProfile } = useSheetContext();
  const { isSubmitting, submitCheckIn } = useLessonCheckIn();

  const detail = useQuery(
    api.jobs.getMyCalendarLessonDetail,
    jobId ? { jobId: jobId as Id<"jobs"> } : "skip",
  );

  // Hooks must be called before any early returns
  const handleStudioPress = useCallback(() => {
    if (!detail?.studioSlug) return;
    openStudioPublicProfile(detail.studioSlug);
  }, [openStudioPublicProfile, detail?.studioSlug]);

  if (!jobId || !role || detail === undefined) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("calendarTab.loading")} />
      </BaseProfileSheet>
    );
  }

  if (!detail) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("calendarTab.detail.unavailable")} />
      </BaseProfileSheet>
    );
  }

  const isStudio = detail.roleView === "instructor";
  const counterpartName = isStudio
    ? detail.studioName
    : (detail.instructorName ?? t("calendarTab.unassignedInstructor"));
  const counterpartImageUrl = isStudio
    ? detail.studioProfileImageUrl
    : detail.instructorProfileImageUrl;

  const now = Date.now();
  const isCheckedIn = detail.checkInStatus === "verified";
  const hasRejectedCheckIn = detail.checkInStatus === "rejected";
  const canCheckInWindow = detail.startTime - now <= ONE_HOUR_MS && detail.endTime >= now;
  const canCheckIn =
    role === "instructor" &&
    canCheckInWindow &&
    detail.lifecycle !== "past" &&
    detail.lifecycle !== "cancelled" &&
    !isCheckedIn;

  const statusDef = getStatusDef(detail, isCheckedIn, hasRejectedCheckIn, t);
  const sportLabel = toSportLabelI18n(detail.sport, t);
  const timeLabel = `${formatTime(detail.startTime, "en-US")} – ${formatTime(detail.endTime, "en-US")}`;

  const handleCheckIn = () => {
    if (!canCheckIn) return;
    void submitCheckIn(detail.lessonId as Id<"jobs">);
  };

  return (
    <BaseProfileSheet visible={visible} onClose={onClose} snapPoints={["70%"]}>
      <BottomSheetScrollView contentContainerStyle={{ gap: BrandSpacing.lg }}>
        <Animated.View entering={FadeIn.duration(180)}>
          {/* ── Status Banner ── */}
          <Box style={[styles.statusBanner, { backgroundColor: statusDef.bg(theme.color) }]}>
            <Box style={styles.statusBannerInner}>
              <View style={[styles.statusDot, { backgroundColor: statusDef.dot(theme.color) }]} />
              <Text variant="labelStrong" style={{ color: statusDef.fg(theme.color) }}>
                {statusDef.label}
              </Text>
            </Box>
            <Text variant="micro" style={{ color: statusDef.fg(theme.color) }}>
              {statusDef.hint}
            </Text>
          </Box>

          {/* ── Sport + Pay Hero ── */}
          <Box style={styles.heroRow}>
            <Box style={styles.heroLeft}>
              <Text variant="titleLarge" color="text" numberOfLines={1}>
                {sportLabel}
              </Text>
              <Box style={styles.timeRow}>
                <IconSymbol name="schedule" size={14} color={theme.color.textMuted} />
                <Text variant="caption" color="textMuted">
                  {timeLabel}
                </Text>
              </Box>
            </Box>
            <Box style={styles.payBadge}>
              <Text style={styles.payAmount}>₪{Math.round(detail.pay)}</Text>
            </Box>
          </Box>

          {/* ── Location ── */}
          <Box style={styles.locationRow}>
            <IconSymbol name="location_on" size={16} color={theme.color.textMuted} />
            <Text variant="bodyMedium" color="textMuted" numberOfLines={1}>
              {detail.zone}
            </Text>
          </Box>

          {/* ── Counterpart (Studio / Instructor) ── */}
          <Pressable
            onPress={isStudio ? handleStudioPress : undefined}
            disabled={!isStudio}
            accessibilityRole={isStudio ? "button" : undefined}
            accessibilityHint={isStudio ? t("calendarTab.detail.viewStudioHint") : undefined}
            style={({ pressed }) => [
              styles.counterpartCard,
              {
                backgroundColor: theme.color.surfaceElevated,
                borderColor: theme.color.border,
                transform: [{ scale: isStudio && pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <ProfileAvatar
              imageUrl={counterpartImageUrl}
              fallbackName={counterpartName}
              size={44}
              roundedSquare={false}
              fallbackIcon={isStudio ? "building.2.fill" : "person.fill"}
              accessibilityLabel={counterpartName}
            />
            <Box style={styles.counterpartInfo}>
              <Text variant="micro" color="textMuted" style={styles.counterpartLabel}>
                {isStudio
                  ? t("calendarTab.detail.studioLabel")
                  : t("calendarTab.detail.instructorLabel")}
              </Text>
              <Box style={styles.counterpartNameRow}>
                <Text variant="bodyStrong" color="text" numberOfLines={1}>
                  {counterpartName}
                </Text>
                {isStudio ? (
                  <IconSymbol name="chevron.right" size={16} color={theme.color.textMicro} />
                ) : null}
              </Box>
            </Box>
          </Pressable>

          {/* ── Check-in Result ── */}
          {detail.checkInStatus ? (
            <Box
              style={[
                styles.checkInCard,
                {
                  backgroundColor: isCheckedIn
                    ? theme.color.primarySubtle
                    : theme.color.dangerSubtle,
                  borderColor: isCheckedIn ? theme.color.primary : theme.color.danger,
                },
              ]}
            >
              <Box style={styles.checkInHeader}>
                <IconSymbol
                  name={isCheckedIn ? "checkmark.circle.fill" : "exclamationmark.circle.fill"}
                  size={20}
                  color={isCheckedIn ? theme.color.primary : theme.color.danger}
                />
                <Text
                  variant="bodyStrong"
                  style={{ color: isCheckedIn ? theme.color.primary : theme.color.danger }}
                >
                  {isCheckedIn
                    ? t("calendarTab.card.checkInVerifiedTitle")
                    : t("calendarTab.card.checkInRetryTitle")}
                </Text>
              </Box>
              <Text variant="caption" color="textMuted" style={styles.checkInBody}>
                {isCheckedIn
                  ? t("calendarTab.card.checkInVerifiedBody", {
                      distance: Math.max(0, Math.round(detail.checkInDistanceMeters ?? 0)),
                    })
                  : detail.checkInReason
                    ? t(`calendarTab.card.checkInReasons.${detail.checkInReason}` as never)
                    : t("calendarTab.card.checkInReasons.unknown")}
              </Text>
            </Box>
          ) : null}

          {/* ── Instructor Note ── */}
          {detail.note ? (
            <Box
              style={[
                styles.noteCard,
                {
                  backgroundColor: theme.color.surfaceAlt,
                  borderColor: theme.color.border,
                },
              ]}
            >
              <Text variant="micro" color="textMicro" style={styles.noteLabel}>
                {t("calendarTab.card.noteLabel")}
              </Text>
              <Text variant="body" color="text" style={styles.noteBody}>
                {detail.note}
              </Text>
            </Box>
          ) : null}

          {/* ── Check-in CTA ── */}
          {canCheckIn ? (
            <Pressable
              onPress={handleCheckIn}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.checkInButton,
                {
                  backgroundColor: theme.color.primary,
                  transform: [{ scale: pressed && !isSubmitting ? 0.97 : 1 }],
                  opacity: isSubmitting ? 0.7 : 1,
                },
              ]}
            >
              <IconSymbol name="checkmark" size={20} color={theme.color.onPrimary} />
              <Text variant="labelStrong" style={{ color: theme.color.onPrimary }}>
                {isSubmitting ? t("common.loading") : t("calendarTab.card.checkIn")}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </BottomSheetScrollView>
    </BaseProfileSheet>
  );
});

// ── Status helpers ──────────────────────────────────────────────────────────

type ColorAccessor = (c: ThemeColors) => string;

type StatusDef = {
  label: string;
  hint: string;
  dot: ColorAccessor;
  fg: ColorAccessor;
  bg: ColorAccessor;
};

function getStatusDef(
  detail: {
    lifecycle: string;
    checkInStatus?: string;
  },
  isCheckedIn: boolean,
  hasRejectedCheckIn: boolean,
  t: (k: string) => string,
): StatusDef {
  if (isCheckedIn) {
    return {
      label: t("calendarTab.card.indicators.checkedIn"),
      hint: t("calendarTab.card.hints.checkedIn"),
      dot: (c) => c.primary,
      fg: (c) => c.primary,
      bg: (c) => c.primarySubtle,
    };
  }
  if (hasRejectedCheckIn) {
    return {
      label: t("calendarTab.card.indicators.checkInFailed"),
      hint: t("calendarTab.card.hints.checkInFailed"),
      dot: (c) => c.danger,
      fg: (c) => c.danger,
      bg: (c) => c.dangerSubtle,
    };
  }
  if (detail.lifecycle === "cancelled") {
    return {
      label: t("calendarTab.card.indicators.cancelled"),
      hint: t("calendarTab.card.hints.cancelled"),
      dot: (c) => c.danger,
      fg: (c) => c.danger,
      bg: (c) => c.dangerSubtle,
    };
  }
  if (detail.lifecycle === "live") {
    return {
      label: t("calendarTab.card.indicators.arriveNow"),
      hint: t("calendarTab.card.hints.arriveNow"),
      dot: (c) => c.secondary,
      fg: (c) => c.secondary,
      bg: (c) => c.secondarySubtle,
    };
  }
  if (detail.lifecycle === "past") {
    return {
      label: t("calendarTab.card.indicators.complete"),
      hint: t("calendarTab.card.hints.complete"),
      dot: (c) => c.textMuted,
      fg: (c) => c.textMuted,
      bg: (c) => c.surfaceAlt,
    };
  }
  return {
    label: t("calendarTab.card.indicators.goodToGo"),
    hint: t("calendarTab.card.hints.goodToGo"),
    dot: (c) => c.primary,
    fg: (c) => c.primary,
    bg: (c) => c.primarySubtle,
  };
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create((theme) => ({
  statusBanner: {
    borderRadius: BrandRadius.card,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.sm,
    gap: BrandSpacing.xxs,
    marginBottom: BrandSpacing.md,
  },
  statusBannerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: BrandSpacing.md,
    marginBottom: BrandSpacing.sm,
  },
  heroLeft: {
    flex: 1,
    gap: BrandSpacing.xxs,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
  payBadge: {
    backgroundColor: theme.color.primary,
    borderRadius: BrandRadius.buttonSubtle,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  payAmount: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.title,
    fontWeight: "800",
    color: theme.color.onPrimary,
    letterSpacing: LetterSpacing.title,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
    marginBottom: BrandSpacing.md,
    paddingBottom: BrandSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  counterpartCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    padding: BrandSpacing.md,
    marginBottom: BrandSpacing.md,
  },
  counterpartInfo: {
    flex: 1,
    gap: BrandSpacing.xxs,
  },
  counterpartLabel: {
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  },
  counterpartNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xxs,
  },
  checkInCard: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    padding: BrandSpacing.md,
    gap: BrandSpacing.xs,
    marginBottom: BrandSpacing.md,
  },
  checkInHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
  checkInBody: {
    lineHeight: 18,
  },
  noteCard: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    padding: BrandSpacing.md,
    gap: BrandSpacing.xs,
    marginBottom: BrandSpacing.md,
  },
  noteLabel: {
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  },
  noteBody: {
    lineHeight: 20,
  },
  checkInButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: BrandSpacing.sm,
    borderRadius: BrandRadius.button,
    paddingVertical: BrandSpacing.md + 2,
    marginTop: BrandSpacing.xs,
    marginBottom: BrandSpacing.xxl,
  },
}));
