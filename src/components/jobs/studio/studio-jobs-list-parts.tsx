import type { TFunction } from "i18next";
import { type ComponentProps, memo } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { DotStatusPill } from "@/components/home/home-shared";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSurface } from "@/components/ui/kit";
import { type BrandPalette, BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import {
  formatDateWithWeekday,
  formatTime,
  getApplicationStatusTranslationKey,
  getBoostPresentation,
  getExpiryPresentation,
  getJobStatusToneWithReason,
  getJobStatusTranslationKey,
  type JobStatusTone,
} from "@/lib/jobs-utils";
import type { PaymentStatus, PayoutStatus } from "@/lib/payments-utils";
import { appStatusDot, paymentDotColor } from "./studio-jobs-list.helpers";
import type { StudioJob, StudioJobApplication } from "./studio-jobs-list.types";

const AVATAR_SIZE = BrandSpacing.xxl + BrandSpacing.xxl + 2;
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

  if (tone === "gray") {
    return {
      color: palette.textMuted as string,
      backgroundColor: palette.surfaceAlt as string,
    };
  }

  return {
    color: palette.textMuted as string,
    backgroundColor: palette.surface as string,
  };
}

function MetaPill({
  icon,
  label,
  palette,
  tone = "default",
}: {
  icon: ComponentProps<typeof IconSymbol>["name"];
  label: string;
  palette: BrandPalette;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const backgroundColor =
    tone === "warning"
      ? (palette.warningSubtle as string)
      : tone === "danger"
        ? (palette.dangerSubtle as string)
        : tone === "success"
          ? (palette.successSubtle as string)
          : (palette.surfaceAlt as string);
  const color =
    tone === "warning"
      ? (palette.warning as string)
      : tone === "danger"
        ? (palette.danger as string)
        : tone === "success"
          ? (palette.success as string)
          : (palette.textMuted as string);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: BrandSpacing.sm,
        borderRadius: BrandRadius.pill,
        backgroundColor,
        paddingHorizontal: BrandSpacing.sm,
        paddingVertical: BrandSpacing.xs + 1,
      }}
    >
      <IconSymbol name={icon} size={12} color={color} />
      <Text
        numberOfLines={1}
        style={{
          ...BrandType.caption,
          color,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function InlineMeta({
  icon,
  text,
  palette,
  strong = false,
}: {
  icon: ComponentProps<typeof IconSymbol>["name"];
  text: string;
  palette: BrandPalette;
  strong?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <IconSymbol name={icon} size={15} color={palette.textMuted as string} />
      <Text
        numberOfLines={1}
        style={[
          strong ? BrandType.bodyStrong : BrandType.body,
          {
            color: strong ? (palette.text as string) : (palette.textMuted as string),
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
  const initials = application.instructorName
    .split(" ")
    .map((part) => part.trim().slice(0, 1))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const statusBackground =
    application.status === "accepted"
      ? (palette.successSubtle as string)
      : application.status === "rejected"
        ? (palette.dangerSubtle as string)
        : application.status === "pending"
          ? (palette.warningSubtle as string)
          : (palette.surfaceAlt as string);
  const metaText = `${t("jobsTab.card.applied")} · ${formatDateWithWeekday(application.appliedAt, locale)} · ${formatTime(application.appliedAt, locale)}`;

  return (
    <Animated.View entering={FadeInUp.duration(220).springify().damping(18)}>
      <View
        style={{
          gap: 12,
          borderRadius: BrandRadius.card - 4,
          borderCurve: "continuous",
          backgroundColor: palette.surface as string,
          paddingHorizontal: 14,
          paddingVertical: 13,
        }}
      >
        <View
          style={{
            flexDirection: isWideWeb ? "row" : "column",
            alignItems: isWideWeb ? "center" : "stretch",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <View
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: AVATAR_RADIUS,
                borderCurve: "continuous",
                backgroundColor: statusBackground,
              }}
            >
              <Text
                style={{
                  ...BrandType.bodyStrong,
                  fontSize: 14,
                  lineHeight: 16,
                  color: appDot,
                }}
              >
                {initials || "?"}
              </Text>
            </View>

            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text
                numberOfLines={1}
                style={{
                  ...BrandType.bodyStrong,
                  fontSize: 15,
                  lineHeight: 19,
                  color: palette.text as string,
                }}
              >
                {application.instructorName}
              </Text>
              {application.message ? (
                <Text
                  numberOfLines={isWideWeb ? 1 : 2}
                  style={{
                    ...BrandType.caption,
                    color: palette.textMuted as string,
                  }}
                >
                  {application.message}
                </Text>
              ) : (
                <Text
                  numberOfLines={1}
                  style={{
                    ...BrandType.caption,
                    color: palette.textMicro as string,
                  }}
                >
                  {metaText}
                </Text>
              )}
            </View>
          </View>

          <View
            style={{
              alignSelf: isWideWeb ? "center" : "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <DotStatusPill
              backgroundColor={palette.surfaceAlt as string}
              color={appDot}
              label={t(getApplicationStatusTranslationKey(application.status))}
            />
          </View>
        </View>

        {application.message ? (
          <InlineMeta icon="calendar.badge.clock" text={metaText} palette={palette} />
        ) : null}

        {canReview ? (
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: BrandSpacing.sm, paddingTop: 2 }}
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
  const dateLabel = formatDateWithWeekday(job.startTime, locale);
  const timeLabel = `${formatTime(job.startTime, locale)}  \u2192  ${formatTime(job.endTime, locale)}`;
  const zoneLabel = getZoneLabel(job.zone, zoneLanguage);
  const expiryTone = expiry?.isExpired ? "danger" : "warning";
  const cardBackground =
    job.pendingApplicationsCount > 0 ? (palette.surfaceAlt as string) : (palette.surface as string);

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
          borderRadius: isWideWeb ? 28 : BrandRadius.card,
          borderCurve: "continuous",
          backgroundColor: cardBackground,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            gap: 16,
            paddingHorizontal: isWideWeb ? 20 : 18,
            paddingVertical: isWideWeb ? 18 : 16,
          }}
        >
          <View style={{ gap: 14 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    ...BrandType.title,
                    fontSize: isWideWeb ? 22 : 20,
                    lineHeight: isWideWeb ? 26 : 24,
                    color: palette.text as string,
                  }}
                >
                  {toSportLabel(job.sport as never)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    ...BrandType.caption,
                    color: palette.textMuted as string,
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

              <View style={{ alignItems: "flex-end", gap: 8 }}>
                <DotStatusPill
                  backgroundColor={statusPill.backgroundColor}
                  color={statusPill.color}
                  label={t(getJobStatusTranslationKey(job.status, job.closureReason))}
                />
                {job.pendingApplicationsCount > 0 ? (
                  <DotStatusPill
                    backgroundColor={palette.primarySubtle as string}
                    color={palette.primary as string}
                    label={t("jobsTab.card.toReview", { count: job.pendingApplicationsCount })}
                  />
                ) : null}
              </View>
            </View>

            <View
              style={{
                gap: 10,
                borderRadius: BrandRadius.card - 4,
                borderCurve: "continuous",
                backgroundColor: palette.surface as string,
                paddingHorizontal: 14,
                paddingVertical: 13,
              }}
            >
              <InlineMeta icon="calendar" text={dateLabel} palette={palette} />
              <InlineMeta icon="clock" text={timeLabel} palette={palette} strong />
              <InlineMeta icon="mappin.and.ellipse" text={zoneLabel} palette={palette} />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <Text
                  style={{
                    ...BrandType.heading,
                    fontSize: isWideWeb ? 30 : 28,
                    lineHeight: isWideWeb ? 32 : 30,
                    color: palette.success as string,
                  }}
                >
                  ₪{boost.totalPay}
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    gap: 8,
                    flex: 1,
                  }}
                >
                  {boost.badgeKey ? (
                    <MetaPill
                      icon="sparkles"
                      label={t(boost.badgeKey, boost.badgeInterpolation)}
                      palette={palette}
                      tone="success"
                    />
                  ) : null}
                  {shouldShowExpiry && expiry ? (
                    <MetaPill
                      icon="clock.fill"
                      label={t(expiry.key, expiry.interpolation)}
                      palette={palette}
                      tone={expiryTone}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </View>

          {["filled", "completed"].includes(job.status) ? (
            <View
              style={{
                gap: 10,
                borderRadius: BrandRadius.card - 2,
                borderCurve: "continuous",
                backgroundColor: palette.surface as string,
                paddingHorizontal: 14,
                paddingVertical: 13,
              }}
            >
              <View
                style={{
                  flexDirection: isWideWeb ? "row" : "column",
                  alignItems: isWideWeb ? "center" : "flex-start",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <View style={{ gap: 6, flex: 1 }}>
                  <Text
                    style={{
                      ...BrandType.caption,
                      color: palette.textMuted as string,
                    }}
                  >
                    {t("jobsTab.card.settlement")}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
            </View>
          ) : null}

          {job.pendingApplicationsCount > 0 ? (
            <View style={{ gap: 10 }}>
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
          ) : null}
        </View>
      </KitSurface>
    </Animated.View>
  );
});
