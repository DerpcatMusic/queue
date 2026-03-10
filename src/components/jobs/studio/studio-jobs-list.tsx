import type { TFunction } from "i18next";
import { Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { DotStatusPill, MetricCell } from "@/components/home/home-shared";
import { KitButton, KitSurface } from "@/components/ui/kit";
import { type BrandPalette, BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import {
  formatDateTime,
  getApplicationStatusTranslationKey,
  getJobStatusTone,
  JOB_STATUS_TRANSLATION_KEYS,
} from "@/lib/jobs-utils";
import {
  getPaymentStatusLabel,
  getPaymentStatusTone,
  getPayoutStatusLabel,
  type PaymentStatus,
  type PayoutStatus,
} from "@/lib/payments-utils";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";

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

function ApplicationRow({
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
              style={{ ...BrandType.caption, color: palette.textMuted as string }}
              numberOfLines={isWideWeb ? 1 : 2}
            >
              {application.message}
            </Text>
          ) : null}
        </View>

        <View style={{ width: isWideWeb ? 150 : undefined }}>
          <MetricCell
            label={t("jobsTab.card.applied", { defaultValue: "Applied" })}
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
            <KitButton
              label={isReviewing ? t("jobsTab.actions.rejecting") : t("jobsTab.actions.reject")}
              onPress={() => onReview(application.applicationId, "rejected")}
              variant="secondary"
              size="sm"
              fullWidth={false}
              disabled={isReviewing}
            />
            <KitButton
              label={isReviewing ? t("jobsTab.actions.accepting") : t("jobsTab.actions.accept")}
              onPress={() => onReview(application.applicationId, "accepted")}
              variant="primary"
              size="sm"
              fullWidth={false}
              loading={isReviewing}
            />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

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
        const dotColor = jobStatusDot(job.status, palette);
        const payDotColor = paymentDotColor(job.payment?.status, palette);
        const canPay =
          ["filled", "completed"].includes(job.status) &&
          !(
            job.payment &&
            ["created", "pending", "authorized", "captured", "refunded"].includes(
              job.payment.status,
            )
          );
        const acceptedApplication = job.applications.find(
          (application) => application.status === "accepted",
        );
        const pendingLabel =
          job.pendingApplicationsCount > 0
            ? t("jobsTab.card.pendingCount", {
                count: job.pendingApplicationsCount,
                defaultValue: `${String(job.pendingApplicationsCount)} pending`,
              })
            : job.applicationsCount > 0
              ? t("jobsTab.card.reviewedCount", {
                  count: job.applicationsCount,
                  defaultValue: `${String(job.applicationsCount)} reviewed`,
                })
              : t("jobsTab.card.noApplicants", { defaultValue: "No applicants" });
        const listTone =
          job.pendingApplicationsCount > 0
            ? (palette.primarySubtle as string)
            : (palette.surfaceAlt as string);

        return (
          <Animated.View
            key={job.jobId}
            entering={FadeInUp.delay(Math.min(index, 5) * 36)
              .duration(280)
              .springify()
              .damping(18)}
          >
            <KitSurface
              tone="base"
              padding={BrandSpacing.lg}
              gap={0}
              style={{
                borderRadius: isWideWeb ? 28 : BrandRadius.card,
                borderCurve: "continuous",
                backgroundColor: listTone,
                paddingHorizontal: isWideWeb ? 18 : BrandSpacing.lg,
                paddingVertical: isWideWeb ? 18 : 16,
              }}
            >
              <View style={{ gap: 14 }}>
                <View
                  style={{
                    flexDirection: isWideWeb ? "row" : "column",
                    alignItems: isWideWeb ? "center" : "stretch",
                    gap: isWideWeb ? 16 : 12,
                  }}
                >
                  <View style={{ flex: isWideWeb ? 1.6 : undefined, minWidth: 0, gap: 6 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Text
                        style={{
                          ...BrandType.heading,
                          fontSize: isWideWeb ? 24 : 22,
                          lineHeight: isWideWeb ? 26 : 25,
                          color: palette.text as string,
                        }}
                        numberOfLines={1}
                      >
                        {toSportLabel(job.sport as never)}
                      </Text>
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
                            defaultValue: `${String(job.pendingApplicationsCount)} to review`,
                          })}
                        />
                      ) : null}
                    </View>

                    <Text
                      style={{ ...BrandType.caption, color: palette.textMuted as string }}
                      numberOfLines={1}
                    >
                      {pendingLabel}
                    </Text>

                    {acceptedApplication ? (
                      <Text
                        style={{ ...BrandType.caption, color: palette.textMuted as string }}
                        numberOfLines={1}
                      >
                        {t("jobsTab.card.assignedInstructor", {
                          name: acceptedApplication.instructorName,
                          defaultValue: `Assigned: ${acceptedApplication.instructorName}`,
                        })}
                      </Text>
                    ) : null}
                  </View>

                  <View style={{ width: isWideWeb ? 200 : undefined }}>
                    <MetricCell
                      label={t("jobsTab.card.shift", { defaultValue: "Shift" })}
                      value={formatDateTime(job.startTime, locale)}
                      palette={palette}
                    />
                  </View>

                  <View style={{ width: isWideWeb ? 150 : undefined }}>
                    <MetricCell
                      label={t("jobsTab.card.zone", { defaultValue: "Zone" })}
                      value={getZoneLabel(job.zone, zoneLanguage)}
                      palette={palette}
                    />
                  </View>

                  <View style={{ width: isWideWeb ? 150 : undefined }}>
                    <MetricCell
                      align={isWideWeb ? "flex-end" : "flex-start"}
                      label={t("jobsTab.card.payLabel", { defaultValue: "Pay" })}
                      value={t("jobsTab.card.pay", { value: job.pay })}
                      palette={palette}
                    />
                  </View>
                </View>

                {["filled", "completed"].includes(job.status) ? (
                  <View
                    style={{
                      flexDirection: isWideWeb ? "row" : "column",
                      alignItems: isWideWeb ? "center" : "stretch",
                      gap: 10,
                      borderRadius: BrandRadius.card,
                      borderCurve: "continuous",
                      backgroundColor: palette.surface as string,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
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
                        {t("jobsTab.card.settlement", { defaultValue: "Settlement" })}
                      </Text>
                      <DotStatusPill
                        backgroundColor={palette.surfaceAlt as string}
                        color={payDotColor}
                        label={
                          job.payment
                            ? t(PAYMENT_STATUS_KEY[job.payment.status], {
                                defaultValue: getPaymentStatusLabel(job.payment.status),
                              })
                            : t("jobsTab.checkout.notStarted")
                        }
                      />
                      {job.payment?.payoutStatus ? (
                        <DotStatusPill
                          backgroundColor={palette.surfaceAlt as string}
                          color={palette.text as string}
                          label={t(PAYOUT_STATUS_KEY[job.payment.payoutStatus], {
                            defaultValue: getPayoutStatusLabel(job.payment.payoutStatus),
                          })}
                        />
                      ) : null}
                    </View>

                    {canPay ? (
                      <KitButton
                        label={
                          payingJobId === job.jobId
                            ? t("jobsTab.checkout.starting")
                            : job.payment && ["failed", "cancelled"].includes(job.payment.status)
                              ? t("jobsTab.checkout.retryPayment")
                              : t("jobsTab.checkout.payNow")
                        }
                        onPress={() => onStartPayment(job.jobId)}
                        loading={payingJobId === job.jobId}
                        variant="primary"
                        size="sm"
                        fullWidth={false}
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
                        {t("jobsTab.card.reviewQueue", { defaultValue: "Review queue" })}
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
                          defaultValue: `${String(job.pendingApplicationsCount)} waiting`,
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
                  <View
                    style={{
                      borderRadius: BrandRadius.card,
                      borderCurve: "continuous",
                      backgroundColor: palette.surface as string,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                      {t("jobsTab.card.assignedTo", {
                        name: acceptedApplication.instructorName,
                        defaultValue: `Assigned to ${acceptedApplication.instructorName}`,
                      })}
                    </Text>
                  </View>
                ) : job.applicationsCount > 0 ? (
                  <View
                    style={{
                      borderRadius: BrandRadius.card,
                      borderCurve: "continuous",
                      backgroundColor: palette.surface as string,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                      {t("jobsTab.card.applicantsProcessed", {
                        count: job.applicationsCount,
                        defaultValue: `${String(job.applicationsCount)} applicants processed`,
                      })}
                    </Text>
                  </View>
                ) : job.status === "open" ? (
                  <View
                    style={{
                      borderRadius: BrandRadius.card,
                      borderCurve: "continuous",
                      backgroundColor: palette.surface as string,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                      {t("jobsTab.card.liveOnBoard", {
                        defaultValue: "Live on the board — new applicants arrive here.",
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </KitSurface>
          </Animated.View>
        );
      })}
    </View>
  );
}
