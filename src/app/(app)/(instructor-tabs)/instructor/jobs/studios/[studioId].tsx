import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { DotStatusPill } from "@/components/home/home-shared";
import {
  InstructorJobCard,
  type InstructorMarketplaceJob,
} from "@/components/jobs/instructor/instructor-job-card";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { useTheme } from "@/hooks/use-theme";
import { openInstructorVerificationGate } from "@/lib/open-instructor-verification-gate";

export default function InstructorStudioProfileRoute() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const now = useMinuteNow();
  const { color: palette } = useTheme();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const { studioId, jobId } = useLocalSearchParams<{
    studioId?: string;
    jobId?: string;
  }>();
  const [applyingJobId, setApplyingJobId] = useState<Id<"jobs"> | null>(null);
  const [withdrawingApplicationId, setWithdrawingApplicationId] =
    useState<Id<"jobApplications"> | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  // Additional spacing on top of the base insets applied by ScreenScaffold
  // ScreenScaffold automatically applies collapsedSheetHeight and safeBottom
  const additionalSpacing = {
    paddingTop: BrandSpacing.xs,
    paddingBottom: BrandSpacing.xxl,
    paddingHorizontal: BrandSpacing.xl,
  };

  const queryNow = Math.floor(now / (60 * 1000)) * 60 * 1000;
  const applyToJob = useMutation(api.jobs.applyToJob);
  const withdrawApplication = useMutation(api.jobs.withdrawApplication);
  const studioProfile = useQuery(
    api.jobs.getStudioProfileForInstructor,
    studioId ? { studioId: studioId as Id<"studioProfiles">, now: queryNow } : "skip",
  );
  const myApplications = useQuery(api.jobs.getMyApplications, { limit: 120 });

  const onApply = useCallback(
    async (job: InstructorMarketplaceJob) => {
      if (!job.canApplyToJob) {
        openInstructorVerificationGate(t, {
          onVerifyNow: () => router.push("/instructor/profile/compliance"),
        });
        return;
      }
      setActionErrorMessage(null);
      setApplyingJobId(job.jobId);
      try {
        await applyToJob({ jobId: job.jobId });
      } catch (error) {
        console.error("[studio-profile] apply failed", error);
        setActionErrorMessage(t("jobsTab.errors.applyError"));
      } finally {
        setApplyingJobId(null);
      }
    },
    [applyToJob, router, t],
  );

  const onWithdrawApplication = useCallback(
    async (applicationId: Id<"jobApplications">) => {
      setActionErrorMessage(null);
      setWithdrawingApplicationId(applicationId);
      try {
        await withdrawApplication({ applicationId });
      } catch (error) {
        console.error("[studio-profile] withdraw failed", error);
        setActionErrorMessage(t("jobsTab.errors.withdrawError"));
      } finally {
        setWithdrawingApplicationId(null);
      }
    },
    [t, withdrawApplication],
  );

  const sortedJobs = useMemo<InstructorMarketplaceJob[]>(() => {
    if (!studioProfile?.jobs) return [];
    const applications: Array<{
      applicationId: Id<"jobApplications">;
      jobId: Id<"jobs">;
      status: NonNullable<InstructorMarketplaceJob["applicationStatus"]>;
    }> = (myApplications ?? []).map((application) => ({
      applicationId: application.applicationId,
      jobId: application.jobId,
      status: application.status,
    }));
    const applicationByJobId = new Map(
      applications.map((application) => [String(application.jobId), application] as const),
    );
    const selectedJobId = jobId ? String(jobId) : null;
    return [...studioProfile.jobs]
      .map((job) => {
        const application = applicationByJobId.get(String(job.jobId));
        if (!application) {
          return job;
        }
        return {
          ...job,
          applicationId: application.applicationId,
          applicationStatus: application.status,
        };
      })
      .sort((left, right) => {
        if (selectedJobId) {
          const leftSelected = String(left.jobId) === selectedJobId;
          const rightSelected = String(right.jobId) === selectedJobId;
          if (leftSelected && !rightSelected) return -1;
          if (!leftSelected && rightSelected) return 1;
        }
        return left.startTime - right.startTime;
      });
  }, [jobId, myApplications, studioProfile?.jobs]);

  const sportsLabels = useMemo<string[]>(
    () =>
      (studioProfile?.sports ?? []).map((sport: string) => toSportLabel(sport as never)),
    [studioProfile?.sports],
  );

  if (!studioId) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  if (studioProfile === undefined) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  if (studioProfile === null) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  return (
    <TabScreenScrollView
      style={{ flex: 1, backgroundColor: palette.appBg }}
      topInsetTone="sheet"
      contentContainerStyle={[
        additionalSpacing,
        {
          gap: BrandSpacing.lg,
        },
      ]}
    >
      {sportsLabels.length > 0 || studioProfile.bio ? (
        <View
          style={{
            borderRadius: 32,
            borderCurve: "continuous",
            backgroundColor: palette.surface,
          }}
        >
          <View
            style={{
              paddingHorizontal: BrandSpacing.xl,
              paddingVertical: BrandSpacing.lg,
              gap: BrandSpacing.md,
            }}
          >
            {sportsLabels.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {sportsLabels.map((label: string) => (
                  <DotStatusPill
                    key={label}
                    backgroundColor={palette.primarySubtle}
                    color={palette.primary}
                    label={label}
                  />
                ))}
              </View>
            ) : null}
            {studioProfile.bio ? (
              <Text
                style={{
                  ...BrandType.body,
                  color: palette.textMuted,
                  includeFontPadding: false,
                }}
              >
                {studioProfile.bio}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {actionErrorMessage ? (
        <NoticeBanner
          tone="error"
          message={actionErrorMessage}
          onDismiss={() => setActionErrorMessage(null)}
          borderColor={palette.danger}
          backgroundColor={palette.dangerSubtle}
          textColor={palette.danger}
          iconColor={palette.danger}
        />
      ) : null}

      <View style={{ gap: BrandSpacing.sm }}>
        {sortedJobs.map((job) => (
          <InstructorJobCard
            key={job.jobId}
            job={job}
            locale={locale}
            zoneLanguage={zoneLanguage}
            applyingJobId={applyingJobId}
            withdrawingApplicationId={withdrawingApplicationId}
            now={now}
            onApply={onApply}
            onWithdrawApplication={onWithdrawApplication}
            t={t}
            variant="studioDetail"
          />
        ))}
      </View>
    </TabScreenScrollView>
  );
}
