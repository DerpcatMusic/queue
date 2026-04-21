import { Image as ExpoImage } from "expo-image";
import type { TFunction } from "i18next";
import { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import type { Id } from "@/convex/_generated/dataModel";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth, FontFamily, FontSize, LineHeight } from "@/lib/design-system";
import { formatTime } from "@/lib/jobs-utils";
import { Box, Text } from "@/primitives";

export type InstructorCurrentLesson = {
  applicationId: Id<"jobApplications">;
  jobId: Id<"jobs">;
  studioId: Id<"studioProfiles">;
  branchId: Id<"studioBranches">;
  studioName: string;
  branchName: string;
  branchAddress?: string;
  branchLatitude?: number;
  branchLongitude?: number;
  studioImageUrl?: string | null;
  sport: string;
  startTime: number;
  endTime: number;
  timeZone?: string;
  status: "open" | "filled" | "cancelled" | "completed";
  applicationStatus: "accepted";
  checkedInAt?: number;
  checkInStatus?: "verified" | "rejected";
  checkInReason?:
    | "verified"
    | "outside_radius"
    | "accuracy_too_low"
    | "sample_too_old"
    | "outside_check_in_window"
    | "branch_location_missing";
  checkInDistanceMeters?: number;
  note?: string;
  closureReason?: "expired" | "studio_cancelled" | "filled";
};

function LessonArt({
  imageUrl,
  fallbackLabel,
}: {
  imageUrl?: string | null;
  fallbackLabel: string;
}) {
  const theme = useTheme();
  const initials = fallbackLabel
    .split(" ")
    .map((part) => part.trim().slice(0, 1))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View
      style={{
        width: 54,
        height: 54,
        borderRadius: BrandRadius.cardSubtle,
        borderCurve: "continuous",
        overflow: "hidden",
        backgroundColor: theme.color.surfaceMuted,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {imageUrl ? (
        <ExpoImage
          source={{ uri: imageUrl }}
          contentFit="cover"
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <Text
          style={{
            ...BrandType.bodyStrong,
            color: theme.color.primary,
          }}
        >
          {initials || "?"}
        </Text>
      )}
    </View>
  );
}

function CurrentLessonCard({
  lesson,
  now,
  locale,
  t,
  onCheckIn,
  onComplete,
  checkingIn = false,
  isSubmitting = false,
}: {
  lesson: InstructorCurrentLesson;
  now: number;
  locale: string;
  t: TFunction;
  onCheckIn: (lesson: InstructorCurrentLesson) => void;
  onComplete: (lesson: InstructorCurrentLesson) => void;
  checkingIn?: boolean;
  isSubmitting?: boolean;
}) {
  const theme = useTheme();
  const hasVerifiedCheckIn = lesson.checkInStatus === "verified";
  const canCompleteNow = now + 5 * 60 * 1000 >= lesson.endTime && hasVerifiedCheckIn;
  const canCheckInNow = !hasVerifiedCheckIn && !checkingIn;
  const timeLabel = `${formatTime(lesson.startTime, locale)} — ${formatTime(lesson.endTime, locale)}`;

  return (
    <View
      style={{
        gap: BrandSpacing.md,
        padding: BrandSpacing.lg,
        borderRadius: BrandRadius.card,
        borderCurve: "continuous",
        backgroundColor: theme.color.surfaceElevated,
        borderWidth: BorderWidth.thin,
        borderColor: canCompleteNow ? theme.color.primarySubtle : theme.color.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.md }}>
        <LessonArt imageUrl={lesson.studioImageUrl} fallbackLabel={lesson.studioName} />
        <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
          <Text
            numberOfLines={1}
            style={{
              ...BrandType.title,
              color: theme.color.text,
            }}
          >
            {lesson.sport}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: FontFamily.bodyMedium,
              fontSize: FontSize.caption,
              lineHeight: LineHeight.caption,
              color: theme.color.textMuted,
            }}
          >
            {lesson.studioName} · {lesson.branchName}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: BrandSpacing.sm,
            paddingVertical: BrandSpacing.xxs,
            borderRadius: BrandRadius.pill,
            borderCurve: "continuous",
            backgroundColor: canCompleteNow ? theme.color.successSubtle : theme.color.surfaceMuted,
          }}
        >
          <Text
            style={{
              ...BrandType.micro,
              color: canCompleteNow ? theme.color.success : theme.color.textMuted,
            }}
          >
            {canCompleteNow
              ? t("jobsTab.instructorFeed.readyToComplete", {
                  defaultValue: "Ready to complete",
                })
              : hasVerifiedCheckIn
                ? t("jobsTab.instructorFeed.completeNearEnd", {
                    defaultValue: "Complete near end time",
                  })
                : lesson.checkInStatus === "rejected"
                  ? t("calendarTab.card.checkInRetryTitle", {
                      defaultValue: "Couldn't verify arrival",
                    })
                  : t("jobsTab.instructorFeed.checkInFirst", {
                      defaultValue: "Check in first",
                    })}
          </Text>
        </View>
      </View>

      <View style={{ gap: BrandSpacing.xs }}>
        <Text
          style={{
            ...BrandType.micro,
            color: theme.color.textMuted,
          }}
        >
          {t("jobsTab.instructorFeed.lessonSteps", {
            defaultValue: "1. Check in when you arrive. 2. Mark done near the end.",
          })}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
          <IconSymbol name="clock.fill" size={14} color={theme.jobs.signal} />
          <Text
            style={{
              fontFamily: FontFamily.bodyMedium,
              fontSize: FontSize.caption,
              lineHeight: LineHeight.caption,
              color: theme.color.textMuted,
            }}
          >
            {timeLabel}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
          <IconSymbol
            name={hasVerifiedCheckIn ? "checkmark.circle.fill" : "location.fill"}
            size={14}
            color={hasVerifiedCheckIn ? theme.color.success : theme.jobs.signal}
          />
          <Text
            style={{
              fontFamily: FontFamily.bodyMedium,
              fontSize: FontSize.caption,
              lineHeight: LineHeight.caption,
              color: hasVerifiedCheckIn ? theme.color.success : theme.color.textMuted,
            }}
          >
            {hasVerifiedCheckIn
              ? t("calendarTab.card.checkInVerifiedTitle", {
                  defaultValue: "Arrival confirmed",
                })
              : lesson.checkInStatus === "rejected"
                ? t("calendarTab.card.checkInRetryTitle", {
                    defaultValue: "Couldn't verify arrival",
                  })
                : t("jobsTab.instructorFeed.checkInFirst", {
                    defaultValue: "Check in first",
                  })}
          </Text>
        </View>
        {lesson.branchAddress ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
            <IconSymbol name="location.fill" size={14} color={theme.jobs.signal} />
            <Text
              numberOfLines={2}
              style={{
                fontFamily: FontFamily.bodyMedium,
                fontSize: FontSize.caption,
                lineHeight: LineHeight.caption,
                color: theme.color.textMuted,
              }}
            >
              {lesson.branchAddress}
            </Text>
          </View>
        ) : null}
      </View>

      <ActionButton
        label={
          hasVerifiedCheckIn
            ? t("jobsTab.instructorFeed.checkedIn", {
                defaultValue: "Checked in",
              })
            : checkingIn
              ? t("calendarTab.card.checkIn", {
                  defaultValue: "Checking in...",
                })
              : t("calendarTab.card.checkIn", {
                  defaultValue: "Check in",
                })
        }
        onPress={() => onCheckIn(lesson)}
        loading={checkingIn}
        disabled={!canCheckInNow}
        tone={hasVerifiedCheckIn ? "secondary" : "primary"}
        fullWidth
        colors={{
          backgroundColor: hasVerifiedCheckIn ? theme.color.surfaceMuted : theme.color.tertiary,
          pressedBackgroundColor: hasVerifiedCheckIn
            ? theme.color.surfaceMuted
            : theme.color.tertiarySubtle,
          disabledBackgroundColor: theme.color.surfaceMuted,
          labelColor: hasVerifiedCheckIn ? theme.color.textMuted : theme.color.onPrimary,
          disabledLabelColor: theme.color.textMuted,
          nativeTintColor: hasVerifiedCheckIn ? theme.color.textMuted : theme.color.onPrimary,
        }}
      />

      <ActionButton
        label={t("jobsTab.actions.markLessonDone")}
        onPress={() => onComplete(lesson)}
        loading={isSubmitting}
        disabled={!canCompleteNow || isSubmitting}
        tone={canCompleteNow ? "primary" : "secondary"}
        fullWidth
        colors={{
          backgroundColor: canCompleteNow ? theme.color.primary : theme.color.surfaceMuted,
          pressedBackgroundColor: canCompleteNow
            ? theme.color.primarySubtle
            : theme.color.surfaceMuted,
          disabledBackgroundColor: theme.color.surfaceMuted,
          labelColor: canCompleteNow ? theme.color.onPrimary : theme.color.textMuted,
          disabledLabelColor: theme.color.textMuted,
          nativeTintColor: canCompleteNow ? theme.color.onPrimary : theme.color.textMuted,
        }}
      />
    </View>
  );
}

export const InstructorCurrentLessonsList = memo(function InstructorCurrentLessonsList({
  lessons,
  locale,
  now,
  t,
  onCheckIn,
  onComplete,
  checkingIn = false,
  isSubmitting = false,
}: {
  lessons: InstructorCurrentLesson[];
  locale: string;
  now: number;
  t: TFunction;
  onCheckIn: (lesson: InstructorCurrentLesson) => void;
  onComplete: (lesson: InstructorCurrentLesson) => void;
  checkingIn?: boolean;
  isSubmitting?: boolean;
}) {
  const { isDesktopWeb: isWideWeb } = useLayoutBreakpoint();
  const theme = useTheme();

  const handleComplete = useCallback(
    (lesson: InstructorCurrentLesson) => onComplete(lesson),
    [onComplete],
  );

  if (lessons.length === 0) {
    return null;
  }

  return (
    <Box style={{ gap: isWideWeb ? 10 : BrandSpacing.md, paddingHorizontal: BrandSpacing.sm }}>
      <View style={{ gap: BrandSpacing.xxs, paddingHorizontal: BrandSpacing.xs }}>
        <Text style={{ ...BrandType.title, color: theme.color.text }}>
          {t("jobsTab.instructorFeed.currentLessonsTitle")}
        </Text>
        <Text
          style={{
            ...BrandType.caption,
            color: theme.color.textMuted,
          }}
        >
          {t("jobsTab.instructorFeed.currentLessonsSubtitle")}
        </Text>
      </View>
      {lessons.map((lesson) => (
        <CurrentLessonCard
          key={`current-lesson-${lesson.jobId}`}
          lesson={lesson}
          locale={locale}
          now={now}
          t={t}
          onCheckIn={onCheckIn}
          onComplete={handleComplete}
          checkingIn={checkingIn}
          isSubmitting={isSubmitting}
        />
      ))}
    </Box>
  );
});
