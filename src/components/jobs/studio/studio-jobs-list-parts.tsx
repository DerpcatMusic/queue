import type { TFunction } from "i18next";
import { type ComponentProps, memo } from "react";
import { Pressable, Text, View } from "react-native";
import { DotStatusPill } from "@/components/home/home-shared";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import {
  formatDateWithWeekday,
  formatTime,
  getApplicationStatusTranslationKey,
  getBoostPresentation,
  getJobStatusToneWithReason,
} from "@/lib/jobs-utils";
import type { PaymentStatus } from "@/lib/payments-utils";
import { appStatusDot, paymentDotColor } from "./studio-jobs-list.helpers";
import type { StudioJob, StudioJobApplication } from "./studio-jobs-list.types";

const AVATAR_SIZE = BrandSpacing.avatarCard;
const AVATAR_RADIUS = BrandRadius.card;

const PAYMENT_STATUS_KEY: Record<PaymentStatus, string> = {
  created: "jobsTab.checkout.paymentStatus.created",
  pending: "jobsTab.checkout.paymentStatus.pending",
  authorized: "jobsTab.checkout.paymentStatus.authorized",
  captured: "jobsTab.checkout.paymentStatus.captured",
  failed: "jobsTab.checkout.paymentStatus.failed",
  cancelled: "jobsTab.checkout.paymentStatus.cancelled",
  refunded: "jobsTab.checkout.paymentStatus.refunded",
};

function InlineMeta({
  icon,
  text,
  strong = false,
}: {
  icon: ComponentProps<typeof IconSymbol>["name"];
  text: string;
  strong?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: BrandSpacing.stackTight,
      }}
    >
      <IconSymbol name={icon} size={16} color={theme.color.textMuted} />
      <Text
        numberOfLines={1}
        style={[
          strong ? BrandType.bodyStrong : BrandType.body,
          {
            color: strong ? theme.color.text : theme.color.textMuted,
            flexShrink: 1,
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

type ApplicationRowProps = {
  application: StudioJobApplication;
  isWideWeb: boolean;
  locale: string;
  reviewingApplicationId: Id<"jobApplications"> | null;
  canReview: boolean;
  onInstructorPress?: (instructorId: Id<"instructorProfiles">) => void;
  onReview: (applicationId: Id<"jobApplications">, status: "accepted" | "rejected") => void;
  t: TFunction;
};

export const ApplicationRow = memo(function ApplicationRow({
  application,
  isWideWeb,
  locale,
  reviewingApplicationId,
  canReview,
  onInstructorPress,
  onReview,
  t,
}: ApplicationRowProps) {
  const theme = useTheme();
  const appDot = appStatusDot(application.status, theme);
  const isReviewing = reviewingApplicationId === application.applicationId;
  const initials = application.instructorName
    .split(" ")
    .map((part) => part.trim().slice(0, 1))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const statusBackground =
    application.status === "accepted"
      ? theme.color.primarySubtle
      : application.status === "rejected"
        ? theme.color.dangerSubtle
        : application.status === "pending"
          ? theme.jobs.accentHeatSubtle
          : theme.color.surfaceAlt;
  const metaText = `${t("jobsTab.card.applied")} · ${formatDateWithWeekday(application.appliedAt, locale)} · ${formatTime(application.appliedAt, locale)}`;

  return (
    <View
      style={{
        gap: BrandSpacing.stack,
        borderRadius: BrandRadius.medium,
        borderCurve: "continuous",
        paddingHorizontal: BrandSpacing.controlX,
        paddingVertical: BrandSpacing.controlY,
        backgroundColor: theme.jobs.surfaceRaised,
      }}
    >
      <View
        style={{
          gap: BrandSpacing.stack,
          flexDirection: isWideWeb ? "row" : "column",
          alignItems: isWideWeb ? "center" : "stretch",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: BrandSpacing.stack,
            flex: 1,
            minWidth: 0,
          }}
        >
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: AVATAR_RADIUS,
              borderCurve: "continuous",
              backgroundColor: statusBackground,
            }}
          >
            <Text
              style={{
                ...BrandType.bodyStrong,
                color: appDot,
              }}
            >
              {initials || "?"}
            </Text>
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: BrandSpacing.xs }}>
            <Pressable
              disabled={!onInstructorPress}
              onPress={() => onInstructorPress?.(application.instructorId)}
              style={({ pressed }) => ({ opacity: pressed && onInstructorPress ? 0.82 : 1 })}
            >
              <Text
                numberOfLines={1}
                style={{
                  ...BrandType.bodyStrong,
                  color: onInstructorPress ? theme.color.primary : theme.color.text,
                }}
              >
                {application.instructorName}
              </Text>
            </Pressable>
            {application.message ? (
              <Text
                numberOfLines={isWideWeb ? 1 : 2}
                style={{
                  ...BrandType.caption,
                  color: theme.color.textMuted,
                }}
              >
                {application.message}
              </Text>
            ) : (
              <Text
                numberOfLines={1}
                style={{
                  ...BrandType.caption,
                  color: theme.color.textMicro,
                }}
              >
                {metaText}
              </Text>
            )}
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: BrandSpacing.stackTight,
            alignSelf: isWideWeb ? "center" : "flex-start",
          }}
        >
          <DotStatusPill
            backgroundColor={theme.color.surfaceAlt}
            color={appDot}
            label={t(getApplicationStatusTranslationKey(application.status))}
          />
        </View>
      </View>

      {application.message ? <InlineMeta icon="calendar.badge.clock" text={metaText} /> : null}

      {canReview ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: BrandSpacing.sm,
            paddingTop: BrandSpacing.xs,
          }}
        >
          <ActionButton
            label={isReviewing ? t("jobsTab.actions.rejecting") : t("jobsTab.actions.reject")}
            onPress={() => onReview(application.applicationId, "rejected")}
            tone="secondary"
            disabled={isReviewing}
          />
          <ActionButton
            label={isReviewing ? t("jobsTab.actions.accepting") : t("jobsTab.actions.accept")}
            onPress={() => onReview(application.applicationId, "accepted")}
            loading={isReviewing}
          />
        </View>
      ) : null}
    </View>
  );
});

type StudioJobCardProps = {
  job: StudioJob;
  index: number;
  isWideWeb: boolean;
  locale: string;
  zoneLanguage: "en" | "he";
  reviewingApplicationId: Id<"jobApplications"> | null;
  payingJobId: Id<"jobs"> | null;
  onInstructorPress?: (instructorId: Id<"instructorProfiles">) => void;
  onReview: (applicationId: Id<"jobApplications">, status: "accepted" | "rejected") => void;
  onStartPayment: (jobId: Id<"jobs">) => void;
  onJobPress: (jobId: Id<"jobs">) => void;
  t: TFunction;
};

export const StudioJobCard = memo(function StudioJobCard({
  job,
  index: _index,
  isWideWeb,
  locale,
  zoneLanguage,
  reviewingApplicationId,
  onInstructorPress,
  payingJobId,
  onReview,
  onStartPayment,
  onJobPress,
  t,
}: StudioJobCardProps) {
  const theme = useTheme();
  const statusTone = getJobStatusToneWithReason(job.status, job.closureReason);
  const payDot = paymentDotColor(job.payment?.status, theme);
  const boost = getBoostPresentation(
    job.pay,
    job.boostPreset,
    job.boostBonusAmount,
    job.boostActive,
  );
  const canPay =
    ["filled", "completed"].includes(job.status) &&
    !(
      job.payment &&
      ["created", "pending", "authorized", "captured", "refunded"].includes(job.payment.status)
    );
  const zoneLabel = getZoneLabel(job.zone, zoneLanguage);
  const hasPending = job.pendingApplicationsCount > 0;

  // Status dot colors - tone is "primary" | "success" | "muted" | "amber" | "gray"
  const statusDotColor =
    statusTone === "success"
      ? theme.color.primary
      : statusTone === "amber"
        ? theme.jobs.accentHeat
        : statusTone === "gray"
          ? theme.color.textMuted
          : theme.color.textMuted;

  return (
    <View>
      <Pressable
        onPress={() => {
          onJobPress(job.jobId);
        }}
        style={({ pressed }) => ({
          transform: [{ scale: pressed ? 0.992 : 1 }],
        })}
      >
        <View
          style={{
            borderRadius: BrandRadius.card,
            borderCurve: "continuous",
            backgroundColor: theme.jobs.surface,
            borderWidth: BorderWidth.thin,
            borderColor: theme.color.border,
            overflow: "hidden",
          }}
        >
          {/* Accent line at top - orange if has boost, primary if pending review */}
          {(boost.badgeKey || hasPending) && (
            <View
              style={{
                height: BorderWidth.strong,
                backgroundColor: boost.badgeKey ? theme.jobs.accentHeat : theme.color.primary,
              }}
            />
          )}

          <View style={{ padding: BrandSpacing.lg, gap: BrandSpacing.lg }}>
            {/* Header row: Sport + status dots */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ ...BrandType.title, color: theme.color.text }}>
                  {toSportLabel(job.sport as never)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ ...BrandType.caption, color: theme.color.textMuted }}
                >
                  {zoneLabel}
                </Text>
              </View>

              {/* Status indicators */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: BrandSpacing.sm,
                }}
              >
                {/* Status dot */}
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: statusDotColor,
                  }}
                />

                {/* Payment status dot (for filled/completed) */}
                {job.payment && (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: payDot,
                    }}
                  />
                )}

                {/* Boost indicator */}
                {boost.badgeKey && (
                  <Text style={{ ...BrandType.micro, color: theme.color.primary }}>
                    +₪{job.boostBonusAmount ?? 20}
                  </Text>
                )}
              </View>
            </View>

            {/* Time row */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: BrandSpacing.sm,
                }}
              >
                <IconSymbol name="clock" size={16} color={theme.color.textMuted} />
                <Text
                  style={{
                    ...BrandType.bodyMedium,
                    color: theme.color.text,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatTime(job.startTime, locale)}
                </Text>
                <Text style={{ ...BrandType.caption, color: theme.color.textMuted }}>—</Text>
                <Text
                  style={{
                    ...BrandType.bodyMedium,
                    color: theme.color.text,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatTime(job.endTime, locale)}
                </Text>
              </View>

              <Text style={{ ...BrandType.title, color: theme.color.primary }}>
                ₪{boost.totalPay}
              </Text>
            </View>

            {/* Footer row: Applicants + CTA */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ ...BrandType.caption, color: theme.color.textMuted }}>
                {job.applicationsCount > 0
                  ? `${job.applicationsCount} ${job.applicationsCount === 1 ? "applicant" : "applicants"}`
                  : "No applicants yet"}
              </Text>

              {hasPending ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: BrandSpacing.xs,
                  }}
                >
                  <Text
                    style={{
                      ...BrandType.labelStrong,
                      color: theme.color.primary,
                    }}
                  >
                    Review
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color={theme.color.primary} />
                </View>
              ) : job.status === "open" ? (
                <Text style={{ ...BrandType.micro, color: theme.color.textMuted }}>Live</Text>
              ) : null}
            </View>

            {job.applications.length > 0 ? (
              <View style={{ gap: BrandSpacing.sm }}>
                {job.applications.slice(0, 2).map((application) => (
                  <ApplicationRow
                    key={String(application.applicationId)}
                    application={application}
                    isWideWeb={isWideWeb}
                    locale={locale}
                    reviewingApplicationId={reviewingApplicationId}
                    canReview={job.status === "open"}
                    {...(onInstructorPress ? { onInstructorPress } : {})}
                    onReview={onReview}
                    t={t}
                  />
                ))}
              </View>
            ) : null}
          </View>

          {/* Payment section (only for filled/completed) */}
          {["filled", "completed"].includes(job.status) && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: BrandSpacing.lg,
                paddingVertical: BrandSpacing.md,
                backgroundColor: theme.jobs.surfaceMuted,
                borderTopWidth: BorderWidth.thin,
                borderTopColor: theme.color.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: BrandSpacing.sm,
                }}
              >
                <IconSymbol name="creditcard" size={16} color={theme.color.textMuted} />
                <Text style={{ ...BrandType.caption, color: theme.color.textMuted }}>
                  {job.payment
                    ? t(PAYMENT_STATUS_KEY[job.payment.status])
                    : t("jobsTab.checkout.notStarted")}
                </Text>
              </View>

              {canPay ? (
                <ActionButton
                  label={
                    payingJobId === job.jobId
                      ? t("jobsTab.checkout.starting")
                      : job.payment && ["failed", "cancelled"].includes(job.payment.status)
                        ? t("jobsTab.checkout.retryPayment")
                        : t("jobsTab.checkout.payNow")
                  }
                  onPress={() => onStartPayment(job.jobId)}
                  loading={payingJobId === job.jobId}
                />
              ) : null}
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
});
