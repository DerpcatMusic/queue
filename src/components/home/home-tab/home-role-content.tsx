import { Redirect, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { InstructorHomeContent } from "@/components/home/instructor-home-content";
import { StudioHomeContent } from "@/components/home/studio-home-content";
import { LoadingScreen } from "@/components/loading-screen";
import type { BrandPalette } from "@/constants/brand";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

const INSTRUCTOR_JOBS_ROUTE = buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.jobs);
const INSTRUCTOR_PROFILE_ROUTE = buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.profile);
const STUDIO_JOBS_ROUTE = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.jobs);
const STUDIO_CALENDAR_ROUTE = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.calendar);

export type HomeRoleContentProps = {
  activeRole: "instructor" | "studio";
  homeBodyReady: boolean;
  locale: string;
  palette: BrandPalette;
  currencyFormatter: Intl.NumberFormat;
  t: TFunction;
  instructorHomeStats:
    | {
        isVerified: boolean;
        openMatches: number;
        pendingApplications: number;
        totalEarningsAgorot: number;
        lessonEvents: Array<{
          endTime: number;
        }>;
        upcomingSessions: Array<{
          applicationId: string;
          sport: string;
          studioName: string;
          zone: string;
          startTime: number;
          pay: number;
        }>;
      }
    | undefined;
  myStudioJobs:
    | Array<{
        jobId: string;
        sport: string;
        status: "open" | "assigned" | "completed" | "cancelled" | "filled";
        zone: string;
        startTime: number;
        endTime: number;
        pay: number;
        pendingApplicationsCount: number;
      }>
    | undefined;
};

export function HomeRoleContent({
  activeRole,
  homeBodyReady,
  locale,
  palette,
  currencyFormatter,
  t,
  instructorHomeStats,
  myStudioJobs,
}: HomeRoleContentProps) {
  const router = useRouter();

  if (activeRole === "instructor") {
    if (!homeBodyReady || instructorHomeStats === undefined) {
      return <LoadingScreen label={t("home.loading")} />;
    }

    return (
      <InstructorHomeContent
        isVerified={instructorHomeStats.isVerified}
        currencyFormatter={currencyFormatter}
        locale={locale}
        lessonsCompleted={instructorHomeStats.lessonEvents.length}
        openMatches={instructorHomeStats.openMatches}
        pendingApplications={instructorHomeStats.pendingApplications}
        palette={palette}
        t={t}
        totalEarningsAgorot={instructorHomeStats.totalEarningsAgorot}
        upcomingSessions={instructorHomeStats.upcomingSessions}
        onOpenJobs={() => router.push(INSTRUCTOR_JOBS_ROUTE)}
        onOpenProfile={() => router.push(INSTRUCTOR_PROFILE_ROUTE)}
      />
    );
  }

  if (activeRole !== "studio") {
    return <Redirect href="/onboarding" />;
  }

  if (!homeBodyReady || myStudioJobs === undefined) {
    return <LoadingScreen label={t("home.loading")} />;
  }

  const studioJobs = myStudioJobs ?? [];
  const openJobs = studioJobs.filter((job) => job.status === "open").length;
  const pendingApplicants = studioJobs.reduce(
    (total, job) => total + job.pendingApplicationsCount,
    0,
  );
  const jobsFilled = studioJobs.filter((job) => job.status === "filled").length;

  return (
    <StudioHomeContent
      locale={locale}
      openJobs={openJobs}
      pendingApplicants={pendingApplicants}
      palette={palette}
      currencyFormatter={currencyFormatter}
      t={t}
      recentJobs={studioJobs}
      jobsFilled={jobsFilled}
      onOpenJobs={() => router.push(STUDIO_JOBS_ROUTE)}
      onOpenCalendar={() => router.push(STUDIO_CALENDAR_ROUTE)}
    />
  );
}
