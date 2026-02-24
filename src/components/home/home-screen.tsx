import { api } from "@/convex/_generated/api";
import { LoadingScreen } from "@/components/loading-screen";
import { useBrand } from "@/hooks/use-brand";
import { useQuery } from "convex/react";
import { Redirect, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { InstructorHomeContent } from "@/components/home/instructor-home-content";
import { StudioHomeContent } from "@/components/home/studio-home-content";

const HOME_APPLICATIONS_LIMIT = 80;
const HOME_AVAILABLE_JOBS_LIMIT = 40;
const HOME_STUDIO_JOBS_LIMIT = 60;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const router = useRouter();

  const currentUser = useQuery(api.users.getCurrentUser);
  const myApplications = useQuery(
    api.jobs.getMyApplications,
    currentUser?.role === "instructor" ? { limit: HOME_APPLICATIONS_LIMIT } : "skip",
  );
  const availableJobs = useQuery(
    api.jobs.getAvailableJobsForInstructor,
    currentUser?.role === "instructor" ? { limit: HOME_AVAILABLE_JOBS_LIMIT } : "skip",
  );
  const myStudioJobs = useQuery(
    api.jobs.getMyStudioJobs,
    currentUser?.role === "studio" ? { limit: HOME_STUDIO_JOBS_LIMIT } : "skip",
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

  if (currentUser === undefined) return <LoadingScreen label={t("home.loading")} />;
  if (currentUser === null) return <Redirect href="/sign-in" />;
  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }

  const firstName = currentUser.fullName?.trim().split(/\s+/)[0];
  const displayName = firstName && firstName.length > 0 ? firstName : t("home.shared.unknownName");
  const memberSince = currentUser.createdAt
    ? t("home.shared.memberSince", {
        date: new Date(currentUser.createdAt).toLocaleDateString(locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      })
    : t("home.loading");

  if (currentUser.role === "instructor") {
    const isDataLoading = myApplications === undefined || availableJobs === undefined;
    const instructorApplications = myApplications ?? [];
    const instructorAvailableJobs = availableJobs ?? [];
    const now = Date.now();
    const pendingApplications = instructorApplications.filter((record) => record.status === "pending").length;
    const upcomingSessions = instructorApplications
      .filter((record) => record.status === "accepted" && record.startTime > now)
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, 3);
    const openMatches = instructorAvailableJobs.filter((record) => !record.applicationStatus).length;

    return (
      <InstructorHomeContent
        displayName={displayName}
        memberSince={memberSince}
        locale={locale}
        openMatches={openMatches}
        pendingApplications={pendingApplications}
        palette={palette}
        currencyFormatter={currencyFormatter}
        t={t}
        upcomingSessions={upcomingSessions}
        onOpenCalendar={() => router.push("/(tabs)/calendar")}
        onOpenJobs={() => router.push("/(tabs)/jobs")}
        isDataLoading={isDataLoading}
      />
    );
  }

  const studioJobs = myStudioJobs ?? [];
  const isDataLoading = myStudioJobs === undefined;
  const openJobs = studioJobs.filter((record) => record.status === "open").length;
  const pendingApplicants = studioJobs.reduce(
    (total, record) => total + record.pendingApplicationsCount,
    0,
  );

  return (
    <StudioHomeContent
      displayName={displayName}
      memberSince={memberSince}
      locale={locale}
      openJobs={openJobs}
      pendingApplicants={pendingApplicants}
      palette={palette}
      currencyFormatter={currencyFormatter}
      t={t}
      recentJobs={studioJobs}
      onOpenJobs={() => router.push("/(tabs)/jobs")}
      isDataLoading={isDataLoading}
    />
  );
}
