import type { TFunction } from "i18next";
import { type ComponentProps, memo } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { DotStatusPill } from "@/components/home/home-shared";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSurface } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
import {
  formatDateWithWeekday,
  formatTime,
  getApplicationStatusTranslationKey,
  getBoostPresentation,
  getExpiryPresentation,
  getJobStatusToneWithReason,
  getJobStatusTranslationKey,
} from "@/lib/jobs-utils";
import type { PaymentStatus, PayoutStatus } from "@/lib/payments-utils";
import { appStatusDot, getJobStatusToneColors, paymentDotColor } from "./studio-jobs-list.helpers";
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

const PAYOUT_STATUS_KEY: Record<PayoutStatus, string> = {
  queued: "jobsTab.checkout.payoutStatus.queued",
  processing: "jobsTab.checkout.payoutStatus.processing",
  pending_provider: "jobsTab.checkout.payoutStatus.pendingProvider",
  paid: "jobsTab.checkout.payoutStatus.paid",
  failed: "jobsTab.checkout.payoutStatus.failed",
  cancelled: "jobsTab.checkout.payoutStatus.cancelled",
  needs_attention: "jobsTab.checkout.payoutStatus.needsAttention",
};

function MetaPill({
  icon,
  label,
  tone = "default",
}: {
  icon: ComponentProps<typeof IconSymbol>["name"];
  label: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const theme = useTheme();
  const backgroundColor =
    tone === "warning"
      ? theme.jobs.accentHeatSubtle
      : tone === "danger"
        ? theme.color.dangerSubtle
        : tone === "success"
          ? theme.color.primarySubtle
          : theme.color.surfaceAlt;
  const color =
    tone === "warning"
      ? theme.jobs.accentHeat
      : tone === "danger"
        ? theme.color.danger
        : tone === "success"
          ? theme.jobs.signal
          : theme.color.textMuted;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: BrandRadius.pill,
        paddingHorizontal: BrandSpacing.sm,
        paddingVertical: BrandSpacing.xs,
        backgroundColor,
      }}
    >
      <IconSymbol name={icon} size={12} color={color} />
      <Text numberOfLines={1} style={{ ...BrandType.caption, color }}>
        {label}
      </Text>
    </View>
  );
}

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
  onReview: (applicationId: Id<"jobApplications">, status: "accepted" | "rejected") => void;
  t: TFunction;
};

export const ApplicationRow = memo(function ApplicationRow({
  application,
  isWideWeb,
  locale,
  reviewingApplicationId,
  canReview,
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
    <Animated.View entering={FadeInUp.duration(220).springify().damping(18)}>
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
              <Text
                numberOfLines={1}
                style={{
                  ...BrandType.bodyStrong,
                  color: theme.color.text,
                }}
              >
                {application.instructorName}
              </Text>
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
    </Animated.View>
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
  onReview: (applicationId: Id<"jobApplications">, status: "accepted" | "rejected") => void;
  onStartPayment: (jobId: Id<"jobs">) => void;
  t: TFunction;
};

export const StudioJobCard = memo(function StudioJobCard({
  job,
  index,
  isWideWeb,
  locale,
  zoneLanguage,
  reviewingApplicationId,
  payingJobId,
  onReview,
  onStartPayment,
  t,
}: StudioJobCardProps) {
  const theme = useTheme();
  const statusTone = getJobStatusToneWithReason(job.status, job.closureReason);
  const statusPill = getJobStatusToneColors(statusTone, theme);
  const payDot = paymentDotColor(job.payment?.status, theme);
  const boost = getBoostPresentation(
    job.pay,
    job.boostPreset,
    job.boostBonusAmount,
    job.boostActive,
  );
  const expiry = getExpiryPresentation(job.applicationDeadline, locale);
  const shouldShowExpiry =
    Boolean(expiry) &&
    (job.status === "open" || (job.status === "cancelled" && job.closureReason === "expired"));
  const canPay =
    ["filled", "completed"].includes(job.status) &&
    !(
      job.payment &&
      ["created", "pending", "authorized", "captured", "refunded"].includes(job.payment.status)
    );
  const acceptedApplication = job.applications.find(
    (application) => application.status === "accepted",
  );
  const dateLabel = formatDateWithWeekday(job.startTime, locale);
  const timeLabel = `${formatTime(job.startTime, locale)}  \u2192  ${formatTime(job.endTime, locale)}`;
  const zoneLabel = getZoneLabel(job.zone, zoneLanguage);
  const expiryTone = expiry?.isExpired ? "danger" : "warning";
  const cardBackground =
    job.pendingApplicationsCount > 0 ? theme.jobs.surfaceRaised : theme.jobs.surface;

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index, 5) * 34)
        .duration(260)
        .springify()
        .damping(18)}
    >
      <KitSurface
        tone="base"
        padding={0}
        gap={0}
        style={{
          borderRadius: BrandRadius.cardSubtle,
          borderCurve: "continuous",
          backgroundColor: cardBackground,
          overflow: "hidden",
        }}
      >
        <View style={{ gap: BrandSpacing.lg, paddingHorizontal: BrandSpacing.lg, paddingVertical: BrandSpacing.lg }}>
          {/* Header: sport + status */}
          <View style={{ gap: BrandSpacing.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: BrandSpacing.stack,
              }}
            >
              <View style={{ flex: 1, minWidth: 0, gap: BrandSpacing.stackTight }}>
                <Text
                  numberOfLines={1}
                  style={{
                    ...(isWideWeb ? BrandType.titleLarge : BrandType.title),
                    color: theme.color.text,
                  }}
                >
                  {toSportLabel(job.sport as never)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    ...BrandType.caption,
                    color: theme.color.textMuted,
                  }}
                >
                  {acceptedApplication
                    ? acceptedApplication.instructorName
                    : job.pendingApplicationsCount > 0
                      ? t("jobsTab.card.toReview", { count: job.pendingApplicationsCount })
                      : job.applicationsCount > 0
                        ? t("jobsTab.card.reviewedCount", { count: job.applicationsCount })
                        : t("jobsTab.card.liveOnBoard")}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end", gap: BrandSpacing.stackTight }}>
                <DotStatusPill
                  backgroundColor={statusPill.backgroundColor}
                  color={statusPill.color}
                  label={t(getJobStatusTranslationKey(job.status, job.closureReason))}
                />
                {job.pendingApplicationsCount > 0 ? (
                  <DotStatusPill
                    backgroundColor={theme.color.primarySubtle}
                    color={theme.jobs.signal}
                    label={t("jobsTab.card.toReview", { count: job.pendingApplicationsCount })}
                  />
                ) : null}
              </View>
            </View>

            {/* Mission details: date, time, zone, pay */}
            <View
              style={{
                gap: BrandSpacing.stack,
                borderRadius: BrandRadius.medium,
                borderCurve: "continuous",
                paddingHorizontal: BrandSpacing.controlX,
                paddingVertical: BrandSpacing.controlY,
                backgroundColor: theme.jobs.surfaceMuted,
              }}
            >
              <InlineMeta icon="calendar" text={dateLabel} />
              <InlineMeta icon="clock" text={timeLabel} strong />
              <InlineMeta icon="mappin.and.ellipse" text={zoneLabel} />

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: BrandSpacing.stack,
                }}
              >
                <Text
                  style={{
                    ...(isWideWeb ? BrandType.headingDisplay : BrandType.heading),
                    color: theme.jobs.signal,
                  }}
                >
                  ₪{boost.totalPay}
                </Text>

                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    gap: BrandSpacing.sm,
                  }}
                >
                  {boost.badgeKey ? (
                    <MetaPill
                      icon="sparkles"
                      label={t(boost.badgeKey, boost.badgeInterpolation)}
                      tone="success"
                    />
                  ) : null}
                  {shouldShowExpiry && expiry ? (
                    <MetaPill
                      icon="clock.fill"
                      label={t(expiry.key, expiry.interpolation)}
                      tone={expiryTone}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </View>

          {/* Payment section */}
          {["filled", "completed"].includes(job.status) ? (
            <View
              style={{
                gap: BrandSpacing.stack,
                borderRadius: BrandRadius.medium,
                borderCurve: "continuous",
                paddingHorizontal: BrandSpacing.controlX,
                paddingVertical: BrandSpacing.controlY,
                backgroundColor: theme.jobs.surfaceMuted,
              }}
            >
              <View
                style={{
                  flexDirection: isWideWeb ? "row" : "column",
                  justifyContent: "space-between",
                  gap: BrandSpacing.stack,
                  alignItems: isWideWeb ? "center" : "flex-start",
                }}
              >
                <View style={{ flex: 1, gap: BrandSpacing.stackTight }}>
                  <Text
                    style={{
                      ...BrandType.caption,
                      color: theme.color.textMuted,
                    }}
                  >
                    {t("jobsTab.card.settlement")}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: BrandSpacing.sm,
                    }}
                  >
                    <DotStatusPill
                      backgroundColor={theme.color.surfaceAlt}
                      color={payDot}
                      label={
                        job.payment
                          ? t(PAYMENT_STATUS_KEY[job.payment.status])
                          : t("jobsTab.checkout.notStarted")
                      }
                    />
                    {job.payment?.payoutStatus ? (
                      <DotStatusPill
                        backgroundColor={theme.color.surfaceAlt}
                        color={theme.color.text}
                        label={t(PAYOUT_STATUS_KEY[job.payment.payoutStatus])}
                      />
                    ) : null}
                  </View>
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
            </View>
          ) : null}

          {/* Applications section */}
          {job.pendingApplicationsCount > 0 ? (
            <View style={{ gap: BrandSpacing.stack }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: BrandSpacing.stack,
                }}
              >
                <Text
                  style={{
                    ...BrandType.caption,
                    color: theme.color.textMuted,
                  }}
                >
                  {t("jobsTab.card.reviewQueue")}
                </Text>
                <Text
                  style={{
                    ...BrandType.micro,
                    color: theme.color.textMuted,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {t("jobsTab.card.waitingCount", { count: job.pendingApplicationsCount })}
                </Text>
              </View>

              {job.applications.map((application) => (
                <ApplicationRow
                  key={application.applicationId}
                  application={application}
                  isWideWeb={isWideWeb}
                  locale={locale}
                  reviewingApplicationId={reviewingApplicationId}
                  canReview={application.status === "pending" && job.status === "open"}
                  onReview={onReview}
                  t={t}
                />
              ))}
            </View>
          ) : acceptedApplication ? (
            <Text style={{ ...BrandType.caption, color: theme.color.textMuted, paddingHorizontal: BrandSpacing.xs }}>
              {t("jobsTab.card.assignedTo", { name: acceptedApplication.instructorName })}
            </Text>
          ) : job.applicationsCount > 0 ? (
            <Text style={{ ...BrandType.caption, color: theme.color.textMuted, paddingHorizontal: BrandSpacing.xs }}>
              {t("jobsTab.card.applicantsProcessed", { count: job.applicationsCount })}
            </Text>
          ) : null}
        </View>
      </KitSurface>
    </Animated.View>
  );
});
