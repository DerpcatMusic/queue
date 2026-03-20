import type { TFunction } from "i18next";
import { type ComponentProps, memo } from "react";
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
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import {
  formatDateTime,
  getApplicationStatusTranslationKey,
  getJobStatusTone,
  JOB_STATUS_TRANSLATION_KEYS,
} from "@/lib/jobs-utils";
import { getPaymentStatusTone, type PaymentStatus, type PayoutStatus } from "@/lib/payments-utils";

type StudioJobApplication = {
  applicationId: Id<"jobApplications">;
  instructorName: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  appliedAt: number;
  message?: string | null;
};

type StudioJob = {
  jobId: Id<"jobs">;
  sport: string;
  status: "open" | "filled" | "cancelled" | "completed";
  zone: string;
  startTime: number;
  pay: number;
  applicationsCount: number;
  pendingApplicationsCount: number;
  applications: StudioJobApplication[];
  payment: {
    paymentId: Id<"payments">;
    status: PaymentStatus;
    payoutStatus: PayoutStatus | null;
  } | null;
};

type StudioJobsListProps = {
  jobs: StudioJob[];
  locale: string;
  zoneLanguage: "en" | "he";
  palette: BrandPalette;
  reviewingApplicationId: Id<"jobApplications"> | null;
  payingJobId: Id<"jobs"> | null;
  onReview: (applicationId: Id<"jobApplications">, status: "accepted" | "rejected") => void;
  onStartPayment: (jobId: Id<"jobs">) => void;
  t: TFunction;
};

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

function jobStatusDot(status: StudioJob["status"], palette: BrandPalette): string {
  const tone = getJobStatusTone(status);
  if (tone === "primary") return palette.primary as string;
  if (tone === "success") return palette.success as string;
  return palette.textMuted as string;
}

function paymentDotColor(status: PaymentStatus | undefined, palette: BrandPalette): string {
  if (!status) return palette.textMuted as string;
  const tone = getPaymentStatusTone(status);
  if (tone === "success") return palette.success as string;
  if (tone === "warning") return palette.warning as string;
  if (tone === "danger") return palette.danger as string;
  return palette.primary as string;
}

function appStatusDot(status: StudioJobApplication["status"], palette: BrandPalette): string {
  if (status === "accepted") return palette.success as string;
  if (status === "rejected") return palette.danger as string;
  if (status === "pending") return palette.warning as string;
  return palette.textMuted as string;
}

type SummaryChipProps = {
  icon: ComponentProps<typeof IconSymbol>["name"];
  text: string;
  palette: BrandPalette;
};

const SummaryChip = memo(function SummaryChip({ icon, text, palette }: SummaryChipProps) {
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
      <Text
        style={{
          ...BrandType.caption,
          color: palette.text as string,
        }}
      >
        {text}
      </Text>
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

const ApplicationRow = memo(function ApplicationRow({
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
    <Animated.View
      key={application.applicationId}
      entering={FadeInUp.duration(240).springify().damping(18)}
    >
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
              style={{
                ...BrandType.caption,
                color: palette.textMuted as string,
              }}
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

const StudioJobCard = memo(function StudioJobCard({
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
  const dotColor = jobStatusDot(job.status, palette);
  const payDotColor = paymentDotColor(job.payment?.status, palette);
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
      ? t("jobsTab.card.pendingCount", {
          count: job.pendingApplicationsCount,
        })
      : job.applicationsCount > 0
        ? t("jobsTab.card.reviewedCount", {
            count: job.applicationsCount,
          })
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
            <View
              style={{
                flex: isWideWeb ? 1.6 : undefined,
                minWidth: 0,
                gap: 8,
              }}
            >
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

                  {acceptedApplication ? (
                    <Text
                      style={{
                        ...BrandType.caption,
                        color: palette.textMuted as string,
                      }}
                      numberOfLines={1}
                    >
                      {t("jobsTab.card.assignedInstructor", {
                        name: acceptedApplication.instructorName,
                      })}
                    </Text>
                  ) : (
                    <Text
                      style={{
                        ...BrandType.caption,
                        color: palette.textMuted as string,
                      }}
                      numberOfLines={1}
                    >
                      {pendingLabel}
                    </Text>
                  )}
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <DotStatusPill
                    backgroundColor={palette.surface as string}
                    color={dotColor}
                    label={t(JOB_STATUS_TRANSLATION_KEYS[job.status])}
                  />
                  {job.pendingApplicationsCount > 0 ? (
                    <DotStatusPill
                      backgroundColor={palette.surface as string}
                      color={palette.primary as string}
                      label={t("jobsTab.card.toReview", {
                        count: job.pendingApplicationsCount,
                      })}
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
                  text={t("jobsTab.card.pay", { value: job.pay })}
                  palette={palette}
                />
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
                  color={payDotColor}
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
                  {t("jobsTab.card.waitingCount", {
                    count: job.pendingApplicationsCount,
                  })}
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
              {t("jobsTab.card.assignedTo", {
                name: acceptedApplication.instructorName,
              })}
            </Text>
          ) : job.applicationsCount > 0 ? (
            <Text
              style={{
                ...BrandType.caption,
                color: palette.textMuted as string,
                paddingHorizontal: 2,
              }}
            >
              {t("jobsTab.card.applicantsProcessed", {
                count: job.applicationsCount,
              })}
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

export function StudioJobsList({
  jobs,
  locale,
  zoneLanguage,
  palette,
  reviewingApplicationId,
  payingJobId,
  onReview,
  onStartPayment,
  t,
}: StudioJobsListProps) {
  const { isDesktopWeb: isWideWeb } = useLayoutBreakpoint();

  if (jobs.length === 0) return null;

  return (
    <View
      style={{
        gap: isWideWeb ? 10 : BrandSpacing.sm,
        paddingHorizontal: isWideWeb ? 18 : BrandSpacing.lg,
      }}
    >
      {jobs.map((job, index) => {
        return (
          <StudioJobCard
            key={job.jobId}
            job={job}
            index={index}
            isWideWeb={isWideWeb}
            locale={locale}
            zoneLanguage={zoneLanguage}
            palette={palette}
            reviewingApplicationId={reviewingApplicationId}
            payingJobId={payingJobId}
            onReview={onReview}
            onStartPayment={onStartPayment}
            t={t}
          />
        );
      })}
    </View>
  );
}
