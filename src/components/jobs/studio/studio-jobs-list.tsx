import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { ThemedText } from "@/components/themed-text";
import { KitButton } from "@/components/ui/kit";
import { NativeList, NativeListItem } from "@/components/ui/native-list";
import { BrandRadius, BrandSpacing, type BrandPalette } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import {
  formatDateTime,
  getApplicationStatusTranslationKey,
  getJobStatusTone,
  JOB_STATUS_TRANSLATION_KEYS,
} from "@/lib/jobs-utils";
import { View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import type { TFunction } from "i18next";

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
};

type StudioJobsListProps = {
  jobs: StudioJob[];
  locale: string;
  zoneLanguage: "en" | "he";
  palette: BrandPalette;
  reviewingApplicationId: Id<"jobApplications"> | null;
  onReview: (applicationId: Id<"jobApplications">, status: "accepted" | "rejected") => void;
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
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}
    >
      <ThemedText type="micro" style={{ color: token.fg }}>
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
  onReview,
  t,
}: StudioJobsListProps) {
  if (jobs.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: BrandSpacing.sm, paddingHorizontal: BrandSpacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: BrandSpacing.xs }}>
        <ThemedText type="title">{t("jobsTab.studioFeedTitle")}</ThemedText>
        <ThemedText type="bodyStrong" style={{ color: palette.textMuted }}>
          {jobs.length}
        </ThemedText>
      </View>
      <NativeList inset>
        {jobs.map((job, index) => (
          <NativeListItem key={job.jobId}>
            <Animated.View
              entering={FadeInUp.delay(Math.min(index, 5) * 34).duration(260).springify()}
              style={{ gap: 8 }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText type="defaultSemiBold">{toSportLabel(job.sport as never)}</ThemedText>
                </View>
                <JobStatusBadge status={job.status} palette={palette} t={t} />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <View
                  style={{
                    borderWidth: 1,
                    borderRadius: BrandRadius.pill,
                    borderCurve: "continuous",
                    borderColor: palette.border,
                    backgroundColor: palette.surfaceAlt,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <ThemedText type="micro" style={{ color: palette.textMuted }}>
                    {getZoneLabel(job.zone, zoneLanguage)}
                  </ThemedText>
                </View>
                <View
                  style={{
                    borderWidth: 1,
                    borderRadius: BrandRadius.pill,
                    borderCurve: "continuous",
                    borderColor: palette.border,
                    backgroundColor: palette.surfaceAlt,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <ThemedText type="micro" style={{ color: palette.textMuted }}>
                    {formatDateTime(job.startTime, locale)}
                  </ThemedText>
                </View>
                <View
                  style={{
                    borderWidth: 1,
                    borderRadius: BrandRadius.pill,
                    borderCurve: "continuous",
                    borderColor: palette.borderStrong,
                    backgroundColor: palette.surface,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <ThemedText type="micro" selectable style={{ color: palette.text, fontVariant: ["tabular-nums"] }}>
                    {t("jobsTab.card.pay", { value: job.pay })}
                  </ThemedText>
                </View>
              </View>

              <ThemedText style={{ color: palette.textMuted }}>
                {t("jobsTab.applicationsCount", {
                  total: job.applicationsCount,
                  pending: job.pendingApplicationsCount,
                })}
              </ThemedText>

              <View style={{ gap: 10 }}>
                <ThemedText type="defaultSemiBold">
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
                        backgroundColor: palette.surfaceAlt,
                        borderRadius: 12,
                        borderCurve: "continuous",
                        padding: 10,
                        gap: 6,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <ThemedText type="defaultSemiBold">
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
                            paddingVertical: 3,
                          }}
                        >
                          <ThemedText
                            type="micro"
                            style={{
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
                      <ThemedText style={{ color: palette.textMuted }}>
                        {formatDateTime(application.appliedAt, locale)}
                      </ThemedText>
                      {application.message ? <ThemedText>{application.message}</ThemedText> : null}
                      {application.status === "pending" && job.status === "open" ? (
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <KitButton
                            style={{ flex: 1 }}
                            label={
                              reviewingApplicationId === application.applicationId
                                ? t("jobsTab.actions.accepting")
                                : t("jobsTab.actions.accept")
                            }
                            onPress={() => onReview(application.applicationId, "accepted")}
                            disabled={reviewingApplicationId === application.applicationId}
                          />
                          <KitButton
                            style={{ flex: 1 }}
                            label={
                              reviewingApplicationId === application.applicationId
                                ? t("jobsTab.actions.rejecting")
                                : t("jobsTab.actions.reject")
                            }
                            variant="secondary"
                            onPress={() => onReview(application.applicationId, "rejected")}
                            disabled={reviewingApplicationId === application.applicationId}
                          />
                        </View>
                      ) : null}
                    </Animated.View>
                  ))
                )}
              </View>
            </Animated.View>
          </NativeListItem>
        ))}
      </NativeList>
    </View>
  );
}

