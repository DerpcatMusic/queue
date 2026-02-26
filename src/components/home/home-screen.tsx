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

const HOME_APPLICATIONS_LIMIT = 80;
const HOME_AVAILABLE_JOBS_LIMIT = 40;
const HOME_STUDIO_JOBS_LIMIT = 60;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const router = useRouter();

  // Use centralized user context - eliminates duplicate getCurrentUser query
  const { currentUser, effectiveRole } = useUser();

  // Role-specific queries - only fetch when user role is known
  const myApplications = useQuery(
    api.jobs.getMyApplications,
    effectiveRole === "instructor" ? { limit: HOME_APPLICATIONS_LIMIT } : "skip",
  );
  const availableJobs = useQuery(
    api.jobs.getAvailableJobsForInstructor,
    effectiveRole === "instructor" ? { limit: HOME_AVAILABLE_JOBS_LIMIT } : "skip",
  );
  const myStudioJobs = useQuery(
    api.jobs.getMyStudioJobs,
    effectiveRole === "studio" ? { limit: HOME_STUDIO_JOBS_LIMIT } : "skip",
  );

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    effectiveRole === "instructor" ? {} : "skip",
  );

  const studioSettings = useQuery(
    api.users.getMyStudioSettings,
    effectiveRole === "studio" ? {} : "skip",
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

  // Keep home visible when role is already resolved from cache while currentUser hydrates.
  if (currentUser === undefined && !effectiveRole) {
    return <LoadingScreen label={t("home.loading")} />;
  }

  // Redirect states - these should already be handled by TabLayout, but keep as safety net
  if (currentUser === null) return <Redirect href="/sign-in" />;
  if (currentUser && (!currentUser.onboardingComplete || currentUser.role === "pending")) {
    return <Redirect href="/onboarding" />;
  }

  const firstName = currentUser?.fullName?.trim().split(/\s+/)[0];
  const displayName = firstName && firstName.length > 0 ? firstName : t("home.shared.unknownName");
  const activeRole = currentUser?.role ?? effectiveRole;

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
