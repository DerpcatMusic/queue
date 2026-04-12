/**
 * Calendar Lesson Detail Sheet — shows job details when tapping calendar item.
 *
 * Design principles:
 * - Single snap point, no jumping
 * - Icon + color coding for quick status recognition
 * - Material symbols for semantic meaning
 * - Zone name (not zip code)
 * - Studio name is tappable to open public profile
 * - Past jobs show payout info
 */

import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useQuery } from "convex/react";
import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { useLessonCheckIn } from "@/components/calendar/use-lesson-check-in";
import { LoadingScreen } from "@/components/loading-screen";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { CalendarLessonSheetRole } from "@/contexts/sheet-context";
import { useSheetContext } from "@/contexts/sheet-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTheme } from "@/hooks/use-theme";
import { formatTime } from "@/lib/jobs-utils";
import { toSportLabelI18n } from "@/lib/sport-i18n";
import { Text } from "@/primitives";
import { FontFamily, FontSize } from "@/theme/theme";

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
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { openStudioPublicProfile } = useSheetContext();
  const { isSubmitting, submitCheckIn } = useLessonCheckIn();

  const detail = useQuery(
    api.jobs.getMyCalendarLessonDetail,
    jobId ? { jobId: jobId as Id<"jobs"> } : "skip",
  );

  // Hooks before early returns
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

  const isInstructor = role === "instructor";
  const sportLabel = toSportLabelI18n(detail.sport, t);
  const timeLabel = `${formatTime(detail.startTime, "en-US")} – ${formatTime(detail.endTime, "en-US")}`;

  // Zone label - use readable name instead of zip
  const zoneLanguage = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";
  const zoneLabel = getZoneLabel(detail.zone, zoneLanguage);

  // Status computation
  const now = Date.now();
  const isCheckedIn = detail.checkInStatus === "verified";
  const hasRejectedCheckIn = detail.checkInStatus === "rejected";
  const isPast = detail.lifecycle === "past";
  const isLive = detail.lifecycle === "live";
  const isCancelled = detail.lifecycle === "cancelled";
  const canCheckInWindow = detail.startTime - now <= ONE_HOUR_MS && detail.endTime >= now;
  const canCheckIn = isInstructor && canCheckInWindow && !isPast && !isCancelled && !isCheckedIn;

  // Status icon and color
  const statusIcon = isCheckedIn
    ? "checkmark.circle.fill"
    : hasRejectedCheckIn
      ? "xmark.circle.fill"
      : isCancelled
        ? "xmark.circle.fill"
        : isLive
          ? "bolt.fill"
          : isPast
            ? "clock.fill"
            : "calendar";
  const statusColor = isCheckedIn
    ? theme.color.primary
    : hasRejectedCheckIn
      ? theme.color.danger
      : isCancelled
        ? theme.color.danger
        : isLive
          ? theme.color.secondary
          : isPast
            ? theme.color.textMuted
            : theme.color.primary;

  const statusLabel = isCheckedIn
    ? t("calendarTab.card.indicators.checkedIn")
    : hasRejectedCheckIn
      ? t("calendarTab.card.indicators.checkInFailed")
      : isCancelled
        ? t("calendarTab.card.indicators.cancelled")
        : isLive
          ? t("calendarTab.card.indicators.arriveNow")
          : isPast
            ? t("calendarTab.card.indicators.complete")
            : t("calendarTab.card.indicators.goodToGo");

  const handleCheckIn = () => {
    if (!canCheckIn) return;
    void submitCheckIn(detail.lessonId as Id<"jobs">);
  };

  return (
    <BaseProfileSheet visible={visible} onClose={onClose} snapPoints={["70%"]}>
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(180)} style={styles.content}>
          {/* ── Status Row (icon + label + color) ── */}
          <View style={styles.statusRow}>
            <View style={[styles.statusIconWrap, { backgroundColor: statusColor + "20" }]}>
              <IconSymbol name={statusIcon} size={18} color={statusColor} />
            </View>
            <Text variant="labelStrong" style={{ color: statusColor }}>
              {statusLabel}
            </Text>
          </View>

          {/* ── Sport + Pay ── */}
          <View style={styles.heroSection}>
            <View style={styles.heroLeft}>
              <Text variant="titleLarge" color="text" numberOfLines={1}>
                {sportLabel}
              </Text>
              <View style={styles.timeRow}>
                <IconSymbol name="schedule" size={14} color={theme.color.textMuted} />
                <Text variant="caption" color="textMuted">
                  {timeLabel}
                </Text>
              </View>
            </View>
            <View style={styles.paySection}>
              <Text style={styles.payAmount}>₪{Math.round(detail.pay)}</Text>
              {isPast && (
                <Text variant="micro" color="textMuted">
                  {t("calendarTab.detail.paidOut", { defaultValue: "Paid" })}
                </Text>
              )}
            </View>
          </View>

          {/* ── Location (icon + name) ── */}
          <View style={styles.locationRow}>
            <IconSymbol name="location_on" size={16} color={theme.color.textMuted} />
            <Text variant="bodyMedium" color="textMuted" numberOfLines={1}>
              {zoneLabel}
            </Text>
          </View>

          {/* ── Studio/Instructor (tappable) ── */}
          <Pressable
            onPress={isInstructor ? handleStudioPress : undefined}
            disabled={!isInstructor}
            accessibilityRole={isInstructor ? "button" : undefined}
            accessibilityHint={isInstructor ? t("calendarTab.detail.viewStudioHint") : undefined}
            style={({ pressed }) => [
              styles.counterpartRow,
              pressed && isInstructor && styles.pressed,
            ]}
          >
            <ProfileAvatar
              imageUrl={
                isInstructor ? detail.studioProfileImageUrl : detail.instructorProfileImageUrl
              }
              fallbackName={isInstructor ? detail.studioName : (detail.instructorName ?? "")}
              size={40}
              roundedSquare={false}
              fallbackIcon={isInstructor ? "building.2.fill" : "person.fill"}
            />
            <View style={styles.counterpartInfo}>
              <Text variant="micro" color="textMuted">
                {isInstructor
                  ? t("calendarTab.detail.studioLabel")
                  : t("calendarTab.detail.instructorLabel")}
              </Text>
              <View style={styles.counterpartNameRow}>
                <Text variant="bodyStrong" color="text" numberOfLines={1}>
                  {isInstructor
                    ? detail.studioName
                    : (detail.instructorName ?? t("calendarTab.unassignedInstructor"))}
                </Text>
                {isInstructor && (
                  <IconSymbol name="chevron.right" size={16} color={theme.color.textMicro} />
                )}
              </View>
            </View>
          </Pressable>

          {/* ── Check-in Result ── */}
          {detail.checkInStatus ? (
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: isCheckedIn
                    ? theme.color.primarySubtle
                    : theme.color.dangerSubtle,
                },
              ]}
            >
              <View style={styles.resultHeader}>
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
              </View>
              <Text variant="caption" color="textMuted">
                {isCheckedIn
                  ? t("calendarTab.card.checkInVerifiedBody", {
                      distance: Math.max(0, Math.round(detail.checkInDistanceMeters ?? 0)),
                    })
                  : detail.checkInReason
                    ? t(`calendarTab.card.checkInReasons.${detail.checkInReason}` as never)
                    : t("calendarTab.card.checkInReasons.unknown")}
              </Text>
            </View>
          ) : null}

          {/* ── Note ── */}
          {detail.note ? (
            <View style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <IconSymbol name="note.text" size={14} color={theme.color.textMuted} />
                <Text variant="micro" color="textMuted">
                  {t("calendarTab.card.noteLabel")}
                </Text>
              </View>
              <Text variant="body" color="text">
                {detail.note}
              </Text>
            </View>
          ) : null}

          {/* ── Check-in Button ── */}
          {canCheckIn ? (
            <Pressable
              onPress={handleCheckIn}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.checkInButton,
                pressed && styles.checkInButtonPressed,
                isSubmitting && styles.checkInButtonDisabled,
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

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create((theme) => ({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: BrandSpacing.lg,
    paddingTop: BrandSpacing.lg,
    paddingBottom: BrandSpacing.xxl * 2,
  },
  content: {
    gap: BrandSpacing.lg,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.sm,
  },
  statusIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heroSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: BrandSpacing.md,
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
  paySection: {
    alignItems: "flex-end",
    gap: 2,
  },
  payAmount: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.heading,
    fontWeight: "800",
    color: theme.color.primary,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
  counterpartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
    padding: BrandSpacing.sm,
    borderRadius: BrandRadius.card,
  },
  pressed: {
    opacity: 0.7,
  },
  counterpartInfo: {
    flex: 1,
    gap: 2,
  },
  counterpartNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xxs,
  },
  resultCard: {
    borderRadius: BrandRadius.card,
    padding: BrandSpacing.md,
    gap: BrandSpacing.xs,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
  noteCard: {
    gap: BrandSpacing.xs,
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
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
    backgroundColor: theme.color.primary,
  },
  checkInButtonPressed: {
    opacity: 0.8,
  },
  checkInButtonDisabled: {
    opacity: 0.5,
  },
}));
