import { useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HomeHeaderSheet } from "@/components/home/home-header-sheet";
import {
  HomeRoleContent,
  type HomeRoleContentProps,
} from "@/components/home/home-tab/home-role-content";
import {
  createContentDrivenTopSheetConfig,
  getMainTabSheetBackgroundColor,
} from "@/components/layout/top-sheet-registry";
import { LoadingScreen } from "@/components/loading-screen";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { useTheme } from "@/hooks/use-theme";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";

const HOME_STUDIO_JOBS_LIMIT = 36;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? "en";
  const liveNow = useMinuteNow();
  const queryNow = Math.floor(liveNow / (60 * 1000)) * 60 * 1000;
  const theme = useTheme();
  const mainTabSheetBackgroundColor = getMainTabSheetBackgroundColor(theme);

  const { currentUser, isAuthLoading, isAuthenticated } = useUser();
  const canQueryInstructor =
    !isAuthLoading && isAuthenticated && currentUser?.role === "instructor";
  const canQueryStudio = !isAuthLoading && isAuthenticated && currentUser?.role === "studio";

  const myStudioJobs = useQuery(
    api.jobs.getMyStudioJobsWithApplications,
    canQueryStudio ? { limit: HOME_STUDIO_JOBS_LIMIT } : "skip",
  );
  const availableInstructorJobs = useQuery(
    api.jobs.getAvailableJobsForInstructor,
    canQueryInstructor ? { limit: 4, now: queryNow } : "skip",
  );
  const instructorHomeStats = useQuery(
    api.home.getMyInstructorHomeStats,
    canQueryInstructor ? {} : "skip",
  );
  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    canQueryInstructor ? {} : "skip",
  );
  const instructorComplianceSummary = useQuery(
    api.compliance.getMyInstructorComplianceSummary,
    canQueryInstructor ? { now: queryNow } : "skip",
  );
  const instructorPayoutSummary = useQuery(
    api.paymentsV2.getMyPayoutSummaryV2,
    canQueryInstructor ? {} : "skip",
  );
  const studioSettings = useQuery(api.users.getMyStudioSettings, canQueryStudio ? {} : "skip");
  const studioComplianceSummary = useQuery(
    api.complianceStudio.getMyStudioComplianceSummary,
    canQueryStudio ? {} : "skip",
  );

  const [withdrawingApplicationId, setWithdrawingApplicationId] =
    useState<Id<"jobApplications"> | null>(null);
  const withdrawApplication = useMutation(api.jobs.withdrawApplication);

  const handleWithdrawApplication = useCallback(
    (applicationId: Id<"jobApplications">) => {
      setWithdrawingApplicationId(applicationId);
      withdrawApplication({ applicationId })
        .then(() => setWithdrawingApplicationId(null))
        .catch(() => setWithdrawingApplicationId(null));
    },
    [withdrawApplication],
  );

  const activeRole = currentUser?.role ?? null;
  const instructorCurrency = instructorHomeStats?.currency ?? "ILS";
  const displayCurrency = activeRole === "instructor" ? instructorCurrency : "ILS";
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: displayCurrency,
        maximumFractionDigits: 0,
      }),
    [displayCurrency, locale],
  );

  const studioHomeCounts = useMemo(() => {
    const jobs: NonNullable<HomeRoleContentProps["myStudioJobs"]> = myStudioJobs ?? [];
    const openJobs = jobs.filter((job) => job.status === "open").length;
    const pendingApplicants = jobs.reduce((total, job) => total + job.pendingApplicationsCount, 0);
    const jobsFilled = jobs.filter((job) => job.status === "filled").length;
    return { openJobs, pendingApplicants, jobsFilled };
  }, [myStudioJobs]);
  const fallbackDisplayName =
    currentUser?.fullName?.trim().split(/\s+/)[0] || t("home.shared.unknownName");
  const homeDisplayName =
    activeRole === "instructor"
      ? (instructorSettings?.displayName ?? fallbackDisplayName)
      : activeRole === "studio"
        ? (studioSettings?.studioName ?? fallbackDisplayName)
        : fallbackDisplayName;
  const homeProfileImageUrl =
    activeRole === "instructor"
      ? (instructorSettings?.profileImageUrl ?? currentUser?.image)
      : activeRole === "studio"
        ? (studioSettings?.profileImageUrl ?? currentUser?.image)
        : currentUser?.image;
  const homeSubtitle =
    activeRole === "instructor"
      ? instructorHomeStats?.isVerified
        ? t("home.instructor.verified")
        : undefined
      : activeRole === "studio"
        ? t("home.studio.role")
        : undefined;
  const instructorPendingApplications = instructorHomeStats?.pendingApplications ?? 0;
  const instructorThisMonthEarningsAgorot = instructorHomeStats?.thisMonthEarningsAgorot ?? 0;
  const instructorOpenJobs = availableInstructorJobs?.length ?? 0;
  const homeSheetContent = useMemo(
    () =>
      activeRole === "instructor" || activeRole === "studio" ? (
        <HomeHeaderSheet
          displayName={homeDisplayName}
          profileImageUrl={homeProfileImageUrl}
          isVerified={
            activeRole === "instructor" ? (instructorHomeStats?.isVerified ?? false) : false
          }
          thisMonthEarningsLabel={currencyFormatter.format(instructorThisMonthEarningsAgorot / 100)}
          thisMonthEarningsAgorot={instructorThisMonthEarningsAgorot}
          totalEarningsAgorot={instructorHomeStats?.totalEarningsAgorot ?? 0}
          paidOutAmountAgorot={instructorHomeStats?.paidOutAmountAgorot ?? 0}
          outstandingAmountAgorot={instructorHomeStats?.outstandingAmountAgorot ?? 0}
          pendingApplications={
            activeRole === "instructor"
              ? instructorPendingApplications
              : studioHomeCounts.pendingApplicants
          }
          openJobs={activeRole === "instructor" ? instructorOpenJobs : studioHomeCounts.openJobs}
          missionsCount={
            activeRole === "instructor"
              ? (instructorHomeStats?.lessonEvents?.length ?? 0)
              : (myStudioJobs?.length ?? 0)
          }
          role={activeRole}
          {...(homeSubtitle ? { subtitle: homeSubtitle } : {})}
        />
      ) : null,
    [
      activeRole,
      currencyFormatter,
      homeDisplayName,
      homeProfileImageUrl,
      homeSubtitle,
      instructorOpenJobs,
      instructorPendingApplications,
      instructorThisMonthEarningsAgorot,
      instructorHomeStats?.isVerified,
      instructorHomeStats?.totalEarningsAgorot,
      instructorHomeStats?.paidOutAmountAgorot,
      instructorHomeStats?.outstandingAmountAgorot,
      instructorHomeStats?.lessonEvents?.length,
      myStudioJobs?.length,
      studioHomeCounts.openJobs,
      studioHomeCounts.pendingApplicants,
    ],
  );

  const homeSheetConfig = useMemo(
    () =>
      activeRole === "instructor" || activeRole === "studio"
        ? createContentDrivenTopSheetConfig({
            collapsedContent: homeSheetContent,
            padding: {
              vertical: 0,
              horizontal: 0,
            },
            backgroundColor: mainTabSheetBackgroundColor,
            topInsetColor: mainTabSheetBackgroundColor,
          })
        : null,
    [activeRole, homeSheetContent, mainTabSheetBackgroundColor],
  );

  const descriptor = useMemo(
    () => ({
      tabId: "index" as const,
      body: (
        <HomeRoleContent
          activeRole={activeRole as "instructor" | "studio"}
          locale={locale}
          currencyFormatter={currencyFormatter}
          t={t}
          instructorHomeStats={instructorHomeStats}
          instructorSettings={instructorSettings}
          instructorComplianceSummary={instructorComplianceSummary}
          instructorPayoutSummary={instructorPayoutSummary}
          availableInstructorJobs={availableInstructorJobs}
          studioSettings={studioSettings}
          studioComplianceSummary={studioComplianceSummary}
          myStudioJobs={myStudioJobs as HomeRoleContentProps["myStudioJobs"]}
          withdrawingApplicationId={withdrawingApplicationId}
          onWithdrawApplication={handleWithdrawApplication}
        />
      ),
      sheetConfig: homeSheetConfig,
      insetTone: "sheet" as const,
      isLoading: isAuthLoading || currentUser === undefined,
    }),
    // NOTE: intentionally omitting handleWithdrawApplication — function refs change every render
    [
      activeRole,
      locale,
      currencyFormatter,
      t,
      instructorHomeStats,
      instructorSettings,
      instructorComplianceSummary,
      instructorPayoutSummary,
      availableInstructorJobs,
      studioSettings,
      studioComplianceSummary,
      myStudioJobs,
      withdrawingApplicationId,
      handleWithdrawApplication,
      homeSheetConfig,
      isAuthLoading,
      currentUser,
    ],
  );
  useTabSceneDescriptor(descriptor);

  if (isAuthLoading) {
    return <LoadingScreen label={t("home.loading")} />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser === undefined) {
    return <LoadingScreen label={t("home.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser && (!currentUser.onboardingComplete || currentUser.role === "pending")) {
    return <Redirect href="/onboarding" />;
  }

  if (activeRole === "pending") {
    return <Redirect href="/onboarding" />;
  }

  if (activeRole !== "instructor" && activeRole !== "studio") {
    return <LoadingScreen label={t("home.loading")} />;
  }

  return (
    <HomeRoleContent
      activeRole={activeRole}
      locale={locale}
      currencyFormatter={currencyFormatter}
      t={t}
      instructorHomeStats={instructorHomeStats}
      instructorSettings={instructorSettings}
      instructorComplianceSummary={instructorComplianceSummary}
      instructorPayoutSummary={instructorPayoutSummary}
      availableInstructorJobs={availableInstructorJobs}
      studioSettings={studioSettings}
      studioComplianceSummary={studioComplianceSummary}
      myStudioJobs={myStudioJobs as HomeRoleContentProps["myStudioJobs"]}
      withdrawingApplicationId={withdrawingApplicationId}
      onWithdrawApplication={handleWithdrawApplication}
    />
  );
}
