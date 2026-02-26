import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { ThemedText } from "@/components/themed-text";
import { KitSurface } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, type BrandPalette } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
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
import { View, Pressable } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import type { TFunction } from "i18next";
import { AppSymbol } from "@/components/ui/app-symbol";

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
  payment:
    | {
        paymentId: Id<"payments">;
        status: PaymentStatus;
        payoutStatus: PayoutStatus | null;
      }
    | null;
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

function JobStatusBadge({
  status,
  palette,
  t,
}: {
  status: StudioJob["status"];
  palette: BrandPalette;
  t: TFunction;
}) {
  const tone = getJobStatusTone(status);
  const token =
    tone === "primary"
      ? { fg: palette.primary, bg: palette.primarySubtle, border: palette.primary }
      : tone === "success"
        ? { fg: palette.success as import("react-native").ColorValue, bg: palette.successSubtle, border: palette.success as import("react-native").ColorValue }
        : { fg: palette.textMuted, bg: palette.surfaceAlt, border: palette.borderStrong };

  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: BrandRadius.pill,
        borderCurve: "continuous",
        borderColor: token.border,
        backgroundColor: token.bg,
        paddingHorizontal: 8,
        paddingVertical: 2,
        alignSelf: "flex-start",
      }}
    >
      <ThemedText type="micro" style={{ color: token.fg, fontWeight: "500" }}>
        {t(JOB_STATUS_TRANSLATION_KEYS[status])}
      </ThemedText>
    </View>
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
  if (jobs.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: BrandSpacing.sm, paddingHorizontal: BrandSpacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: BrandSpacing.xs }}>
        <ThemedText type="title">{t("jobsTab.studioFeedTitle")}</ThemedText>
        <ThemedText type="bodyStrong" style={{ color: palette.textMuted }}>
          {jobs.length}
        </ThemedText>
      </View>
      <View style={{ gap: BrandSpacing.md }}>
        {jobs.map((job, index) => (
          <Animated.View
            key={job.jobId}
            entering={FadeInUp.delay(Math.min(index, 5) * 34).duration(260).springify()}
          >
            <View style={{ position: "relative" }}>
              <KitSurface
                tone="elevated"
                style={{
                  padding: BrandSpacing.lg,
                  gap: BrandSpacing.sm,
                  overflow: "hidden",
                }}
              >
                {/* Header Row: Sport & Badges */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText
                      style={{
                        fontSize: 24,
                        lineHeight: 30,
                        fontWeight: "600",
                        color: palette.text,
                        letterSpacing: -0.2,
                      }}
                    >
                      {toSportLabel(job.sport as never)}
                    </ThemedText>
                  </View>
                  <JobStatusBadge status={job.status} palette={palette} t={t} />
                </View>

                {/* Details Row: Time & Zone */}
                <View style={{ gap: 6, marginVertical: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AppSymbol name="calendar.circle.fill" size={16} tintColor={palette.textMuted} />
                    <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "400" }}>
                      {formatDateTime(job.startTime, locale)}
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AppSymbol name="mappin.circle.fill" size={16} tintColor={palette.textMuted} />
                    <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "400" }}>
                      {getZoneLabel(job.zone, zoneLanguage)}
                    </ThemedText>
                  </View>
                </View>

                {/* Footer Row: Price (Left) & Actions/Count via flex layout */}
                <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.border }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                    <ThemedText
                      style={{
                        fontSize: 29,
                        fontWeight: "600",
                        color: palette.text,
                        fontVariant: ["tabular-nums"],
                        letterSpacing: -0.4,
                      }}
                    >
                      {t("jobsTab.card.pay", { value: job.pay })}
                    </ThemedText>
                  </View>
                  
                  {/* Push application context to the right using marginLeft auto */}
                  <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
                    <ThemedText style={{ color: palette.textMuted, fontWeight: "500" }}>
                      {t("jobsTab.applicationsCount", {
                        total: job.applicationsCount,
                        pending: job.pendingApplicationsCount,
                      })}
                    </ThemedText>
                  </View>
                </View>

                {/* Payment Section (if applicable) */}
                {["filled", "completed"].includes(job.status) ? (
                  <View
                    style={{
                      marginTop: BrandSpacing.sm,
                      borderWidth: 1,
                      borderColor: palette.border,
                      backgroundColor: palette.appBg,
                      borderRadius: 10,
                      borderCurve: "continuous",
                      paddingHorizontal: BrandSpacing.sm,
                      paddingVertical: BrandSpacing.xs,
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <ThemedText type="defaultSemiBold" style={{ fontSize: 13, letterSpacing: 0.2, color: palette.textMuted }}>Payment</ThemedText>
                      <View
                        style={{
                          borderWidth: 1,
                          borderRadius: BrandRadius.pill,
                          borderCurve: "continuous",
                          borderColor:
                            !job.payment
                              ? palette.borderStrong
                              : getPaymentStatusTone(job.payment.status) === "success"
                                ? (palette.success as import("react-native").ColorValue)
                                : getPaymentStatusTone(job.payment.status) === "warning"
                                  ? (palette.warning as import("react-native").ColorValue)
                                  : getPaymentStatusTone(job.payment.status) === "danger"
                                    ? palette.danger
                                    : palette.primary,
                          backgroundColor:
                            !job.payment
                              ? palette.surfaceAlt
                              : getPaymentStatusTone(job.payment.status) === "success"
                                ? palette.successSubtle
                                : getPaymentStatusTone(job.payment.status) === "warning"
                                  ? palette.warningSubtle
                                  : getPaymentStatusTone(job.payment.status) === "danger"
                                    ? palette.dangerSubtle
                                    : palette.primarySubtle,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <ThemedText
                          type="micro"
                          style={{
                            fontWeight: "500",
                            color:
                              !job.payment
                                ? palette.textMuted
                                : getPaymentStatusTone(job.payment.status) === "success"
                                  ? (palette.success as import("react-native").ColorValue)
                                  : getPaymentStatusTone(job.payment.status) === "warning"
                                    ? (palette.warning as import("react-native").ColorValue)
                                    : getPaymentStatusTone(job.payment.status) === "danger"
                                      ? palette.danger
                                      : palette.primary,
                          }}
                        >
                          {job.payment
                            ? getPaymentStatusLabel(job.payment.status)
                            : "Not started"}
                        </ThemedText>
                      </View>
                    </View>
                    {job.payment?.payoutStatus ? (
                      <ThemedText type="caption" style={{ color: palette.textMuted }}>
                        {`Payout: ${getPayoutStatusLabel(job.payment.payoutStatus)}`}
                      </ThemedText>
                    ) : null}
                    {!(
                      job.payment &&
                      ["created", "pending", "authorized", "captured", "refunded"].includes(
                        job.payment.status,
                      )
                    ) ? (
                      <Pressable
                        style={[
                          {
                            minHeight: 44,
                            borderRadius: BrandRadius.card,
                            borderCurve: "continuous",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: palette.primary,
                            marginTop: 4,
                          },
                        ]}
                        onPress={() => onStartPayment(job.jobId)}
                        disabled={payingJobId === job.jobId}
                      >
                         <ThemedText
                          type="defaultSemiBold"
                          style={{ 
                            color: palette.onPrimary,
                            fontWeight: "600",
                            letterSpacing: 0.2,
                          }}
                        >
                          {payingJobId === job.jobId
                            ? "Starting checkout..."
                            : job.payment && ["failed", "cancelled"].includes(job.payment.status)
                              ? "Retry payment"
                              : "Pay now"}
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {/* Applications Section */}
                <View style={{ gap: BrandSpacing.sm, marginTop: BrandSpacing.md }}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 13, letterSpacing: 0.2 }}>
                    {t("jobsTab.studioApplicationsTitle")}
                  </ThemedText>
                  {job.applications.length === 0 ? (
                    <ThemedText style={{ color: palette.textMuted }}>
                      {t("jobsTab.emptyStudioApplications")}
                    </ThemedText>
                  ) : (
                    job.applications.map((application, appIndex) => (
                      <Animated.View
                        key={application.applicationId}
                        entering={FadeInUp.delay(Math.min(appIndex, 4) * 28).duration(220).springify()}
                        style={{
                          borderWidth: 1,
                          borderColor: palette.border,
                          backgroundColor: palette.appBg,
                          borderRadius: 12,
                          borderCurve: "continuous",
                          padding: BrandSpacing.sm,
                          gap: BrandSpacing.xs,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <ThemedText type="defaultSemiBold" style={{ fontSize: 18, letterSpacing: -0.2, fontWeight: "600" }}>
                            {application.instructorName}
                          </ThemedText>
                          <View
                            style={{
                              borderWidth: 1,
                              borderRadius: BrandRadius.pill,
                              borderCurve: "continuous",
                              borderColor:
                                application.status === "accepted"
                                  ? (palette.success as import("react-native").ColorValue)
                                  : application.status === "rejected"
                                    ? palette.danger
                                    : application.status === "pending"
                                      ? palette.primary
                                      : palette.borderStrong,
                              backgroundColor:
                                application.status === "accepted"
                                  ? palette.successSubtle
                                  : application.status === "rejected"
                                    ? palette.dangerSubtle
                                    : application.status === "pending"
                                      ? palette.primarySubtle
                                      : palette.surface,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                            }}
                          >
                            <ThemedText
                              type="micro"
                              style={{
                                fontWeight: "500",
                                color:
                                  application.status === "accepted"
                                    ? (palette.success as import("react-native").ColorValue)
                                    : application.status === "rejected"
                                      ? palette.danger
                                      : application.status === "pending"
                                        ? palette.primary
                                        : palette.textMuted,
                              }}
                            >
                              {t(getApplicationStatusTranslationKey(application.status))}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText style={{ color: palette.textMuted, fontSize: 13, fontWeight: "400" }}>
                          {formatDateTime(application.appliedAt, locale)}
                        </ThemedText>
                        {application.message ? <ThemedText style={{ marginTop: 4 }}>{application.message}</ThemedText> : null}
                        {application.status === "pending" && job.status === "open" ? (
                          <View style={{ flexDirection: "row", gap: 8, marginTop: BrandSpacing.sm }}>
                            <Pressable
                              style={{
                                flex: 1,
                                height: 40,
                                borderRadius: BrandRadius.card,
                                backgroundColor: palette.primary,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              disabled={reviewingApplicationId === application.applicationId}
                              onPress={() => onReview(application.applicationId, "accepted")}
                            >
                              <ThemedText style={{ color: palette.onPrimary, fontWeight: "600", fontSize: 13, letterSpacing: 0.2 }}>
                                {reviewingApplicationId === application.applicationId
                                    ? t("jobsTab.actions.accepting")
                                    : t("jobsTab.actions.accept")}
                              </ThemedText>
                            </Pressable>
                            <Pressable
                              style={{
                                flex: 1,
                                height: 40,
                                borderRadius: BrandRadius.card,
                                backgroundColor: palette.surfaceAlt,
                                borderWidth: 1,
                                borderColor: palette.border,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              disabled={reviewingApplicationId === application.applicationId}
                              onPress={() => onReview(application.applicationId, "rejected")}
                            >
                              <ThemedText style={{ color: palette.text, fontWeight: "600", fontSize: 13, letterSpacing: 0.2 }}>
                                {reviewingApplicationId === application.applicationId
                                  ? t("jobsTab.actions.rejecting")
                                  : t("jobsTab.actions.reject")}
                              </ThemedText>
                            </Pressable>
                          </View>
                        ) : null}
                      </Animated.View>
                    ))
                  )}
                </View>
              </KitSurface>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

