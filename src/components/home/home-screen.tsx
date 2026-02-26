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

const HOME_APPLICATIONS_LIMIT = 36;
const HOME_AVAILABLE_JOBS_LIMIT = 24;
const HOME_STUDIO_JOBS_LIMIT = 36;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const router = useRouter();

  // Use centralized user context - eliminates duplicate getCurrentUser query
  const { currentUser, effectiveRole, isAuthLoading, isAuthenticated, isSyncing } = useUser();
  const resolvedRole = currentUser?.role ?? (isAuthenticated ? effectiveRole : null);
  const canQueryInstructor = !isAuthLoading && isAuthenticated && currentUser?.role === "instructor";
  const canQueryStudio = !isAuthLoading && isAuthenticated && currentUser?.role === "studio";

  // Role-specific queries - only fetch when user role is known
  const myApplications = useQuery(
    api.jobs.getMyApplications,
    canQueryInstructor ? { limit: HOME_APPLICATIONS_LIMIT } : "skip",
  );
  const availableJobs = useQuery(
    api.jobs.getAvailableJobsForInstructor,
    canQueryInstructor ? { limit: HOME_AVAILABLE_JOBS_LIMIT } : "skip",
  );
  const myStudioJobs = useQuery(
    api.jobs.getMyStudioJobs,
    canQueryStudio ? { limit: HOME_STUDIO_JOBS_LIMIT } : "skip",
  );

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    canQueryInstructor ? {} : "skip",
  );

  const studioSettings = useQuery(
    api.users.getMyStudioSettings,
    canQueryStudio ? {} : "skip",
  );

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

  // Keep home visible while auth/user hydration catches up, but do not run protected queries yet.
  if (currentUser === undefined || isSyncing) {
    return <LoadingScreen label={t("home.loading")} />;
  }

  // If auth is valid but user doc is not ready, wait instead of bouncing to sign-in.
  if (currentUser === null) {
    return <LoadingScreen label={t("home.loading")} />;
  }

  if (currentUser && (!currentUser.onboardingComplete || currentUser.role === "pending")) {
    return <Redirect href="/onboarding" />;
  }

  const firstName = currentUser?.fullName?.trim().split(/\s+/)[0];
  const displayName = firstName && firstName.length > 0 ? firstName : t("home.shared.unknownName");
  const activeRole = currentUser?.role ?? resolvedRole;

  if (activeRole === "pending") {
    return <Redirect href="/onboarding" />;
  }

  if (activeRole !== "instructor" && activeRole !== "studio") {
    return <LoadingScreen label={t("home.loading")} />;
  }

  if (activeRole === "instructor") {
    const instructorApplications = myApplications ?? [];
    const instructorAvailableJobs = availableJobs ?? [];
    const now = Date.now();

    // Calculate total earnings from accepted + completed jobs
    const totalEarnings = instructorApplications.reduce((acc: number, app: any) => {
      if (app.status === "accepted" || app.jobStatus === "completed") {
        return acc + app.pay;
      }
      return acc;
    }, 0);

    const pendingApplications = instructorApplications.filter(
      (app: any) => app.status === "pending",
    ).length;
    const upcomingSessions = instructorApplications
      .filter((app: any) => app.status === "accepted" && app.startTime > now)
      .sort((a: any, b: any) => a.startTime - b.startTime)
      .slice(0, 3);
    const openMatches = instructorAvailableJobs.filter((job: any) => !job.applicationStatus).length;

    return (
      <InstructorHomeContent
        displayName={displayName}
        profileImageUrl={instructorSettings?.profileImageUrl ?? currentUser.image}
        locale={locale}
        openMatches={openMatches}
        pendingApplications={pendingApplications}
        totalEarnings={totalEarnings}
        palette={palette}
        currencyFormatter={currencyFormatter}
        t={t}
        upcomingSessions={upcomingSessions}
        sports={instructorSettings?.sports}
        onOpenCalendar={() => router.push("/(tabs)/instructor/calendar")}
        onOpenJobs={() => router.push("/(tabs)/instructor/jobs")}
      />
    );
  }

  const studioJobs = myStudioJobs ?? [];
  const openJobs = studioJobs.filter((job: any) => job.status === "open").length;
  const pendingApplicants = studioJobs.reduce(
    (total: number, job: any) => total + job.pendingApplicationsCount,
    0,
  );
  const jobsFilled = studioJobs.filter((job: any) => job.status === "filled").length;

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
      onOpenJobs={() => router.push("/(tabs)/studio/jobs")}
      onOpenCalendar={() => router.push("/(tabs)/studio/calendar")}
    />
  );
}
