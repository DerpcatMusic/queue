import type { TFunction } from "i18next";
import { memo } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { DotStatusPill, MetricCell } from "@/components/home/home-shared";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSurface } from "@/components/ui/kit";
import { type BrandPalette, BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import {
  formatDateTime,
  getApplicationStatusTranslationKey,
  getBoostPresentation,
  getExpiryPresentation,
  getJobStatusToneWithReason,
  getJobStatusTranslationKey,
  type JobStatusTone,
} from "@/lib/jobs-utils";
import type { PaymentStatus, PayoutStatus } from "@/lib/payments-utils";
import { appStatusDot, paymentDotColor, type SummaryChipProps } from "./studio-jobs-list.helpers";
import type { StudioJob, StudioJobApplication } from "./studio-jobs-list.types";

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

function getToneColors(tone: JobStatusTone, palette: BrandPalette) {
  if (tone === "primary") {
    return {
      color: palette.primary as string,
      backgroundColor: palette.primarySubtle as string,
    };
  }

  if (tone === "success") {
    return {
      color: palette.success as string,
      backgroundColor: palette.successSubtle as string,
    };
  }

  if (tone === "amber") {
    return {
      color: palette.warning as string,
      backgroundColor: palette.warningSubtle as string,
    };
  }

  return {
    color: palette.textMuted as string,
    backgroundColor: palette.surface as string,
  };
}

export const SummaryChip = memo(function SummaryChip({ icon, text, palette }: SummaryChipProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: BrandRadius.button - 4,
        borderCurve: "continuous",
        backgroundColor: palette.surface as string,
        paddingHorizontal: 10,
        paddingVertical: 7,
      }}
    >
      <IconSymbol name={icon} size={12} color={palette.textMuted as string} />
      <Text style={{ ...BrandType.caption, color: palette.text as string }}>{text}</Text>
    </View>
  );
});

type ApplicationRowProps = {
  application: StudioJobApplication;
  isWideWeb: boolean;
  locale: string;
  palette: BrandPalette;
  reviewingApplicationId: Id<"jobApplications"> | null;
  canReview: boolean;
  onReview: (applicationId: Id<"jobApplications">, status: "accepted" | "rejected") => void;
  t: TFunction;
};

export const ApplicationRow = memo(function ApplicationRow({
  application,
  isWideWeb,
  locale,
  palette,
  reviewingApplicationId,
  canReview,
  onReview,
  t,
}: ApplicationRowProps) {
  const appDot = appStatusDot(application.status, palette);
  const isReviewing = reviewingApplicationId === application.applicationId;

  return (
    <Animated.View entering={FadeInUp.duration(240).springify().damping(18)}>
      <View
        style={{
          flexDirection: isWideWeb ? "row" : "column",
          alignItems: isWideWeb ? "center" : "stretch",
          gap: isWideWeb ? 14 : 10,
          borderRadius: BrandRadius.card,
          borderCurve: "continuous",
          backgroundColor: palette.surface as string,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <View style={{ flex: isWideWeb ? 1.5 : undefined, minWidth: 0, gap: 3 }}>
          <Text
            style={{
              ...BrandType.bodyStrong,
              fontSize: 15,
              lineHeight: 18,
              color: palette.text as string,
            }}
            numberOfLines={1}
          >
            {application.instructorName}
          </Text>
          {application.message ? (
            <Text
              style={{ ...BrandType.caption, color: palette.textMuted as string }}
              numberOfLines={isWideWeb ? 1 : 2}
            >
              {application.message}
            </Text>
          ) : null}
        </View>

        <View style={{ width: isWideWeb ? 150 : undefined }}>
          <MetricCell
            icon="calendar.badge.clock"
            label={t("jobsTab.card.applied")}
            value={formatDateTime(application.appliedAt, locale)}
            palette={palette}
          />
        </View>

        <View style={{ width: isWideWeb ? 130 : undefined }}>
          <DotStatusPill
            backgroundColor={palette.surfaceAlt as string}
            color={appDot}
            label={t(getApplicationStatusTranslationKey(application.status))}
          />
        </View>

        {canReview ? (
          <View
            style={{
              width: isWideWeb ? 178 : undefined,
              marginLeft: isWideWeb ? "auto" : undefined,
              flexDirection: "row",
              justifyContent: isWideWeb ? "flex-end" : "flex-start",
              gap: BrandSpacing.sm,
            }}
          >
            <ActionButton
              label={isReviewing ? t("jobsTab.actions.rejecting") : t("jobsTab.actions.reject")}
              onPress={() => onReview(application.applicationId, "rejected")}
              palette={palette}
              tone="secondary"
              disabled={isReviewing}
            />
            <ActionButton
              label={isReviewing ? t("jobsTab.actions.accepting") : t("jobsTab.actions.accept")}
              onPress={() => onReview(application.applicationId, "accepted")}
              palette={palette}
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
  palette: BrandPalette;
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
  palette,
  reviewingApplicationId,
  payingJobId,
  onReview,
  onStartPayment,
  t,
}: StudioJobCardProps) {
  const statusTone = getJobStatusToneWithReason(job.status, job.closureReason);
  const statusPill = getToneColors(statusTone, palette);
  const payDot = paymentDotColor(job.payment?.status, palette);
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
  const pendingLabel =
    job.pendingApplicationsCount > 0
      ? t("jobsTab.card.pendingCount", { count: job.pendingApplicationsCount })
      : job.applicationsCount > 0
        ? t("jobsTab.card.reviewedCount", { count: job.applicationsCount })
        : t("jobsTab.card.noApplicants");
  const listTone =
    job.pendingApplicationsCount > 0
      ? (palette.primarySubtle as string)
      : (palette.surfaceAlt as string);

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index, 5) * 36)
        .duration(280)
        .springify()
        .damping(18)}
    >
      <KitSurface
        tone="base"
        padding={BrandSpacing.md}
        gap={0}
        style={{
          borderRadius: isWideWeb ? 26 : BrandRadius.card,
          borderCurve: "continuous",
          backgroundColor: listTone,
          paddingHorizontal: isWideWeb ? 18 : BrandSpacing.lg,
          paddingVertical: isWideWeb ? 16 : 14,
        }}
      >
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: isWideWeb ? "row" : "column",
              alignItems: isWideWeb ? "flex-start" : "stretch",
              gap: isWideWeb ? 14 : 10,
            }}
          >
            <View style={{ flex: isWideWeb ? 1.6 : undefined, minWidth: 0, gap: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text
                    style={{
                      ...BrandType.heading,
                      fontSize: isWideWeb ? 22 : 20,
                      lineHeight: isWideWeb ? 24 : 22,
                      color: palette.text as string,
                    }}
                    numberOfLines={1}
                  >
                    {toSportLabel(job.sport as never)}
                  </Text>

                  <Text
                    style={{ ...BrandType.caption, color: palette.textMuted as string }}
                    numberOfLines={1}
                  >
                    {acceptedApplication
                      ? t("jobsTab.card.assignedInstructor", {
                          name: acceptedApplication.instructorName,
                        })
                      : pendingLabel}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <DotStatusPill
                    backgroundColor={statusPill.backgroundColor}
                    color={statusPill.color}
                    label={t(getJobStatusTranslationKey(job.status, job.closureReason))}
                  />
                  {boost.badgeKey ? (
                    <DotStatusPill
                      backgroundColor={palette.primarySubtle as string}
                      color={palette.primary as string}
                      label={t(boost.badgeKey, boost.badgeInterpolation)}
                    />
                  ) : null}
                  {job.pendingApplicationsCount > 0 ? (
                    <DotStatusPill
                      backgroundColor={palette.surface as string}
                      color={palette.primary as string}
                      label={t("jobsTab.card.toReview", { count: job.pendingApplicationsCount })}
                    />
                  ) : null}
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <SummaryChip
                  icon="calendar.badge.clock"
                  text={formatDateTime(job.startTime, locale)}
                  palette={palette}
                />
                <SummaryChip
                  icon="mappin.and.ellipse"
                  text={getZoneLabel(job.zone, zoneLanguage)}
                  palette={palette}
                />
                <SummaryChip
                  icon="creditcard.fill"
                  text={t("jobsTab.card.pay", { value: boost.totalPay })}
                  palette={palette}
                />
                {shouldShowExpiry && expiry ? (
                  <SummaryChip
                    icon="calendar.badge.clock"
                    text={t(expiry.key, expiry.interpolation)}
                    palette={palette}
                  />
                ) : null}
              </View>
            </View>
          </View>

          {["filled", "completed"].includes(job.status) ? (
            <View
              style={{
                flexDirection: isWideWeb ? "row" : "column",
                alignItems: isWideWeb ? "center" : "stretch",
                gap: 8,
                borderRadius: BrandRadius.card - 2,
                borderCurve: "continuous",
                backgroundColor: palette.surface as string,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    ...BrandType.caption,
                    letterSpacing: 0.1,
                    color: palette.textMuted as string,
                  }}
                >
                  {t("jobsTab.card.settlement")}
                </Text>
                <DotStatusPill
                  backgroundColor={palette.surfaceAlt as string}
                  color={payDot}
                  label={
                    job.payment
                      ? t(PAYMENT_STATUS_KEY[job.payment.status])
                      : t("jobsTab.checkout.notStarted")
                  }
                />
                {job.payment?.payoutStatus ? (
                  <DotStatusPill
                    backgroundColor={palette.surfaceAlt as string}
                    color={palette.text as string}
                    label={t(PAYOUT_STATUS_KEY[job.payment.payoutStatus])}
                  />
                ) : null}
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
                  palette={palette}
                  loading={payingJobId === job.jobId}
                />
              ) : null}
            </View>
          ) : null}

          {job.pendingApplicationsCount > 0 ? (
            <View style={{ gap: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <Text
                  style={{
                    ...BrandType.caption,
                    letterSpacing: 0.1,
                    color: palette.textMuted as string,
                  }}
                >
                  {t("jobsTab.card.reviewQueue")}
                </Text>
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.textMuted as string,
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
                  palette={palette}
                  reviewingApplicationId={reviewingApplicationId}
                  canReview={application.status === "pending" && job.status === "open"}
                  onReview={onReview}
                  t={t}
                />
              ))}
            </View>
          ) : acceptedApplication ? (
            <Text
              style={{
                ...BrandType.caption,
                color: palette.textMuted as string,
                paddingHorizontal: 2,
              }}
            >
              {t("jobsTab.card.assignedTo", { name: acceptedApplication.instructorName })}
            </Text>
          ) : job.applicationsCount > 0 ? (
            <Text
              style={{
                ...BrandType.caption,
                color: palette.textMuted as string,
                paddingHorizontal: 2,
              }}
            >
              {t("jobsTab.card.applicantsProcessed", { count: job.applicationsCount })}
            </Text>
          ) : job.status === "open" ? (
            <Text
              style={{
                ...BrandType.caption,
                color: palette.textMuted as string,
                paddingHorizontal: 2,
              }}
            >
              {t("jobsTab.card.liveOnBoard", {})}
            </Text>
          ) : null}
        </View>
      </KitSurface>
    </Animated.View>
  );
});
