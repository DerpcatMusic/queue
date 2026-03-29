import { useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HomeHeaderSheet } from "@/components/home/home-header-sheet";
import {
  HomeRoleContent,
  type HomeRoleContentProps,
} from "@/components/home/home-tab/home-role-content";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { LoadingScreen } from "@/components/loading-screen";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { useTheme } from "@/hooks/use-theme";
import { useTabSceneLifecycle } from "@/modules/navigation/tab-scene-lifecycle";

const HOME_STUDIO_JOBS_LIMIT = 36;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? "en";
  const liveNow = useMinuteNow();
  const queryNow = Math.floor(liveNow / (60 * 1000)) * 60 * 1000;
  const { color: palette } = useTheme();
  const { hasActivated: hasActivatedHome } = useTabSceneLifecycle("index");

  const { currentUser, isAuthLoading, isAuthenticated } = useUser();
  const canQueryInstructor =
    hasActivatedHome && !isAuthLoading && isAuthenticated && currentUser?.role === "instructor";
  const canQueryStudio =
    hasActivatedHome && !isAuthLoading && isAuthenticated && currentUser?.role === "studio";

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
  const studioSettings = useQuery(api.users.getMyStudioSettings, canQueryStudio ? {} : "skip");

  const [withdrawingApplicationId, setWithdrawingApplicationId] =
    useState<Id<"jobApplications"> | null>(null);
  const withdrawApplication = useMutation(api.jobs.withdrawApplication);

  const handleWithdrawApplication = (applicationId: Id<"jobApplications">) => {
    setWithdrawingApplicationId(applicationId);
    withdrawApplication({ applicationId })
      .then(() => setWithdrawingApplicationId(null))
      .catch(() => setWithdrawingApplicationId(null));
  };

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "ILS",
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const activeRole = currentUser?.role ?? null;
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
  const instructorLessonsCompleted = instructorHomeStats?.lessonEvents.length ?? 0;
  const instructorTotalEarningsAgorot = instructorHomeStats?.totalEarningsAgorot ?? 0;
  const instructorPendingApplications = instructorHomeStats?.pendingApplications ?? 0;
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
          lessonsCompleted={instructorLessonsCompleted}
          totalEarningsLabel={currencyFormatter.format(instructorTotalEarningsAgorot / 100)}
          pendingApplications={
            activeRole === "instructor"
              ? instructorPendingApplications
              : studioHomeCounts.pendingApplicants
          }
          openJobs={activeRole === "instructor" ? instructorOpenJobs : studioHomeCounts.openJobs}
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
      instructorLessonsCompleted,
      instructorOpenJobs,
      instructorPendingApplications,
      instructorTotalEarningsAgorot,
      instructorHomeStats?.isVerified,
      studioHomeCounts.openJobs,
      studioHomeCounts.pendingApplicants,
    ],
  );

  const homeSheetConfig = useMemo(
    () =>
      activeRole === "instructor" || activeRole === "studio"
        ? {
            content: homeSheetContent,
            steps: [0.1],
            initialStep: 0,
            collapsedHeightMode: "content" as const,
            padding: {
              vertical: 0,
              horizontal: 0,
            },
            backgroundColor: palette.surface,
            topInsetColor: palette.surface,
          }
        : null,
    [activeRole, homeSheetContent, palette.surface],
  );

  useGlobalTopSheet("index", homeSheetConfig, "home:sheet");

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
      now={liveNow}
      instructorHomeStats={instructorHomeStats}
      availableInstructorJobs={availableInstructorJobs}
      myStudioJobs={myStudioJobs as HomeRoleContentProps["myStudioJobs"]}
      withdrawingApplicationId={withdrawingApplicationId}
      onWithdrawApplication={handleWithdrawApplication}
    />
  );
}
