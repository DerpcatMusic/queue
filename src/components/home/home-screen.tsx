import { useQuery } from "convex/react";
import { Redirect, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { InstructorHomeContent } from "@/components/home/instructor-home-content";
import { StudioHomeContent } from "@/components/home/studio-home-content";
import { LoadingScreen } from "@/components/loading-screen";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useBrand } from "@/hooks/use-brand";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

const HOME_STUDIO_JOBS_LIMIT = 36;
const INSTRUCTOR_JOBS_ROUTE = buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.jobs);
const INSTRUCTOR_PROFILE_ROUTE = buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.profile);
const STUDIO_JOBS_ROUTE = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.jobs);
const STUDIO_CALENDAR_ROUTE = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.calendar);
const STUDIO_PROFILE_ROUTE = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.profile);

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const router = useRouter();

  // Use centralized user context - eliminates duplicate getCurrentUser query
  const { currentUser, isAuthLoading, isAuthenticated } = useUser();
  const canQueryInstructor =
    !isAuthLoading && isAuthenticated && currentUser?.role === "instructor";
  const canQueryStudio = !isAuthLoading && isAuthenticated && currentUser?.role === "studio";

  // Role-specific queries - only fetch when user role is known
  const myStudioJobs = useQuery(
    api.jobs.getMyStudioJobs,
    canQueryStudio ? { limit: HOME_STUDIO_JOBS_LIMIT } : "skip",
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

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "ILS",
        maximumFractionDigits: 0,
      }),
    [locale],
  );

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

  const activeRole = currentUser.role;

  if (activeRole === "pending") {
    return <Redirect href="/onboarding" />;
  }

  if (activeRole !== "instructor" && activeRole !== "studio") {
    return <LoadingScreen label={t("home.loading")} />;
  }

  if (activeRole === "instructor") {
    if (instructorHomeStats === undefined) {
      return <LoadingScreen label={t("home.loading")} />;
    }

    const firstName = (instructorSettings?.displayName ?? currentUser.fullName)
      ?.trim()
      .split(/\s+/)[0];
    const displayName =
      firstName && firstName.length > 0 ? firstName : t("home.shared.unknownName");

    return (
      <InstructorHomeContent
        displayName={displayName}
        profileImageUrl={instructorSettings?.profileImageUrl ?? currentUser.image}
        isVerified={instructorHomeStats.isVerified}
        locale={locale}
        openMatches={instructorHomeStats.openMatches}
        pendingApplications={instructorHomeStats.pendingApplications}
        totalEarningsAgorot={instructorHomeStats.totalEarningsAgorot}
        palette={palette}
        currencyFormatter={currencyFormatter}
        t={t}
        earningsEvents={instructorHomeStats.earningsEvents}
        lessonEvents={instructorHomeStats.lessonEvents}
        upcomingSessions={instructorHomeStats.upcomingSessions}
        sports={instructorSettings?.sports}
        onOpenJobs={() => router.push(INSTRUCTOR_JOBS_ROUTE)}
        onOpenProfile={() => router.push(INSTRUCTOR_PROFILE_ROUTE)}
      />
    );
  }

  if (myStudioJobs === undefined) {
    return <LoadingScreen label={t("home.loading")} />;
  }

  const studioJobs = myStudioJobs ?? [];
  const openJobs = studioJobs.filter((job: any) => job.status === "open").length;
  const pendingApplicants = studioJobs.reduce(
    (total: number, job: any) => total + job.pendingApplicationsCount,
    0,
  );
  const jobsFilled = studioJobs.filter((job: any) => job.status === "filled").length;
  const firstName = (studioSettings?.studioName ?? currentUser.fullName)?.trim().split(/\s+/)[0];
  const displayName = firstName && firstName.length > 0 ? firstName : t("home.shared.unknownName");

  return (
    <StudioHomeContent
      displayName={displayName}
      profileImageUrl={studioSettings?.profileImageUrl ?? currentUser.image}
      locale={locale}
      openJobs={openJobs}
      pendingApplicants={pendingApplicants}
      palette={palette}
      currencyFormatter={currencyFormatter}
      t={t}
      recentJobs={studioJobs}
      jobsFilled={jobsFilled}
      sports={studioSettings?.sports}
      onOpenJobs={() => router.push(STUDIO_JOBS_ROUTE)}
      onOpenCalendar={() => router.push(STUDIO_CALENDAR_ROUTE)}
      onOpenProfile={() => router.push(STUDIO_PROFILE_ROUTE)}
    />
  );
}
