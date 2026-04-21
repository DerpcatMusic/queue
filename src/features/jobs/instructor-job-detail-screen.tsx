import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DotStatusPill } from "@/components/home/home-shared";
import { InstructorJobCard } from "@/components/jobs/instructor/instructor-job-card";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import {
  createContentDrivenTopSheetConfig,
  useGlobalTopSheet,
} from "@/components/layout/top-sheet-registry";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import {
  InstructorJobDetailBanner,
  InstructorJobDetailContent,
} from "@/features/jobs/instructor-job-detail";
import { createInstructorJobDetailViewModel } from "@/features/jobs/instructor-job-detail-view-model";
import {
  type InstructorJobApplicationOverlay,
  type InstructorMarketplaceJob,
  mergeInstructorJobsWithApplications,
  sortInstructorJobsBySelectedId,
} from "@/features/jobs/instructor-marketplace-job";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { useTheme } from "@/hooks/use-theme";
import { openInstructorVerificationGate } from "@/lib/open-instructor-verification-gate";
import { Box } from "@/primitives";

type InstructorJobDetailScreenProps = {
  studioId?: string;
  jobId?: string;
  sheetTabId: "jobs" | "calendar";
  ownerPrefix: string;
};

export function InstructorJobDetailScreen({
  studioId,
  jobId,
  sheetTabId,
  ownerPrefix,
}: InstructorJobDetailScreenProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const now = useMinuteNow();
  const theme = useTheme();
  const { color: palette } = theme;
  const locale = i18n.resolvedLanguage ?? "en";
  const [applyingJobId, setApplyingJobId] = useState<Id<"jobs"> | null>(null);
  const [withdrawingApplicationId, setWithdrawingApplicationId] =
    useState<Id<"jobApplications"> | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const queryNow = Math.floor(now / (60 * 1000)) * 60 * 1000;
  const applyToJob = useMutation(api.jobs.applications.applyToJob);
  const withdrawApplication = useMutation(api.jobs.applications.withdrawApplication);
  const studioProfile = useQuery(
    api.jobs.browse.getStudioProfileForInstructor,
    studioId ? { studioId: studioId as Id<"studioProfiles">, now: queryNow } : "skip",
  );
  const myApplications = useQuery(api.jobs.applications.getMyApplications, { limit: 120 });

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
        const result = await applyToJob({ jobId: job.jobId });
        // Show success message with reason if available
        if (result.reason) {
          setActionErrorMessage(result.reason);
        }
      } catch (error: any) {
        console.error("[instructor-job-detail] apply failed", error);
        // Extract specific error message from ConvexError if available
        const convexError = error?.data?.data;
        if (convexError?.code === "MAX_APPLICATIONS_REACHED") {
          setActionErrorMessage(t("jobsTab.errors.maxApplicationsReached"));
        } else if (convexError?.code === "JOB_NOT_OPEN") {
          setActionErrorMessage(t("jobsTab.errors.jobNotOpen"));
        } else if (convexError?.code === "BOOKING_CONFLICT") {
          setActionErrorMessage(t("jobsTab.errors.bookingConflict"));
        } else if (convexError?.code === "APPLICATION_DEADLINE_PASSED") {
          setActionErrorMessage(t("jobsTab.errors.applicationDeadlinePassed"));
        } else {
          setActionErrorMessage(t("jobsTab.errors.applyError"));
        }
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
        console.error("[instructor-job-detail] withdraw failed", error);
        setActionErrorMessage(t("jobsTab.errors.withdrawError"));
      } finally {
        setWithdrawingApplicationId(null);
      }
    },
    [t, withdrawApplication],
  );

  const sortedJobs = useMemo<InstructorMarketplaceJob[]>(() => {
    if (!studioProfile?.jobs) return [];
    const applicationRows = (myApplications ?? []) as Array<{
      applicationId: Id<"jobApplications">;
      jobId: Id<"jobs">;
      status: InstructorJobApplicationOverlay["status"];
    }>;
    const applications: InstructorJobApplicationOverlay[] = applicationRows.map((application) => ({
        applicationId: application.applicationId,
        jobId: application.jobId,
        status: application.status,
      }));
    const mergedJobs = mergeInstructorJobsWithApplications(studioProfile.jobs, applications);
    return sortInstructorJobsBySelectedId(mergedJobs, jobId ? String(jobId) : null);
  }, [jobId, myApplications, studioProfile?.jobs]);

  const sportsLabels = useMemo<string[]>(
    () => (studioProfile?.sports ?? []).map((sport: string) => toSportLabel(sport as never)),
    [studioProfile?.sports],
  );
  const selectedJob = useMemo(
    () => (jobId ? (sortedJobs.find((job) => String(job.jobId) === String(jobId)) ?? null) : null),
    [jobId, sortedJobs],
  );
  const selectedJobDetail = useMemo(
    () =>
      selectedJob
        ? createInstructorJobDetailViewModel({
            job: selectedJob,
            studioName: studioProfile?.studioName ?? selectedJob.studioName,
            locale,
            now,
            t,
          })
        : null,
    [locale, now, selectedJob, studioProfile?.studioName, t],
  );
  const remainingJobs = useMemo(
    () =>
      selectedJob
        ? sortedJobs.filter((job) => String(job.jobId) !== String(selectedJob.jobId))
        : sortedJobs,
    [selectedJob, sortedJobs],
  );

  const selectedJobAction = useMemo(() => {
    if (!selectedJob) {
      return null;
    }

    const isExpired =
      typeof selectedJob.applicationDeadline === "number" &&
      Number.isFinite(selectedJob.applicationDeadline) &&
      selectedJob.applicationDeadline <= now;
    const hasApplied =
      selectedJob.applicationStatus === "pending" || selectedJob.applicationStatus === "accepted";
    const canCancelApplication =
      hasApplied &&
      selectedJob.applicationStatus === "pending" &&
      Boolean(selectedJob.applicationId);
    const canApply =
      (!selectedJob.applicationStatus ||
        selectedJob.applicationStatus === "withdrawn" ||
        selectedJob.applicationStatus === "rejected") &&
      !isExpired;

    if (canCancelApplication && selectedJob.applicationId) {
      return (
        <ActionButton
          label={
            withdrawingApplicationId === selectedJob.applicationId
              ? t("jobsTab.actions.cancelling")
              : t("jobsTab.actions.cancel")
          }
          tone="secondary"
          onPress={() => onWithdrawApplication(selectedJob.applicationId!)}
          loading={withdrawingApplicationId === selectedJob.applicationId}
        />
      );
    }

    if (canApply) {
      return (
        <ActionButton
          label={
            applyingJobId === selectedJob.jobId
              ? t("jobsTab.actions.applying")
              : selectedJob.canApplyToJob
                ? t("jobsTab.actions.apply")
                : t("jobsTab.actions.verifyToApply")
          }
          onPress={() => onApply(selectedJob)}
          loading={applyingJobId === selectedJob.jobId}
        />
      );
    }

    return null;
  }, [
    applyingJobId,
    now,
    onApply,
    onWithdrawApplication,
    selectedJob,
    t,
    withdrawingApplicationId,
  ]);
  const handleSelectRelatedJob = useCallback(
    (nextJobId: Id<"jobs">) => {
      if (!pathname || !studioId) {
        return;
      }
      router.replace({
        pathname: pathname as never,
        params: {
          studioId,
          jobId: String(nextJobId),
        },
      });
    },
    [pathname, router, studioId],
  );

  const topSheetConfig = useMemo(() => {
    if (!pathname || !selectedJob || !studioProfile) {
      return null;
    }

    return createContentDrivenTopSheetConfig({
      collapsedContent: (
        <InstructorJobDetailBanner
          studioName={studioProfile.studioName}
          sportLabel={toSportLabel(selectedJob.sport as never)}
          {...(studioProfile.studioImageUrl
            ? { studioImageUrl: studioProfile.studioImageUrl }
            : {})}
          onBack={() => router.back()}
        />
      ),
      padding: { vertical: 0, horizontal: 0 },
      backgroundColor: theme.color.surfaceElevated,
      topInsetColor: theme.color.surfaceElevated,
      style: {
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
    });
  }, [pathname, router, selectedJob, studioProfile, theme]);

  useGlobalTopSheet(sheetTabId, topSheetConfig, `${ownerPrefix}:${pathname}`, {
    routeMatchPath: pathname ?? undefined,
    routeMatchExact: true,
  });

  if (!studioId || !jobId) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  if (studioProfile === undefined || studioProfile === null) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  if (!selectedJob || !selectedJobDetail) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  return (
    <TabScreenScrollView
      style={{ flex: 1, backgroundColor: palette.appBg }}
      topInsetTone="sheet"
      sheetInsets={{
        topSpacing: BrandSpacing.xs,
        bottomSpacing: BrandSpacing.xxl,
        horizontalPadding: BrandSpacing.xl,
      }}
      contentContainerStyle={[
        {
          gap: BrandSpacing.lg,
        },
      ]}
    >
      {sportsLabels.length > 0 || studioProfile.bio ? (
        <Box
          style={{
            borderRadius: BrandRadius.soft,
            borderCurve: "continuous",
            backgroundColor: palette.surface,
          }}
        >
          <Box
            style={{
              paddingHorizontal: BrandSpacing.xl,
              paddingVertical: BrandSpacing.lg,
              gap: BrandSpacing.md,
            }}
          >
            {sportsLabels.length > 0 ? (
              <Box style={{ flexDirection: "row", flexWrap: "wrap", gap: BrandSpacing.sm }}>
                {sportsLabels.map((label: string) => (
                  <DotStatusPill
                    key={label}
                    backgroundColor={palette.primarySubtle}
                    color={palette.primary}
                    label={label}
                  />
                ))}
              </Box>
            ) : null}
            {studioProfile.bio ? (
              <ThemedText
                type="body"
                style={{
                  color: palette.textMuted,
                  includeFontPadding: false,
                }}
              >
                {studioProfile.bio}
              </ThemedText>
            ) : null}
          </Box>
        </Box>
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

      <Box style={{ gap: BrandSpacing.md }}>
        <InstructorJobDetailContent viewModel={selectedJobDetail} actionSlot={selectedJobAction} />
      </Box>

      {remainingJobs.length > 0 ? (
        <Box style={{ gap: BrandSpacing.md }}>
          <ThemedText type="sectionTitle">{t("jobsTab.detail.moreFromStudio")}</ThemedText>
          <Box style={{ gap: BrandSpacing.md }}>
            {remainingJobs.map((job) => (
              <InstructorJobCard
                key={job.jobId}
                job={job}
                locale={locale}
                zoneLanguage={locale.toLowerCase().startsWith("he") ? "he" : "en"}
                now={now}
                t={t}
                onOpenStudio={(_, nextJobId) => handleSelectRelatedJob(nextJobId)}
                onApply={() => onApply(job)}
                onWithdrawApplication={(applicationId) => onWithdrawApplication(applicationId)}
                applyingJobId={applyingJobId}
                withdrawingApplicationId={withdrawingApplicationId}
                variant="studioDetail"
              />
            ))}
          </Box>
        </Box>
      ) : null}
    </TabScreenScrollView>
  );
}
