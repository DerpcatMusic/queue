import { useQuery } from "convex/react";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import {
  createContentDrivenTopSheetConfig,
  useGlobalTopSheet,
} from "@/components/layout/top-sheet-registry";
import { LoadingScreen } from "@/components/loading-screen";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
import { formatTime } from "@/lib/jobs-utils";
import { Box } from "@/primitives";
import { useLessonCheckIn } from "./use-lesson-check-in";

type CalendarLessonDetailScreenProps = {
  actorRole: "instructor" | "studio";
};

const ONE_HOUR_MS = 60 * 60 * 1000;
export function CalendarLessonDetailScreen({ actorRole: role }: CalendarLessonDetailScreenProps) {
  const params = useLocalSearchParams<{ jobId?: string }>();
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const { isSubmitting, submitCheckIn } = useLessonCheckIn();

  const detail = useQuery(
    api.jobs.getMyCalendarLessonDetail,
    jobId ? { jobId: jobId as Id<"jobs"> } : "skip",
  );

  const handleStudioPress = useCallback(() => {
    if (!detail?.studioId || role !== "instructor") return;
    router.push(`/instructor/jobs/studios/${detail.studioId}`);
  }, [detail?.studioId, role, router]);

  const title = detail ? toSportLabel(detail.sport as never) : t("calendarTab.detail.title");
  const topSheetBackgroundColor = theme.color.primary;
  const topSheetForegroundColor = theme.color.onPrimary;
  const topSheetConfig = useMemo(
    () =>
      pathname
        ? createContentDrivenTopSheetConfig({
            stickyHeader: (
              <Box style={styles.sheetHeader}>
                <Box style={styles.sheetHeaderRow}>
                  <IconButton
                    accessibilityLabel={t("common.close")}
                    onPress={() => router.back()}
                    tone="secondary"
                    size={44}
                    icon={
                      <IconSymbol name="chevron.left" size={18} color={topSheetForegroundColor} />
                    }
                  />
                  <ThemedText
                    numberOfLines={1}
                    style={[BrandType.title, styles.sheetHeaderTitle(topSheetForegroundColor)]}
                  >
                    {title}
                  </ThemedText>
                  <Box style={styles.sheetHeaderSpacer} />
                </Box>
              </Box>
            ),
            padding: {
              vertical: 0,
              horizontal: 0,
            },
            backgroundColor: topSheetBackgroundColor,
            topInsetColor: topSheetBackgroundColor,
            style: {
              borderColor: topSheetBackgroundColor,
              borderBottomColor: topSheetBackgroundColor,
              borderLeftColor: topSheetBackgroundColor,
              borderRightColor: topSheetBackgroundColor,
            },
          })
        : null,
    [pathname, router, t, title, topSheetBackgroundColor, topSheetForegroundColor],
  );

  useGlobalTopSheet("calendar", topSheetConfig, `calendar-detail:${pathname}`, {
    routeMatchPath: pathname ?? undefined,
    routeMatchExact: true,
  });

  if (!jobId || detail === undefined) {
    return <LoadingScreen label={t("calendarTab.loading")} />;
  }

  if (!detail) {
    return <LoadingScreen label={t("calendarTab.detail.unavailable")} />;
  }

  const counterpartImageUrl =
    role === "instructor"
      ? detail.studioProfileImageUrl
      : (detail as any).instructorProfileImageUrl;

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
    <TabScreenScrollView
      topInsetTone="sheet"
      sheetInsets={{ topSpacing: 0, bottomSpacing: BrandSpacing.xxl }}
      contentContainerStyle={styles.contentContainer}
    >
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

      <Pressable
        onPress={role === "instructor" ? handleStudioPress : undefined}
        disabled={role !== "instructor"}
        style={({ pressed }) => [
          styles.counterpartCard,
          {
            backgroundColor: theme.color.surfaceElevated,
            borderColor: theme.color.outline,
            transform: [{ scale: role === "instructor" && pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <ProfileAvatar
          imageUrl={counterpartImageUrl}
          fallbackName={counterpartTitle}
          size={44}
          roundedSquare={false}
          fallbackIcon={role === "instructor" ? "building.2.fill" : "person.fill"}
          accessibilityLabel={counterpartTitle}
        />
        <Box style={styles.counterpartInfo}>
          <ThemedText style={[styles.sectionLabel, { color: theme.color.textMuted }]}>
            {counterpartLabel}
          </ThemedText>
          <Box style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xxs }}>
            <ThemedText style={[styles.sectionTitle, { color: theme.color.text }]}>
              {counterpartTitle}
            </ThemedText>
            {role === "instructor" ? (
              <IconSymbol name="chevron.right" size={16} color={theme.color.textMicro} />
            ) : null}
          </Box>
        </Box>
      </Pressable>

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

      <Box style={styles.actionsRow}>
        <ActionButton
          label={t("common.close")}
          tone="secondary"
          fullWidth
          onPress={() => router.back()}
        />
        {canCheckIn ? (
          <ActionButton
            label={isSubmitting ? t("common.loading") : t("calendarTab.card.checkIn")}
            fullWidth
            onPress={handleCheckIn}
          />
        ) : null}
      </Box>
    </TabScreenScrollView>
  );
}

const styles = StyleSheet.create(() => ({
  sheetHeader: {
    paddingHorizontal: BrandSpacing.inset,
    paddingTop: BrandSpacing.sm,
    paddingBottom: BrandSpacing.md,
  },
  sheetHeaderRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
  },
  sheetHeaderTitle: (color: string) => ({
    color,
    flex: 1,
    textAlign: "center",
  }),
  sheetHeaderSpacer: {
    width: 36,
    height: 36,
  },
  contentContainer: {
    gap: BrandSpacing.md,
    paddingHorizontal: BrandSpacing.inset,
  },
  heroCard: {
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    padding: BrandSpacing.lg,
    gap: BrandSpacing.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
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
  counterpartCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    padding: BrandSpacing.md,
  },
  counterpartInfo: {
    flex: 1,
    gap: BrandSpacing.xxs,
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
