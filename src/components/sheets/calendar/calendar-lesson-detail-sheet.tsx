/**
 * Calendar Lesson Detail Sheet — bottom sheet version of the lesson detail.
 *
 * Replaces the route-based calendar/[jobId] for taps from the calendar tab.
 * Uses BaseProfileSheet (BottomSheetModal) for presentation.
 */

import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { CalendarLessonSheetRole } from "@/contexts/sheet-context";
import { useTheme } from "@/hooks/use-theme";
import { formatTime } from "@/lib/jobs-utils";
import { Box } from "@/primitives";
import { useLessonCheckIn } from "@/components/calendar/use-lesson-check-in";

interface CalendarLessonDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  jobId: string | null;
  role: CalendarLessonSheetRole | null;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export function CalendarLessonDetailSheet({
  visible,
  onClose,
  jobId,
  role,
}: CalendarLessonDetailSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isSubmitting, submitCheckIn } = useLessonCheckIn();

  const detail = useQuery(
    api.jobs.getMyCalendarLessonDetail,
    jobId ? { jobId: jobId as Id<"jobs"> } : "skip",
  );

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

  const counterpartTitle =
    role === "instructor"
      ? detail.studioName
      : (detail.instructorName ?? t("calendarTab.unassignedInstructor"));
  const counterpartLabel =
    role === "instructor"
      ? t("calendarTab.detail.studioLabel")
      : t("calendarTab.detail.instructorLabel");
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
  const statusLabel = isCheckedIn
    ? t("calendarTab.card.indicators.checkedIn")
    : hasRejectedCheckIn
      ? t("calendarTab.card.indicators.checkInFailed")
      : detail.lifecycle === "live"
        ? t("calendarTab.card.indicators.arriveNow")
        : detail.lifecycle === "past"
          ? t("calendarTab.card.indicators.complete")
          : detail.lifecycle === "cancelled"
            ? t("calendarTab.card.indicators.cancelled")
            : t("calendarTab.card.indicators.goodToGo");
  const statusColor = isCheckedIn
    ? theme.color.primary
    : hasRejectedCheckIn
      ? theme.color.danger
      : detail.lifecycle === "live"
        ? theme.color.secondary
        : detail.lifecycle === "cancelled"
          ? theme.color.danger
          : detail.lifecycle === "past"
            ? theme.color.textMuted
            : theme.color.primary;
  const statusBackground = isCheckedIn
    ? theme.color.primarySubtle
    : hasRejectedCheckIn
      ? theme.color.dangerSubtle
      : detail.lifecycle === "live"
        ? theme.color.secondarySubtle
        : detail.lifecycle === "cancelled"
          ? theme.color.dangerSubtle
          : detail.lifecycle === "past"
            ? theme.color.surfaceAlt
            : theme.color.primarySubtle;

  const handleCheckIn = () => {
    if (!canCheckIn) {
      return;
    }
    void submitCheckIn(detail.lessonId as Id<"jobs">);
  };

  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <Box style={styles.contentContainer}>
        {/* Hero Card */}
        <Box
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.color.surfaceElevated,
              borderColor: theme.color.outline,
              shadowColor: theme.color.shadow,
            },
          ]}
        >
          <Box style={styles.heroTopRow}>
            <Box style={[styles.statusPill, { backgroundColor: statusBackground }]}>
              <ThemedText style={[styles.statusPillText, { color: statusColor }]}>
                {statusLabel}
              </ThemedText>
            </Box>
            <ThemedText style={[styles.payText, { color: theme.color.primary }]}>
              ₪{Math.round(detail.pay)}
            </ThemedText>
          </Box>

          <Box style={styles.heroBody}>
            <Box style={styles.infoRow}>
              <IconSymbol name="schedule" size={16} color={theme.color.textMuted} />
              <ThemedText style={[styles.infoText, { color: theme.color.text }]}>
                {formatTime(detail.startTime, "en-US")} - {formatTime(detail.endTime, "en-US")}
              </ThemedText>
            </Box>
            <Box style={styles.infoRow}>
              <IconSymbol name="location_on" size={16} color={theme.color.textMuted} />
              <ThemedText style={[styles.infoText, { color: theme.color.text }]}>
                {detail.zone}
              </ThemedText>
            </Box>
          </Box>
        </Box>

        {/* Counterpart */}
        <Box
          style={[
            styles.sectionCard,
            {
              backgroundColor: theme.color.surfaceElevated,
              borderColor: theme.color.outline,
            },
          ]}
        >
          <ThemedText style={[styles.sectionLabel, { color: theme.color.textMuted }]}>
            {counterpartLabel}
          </ThemedText>
          <ThemedText style={[styles.sectionTitle, { color: theme.color.text }]}>
            {counterpartTitle}
          </ThemedText>
        </Box>

        {/* Check-in status */}
        {detail.checkInStatus ? (
          <Box
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.color.surfaceElevated,
                borderColor: isCheckedIn ? theme.color.primary : theme.color.outline,
              },
            ]}
          >
            <ThemedText style={[styles.sectionLabel, { color: theme.color.textMuted }]}>
              {t("calendarTab.card.checkIn")}
            </ThemedText>
            <ThemedText
              style={[
                styles.sectionTitle,
                {
                  color: isCheckedIn ? theme.color.primary : theme.color.text,
                },
              ]}
            >
              {isCheckedIn
                ? t("calendarTab.card.checkInVerifiedTitle")
                : t("calendarTab.card.checkInRetryTitle")}
            </ThemedText>
            <ThemedText style={[styles.noteBody, { color: theme.color.textMuted }]}>
              {isCheckedIn
                ? t("calendarTab.card.checkInVerifiedBody", {
                    distance: Math.max(0, Math.round(detail.checkInDistanceMeters ?? 0)),
                  })
                : detail.checkInReason
                  ? t(`calendarTab.card.checkInReasons.${detail.checkInReason}` as never)
                  : t("calendarTab.card.checkInReasons.unknown")}
            </ThemedText>
          </Box>
        ) : null}

        {/* Note */}
        {detail.note ? (
          <Box
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.color.surfaceElevated,
                borderColor: theme.color.outline,
              },
            ]}
          >
            <ThemedText style={[styles.sectionLabel, { color: theme.color.textMuted }]}>
              {t("calendarTab.card.noteLabel")}
            </ThemedText>
            <ThemedText style={[styles.noteBody, { color: theme.color.text }]}>
              {detail.note}
            </ThemedText>
          </Box>
        ) : null}

        {/* Actions */}
        <Box style={styles.actionsRow}>
          <ActionButton label={t("common.close")} tone="secondary" fullWidth onPress={onClose} />
          {canCheckIn ? (
            <ActionButton
              label={isSubmitting ? t("common.loading") : t("calendarTab.card.checkIn")}
              fullWidth
              onPress={handleCheckIn}
            />
          ) : null}
        </Box>
      </Box>
    </BaseProfileSheet>
  );
}

const styles = StyleSheet.create(() => ({
  contentContainer: {
    gap: BrandSpacing.md,
  },
  heroCard: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    padding: BrandSpacing.lg,
    gap: BrandSpacing.md,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 10,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandSpacing.sm,
  },
  statusPill: {
    borderRadius: BrandRadius.pill,
    paddingHorizontal: BrandSpacing.sm,
    paddingVertical: BrandSpacing.xs,
  },
  statusPillText: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  payText: {
    fontFamily: "Lexend_800ExtraBold",
    fontSize: BrandType.heading.fontSize,
    fontWeight: "800",
  },
  heroBody: {
    gap: BrandSpacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
  infoText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: BrandType.body.fontSize,
    fontWeight: "600",
  },
  sectionCard: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    padding: BrandSpacing.md,
    gap: BrandSpacing.xs,
  },
  sectionLabel: {
    fontFamily: "Manrope_700Bold",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionTitle: {
    fontFamily: "Lexend_700Bold",
    fontSize: BrandType.titleLarge.fontSize,
    fontWeight: "700",
  },
  noteBody: {
    fontFamily: "Manrope_500Medium",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  actionsRow: {
    gap: BrandSpacing.sm,
  },
}));
