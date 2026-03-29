import { useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { HomeHeaderSheet } from "@/components/home/home-header-sheet";
import {
  HomeRoleContent,
  type HomeRoleContentProps,
} from "@/components/home/home-tab/home-role-content";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { useDeferredTabMount } from "@/components/layout/use-deferred-tab-mount";
import { LoadingScreen } from "@/components/loading-screen";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { useTheme } from "@/hooks/use-theme";

const HOME_STUDIO_JOBS_LIMIT = 36;
function HomeBodyPlaceholder({ backgroundColor }: { backgroundColor: string }) {
  return (
    <TabScreenRoot mode="static" topInsetTone="sheet" style={{ backgroundColor }}>
      <View style={{ flex: 1, backgroundColor }} />
    </TabScreenRoot>
  );
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? "en";
  const liveNow = useMinuteNow();
  const queryNow = Math.floor(liveNow / (60 * 1000)) * 60 * 1000;
  const { color: palette } = useTheme();

  const { currentUser, isAuthLoading, isAuthenticated } = useUser();
  const requestedRole = currentUser?.role;
  const homeBodyReady = useDeferredTabMount(
    requestedRole === "instructor" || requestedRole === "studio",
  );
  const canQueryInstructor =
    homeBodyReady && !isAuthLoading && isAuthenticated && currentUser?.role === "instructor";
  const canQueryStudio =
    homeBodyReady && !isAuthLoading && isAuthenticated && currentUser?.role === "studio";

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
  const homeSheetContent = useMemo(
    () =>
      activeRole === "instructor" || activeRole === "studio" ? (
        <HomeHeaderSheet
          displayName={homeDisplayName}
          profileImageUrl={homeProfileImageUrl}
          isVerified={
            activeRole === "instructor" ? (instructorHomeStats?.isVerified ?? false) : false
          }
          lessonsCompleted={instructorHomeStats?.lessonEvents.length ?? 0}
          totalEarningsLabel={currencyFormatter.format(
            (instructorHomeStats?.totalEarningsAgorot ?? 0) / 100,
          )}
          pendingApplications={
            activeRole === "instructor"
              ? (instructorHomeStats?.pendingApplications ?? 0)
              : studioHomeCounts.pendingApplicants
          }
          openJobs={
            activeRole === "instructor"
              ? (availableInstructorJobs?.length ?? 0)
              : studioHomeCounts.openJobs
          }
          role={activeRole}
          {...(homeSubtitle ? { subtitle: homeSubtitle } : {})}
        />
      ) : null,
    [
      activeRole,
      homeDisplayName,
      homeProfileImageUrl,
      homeSubtitle,
      instructorHomeStats?.isVerified,
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

  if (
    (activeRole === "instructor" && !homeBodyReady) ||
    (activeRole === "studio" && !homeBodyReady)
  ) {
    return <HomeBodyPlaceholder backgroundColor={palette.appBg} />;
  }

  return (
    <HomeRoleContent
      activeRole={activeRole}
      homeBodyReady={homeBodyReady}
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
