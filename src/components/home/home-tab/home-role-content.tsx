import { useMutation } from "convex/react";
import type { Href } from "expo-router";
import { Redirect, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { InstructorHomeContent } from "@/components/home/instructor-home-content";
import { StudioHomeContent } from "@/components/home/studio-home-content";
import type { InstructorMarketplaceJob } from "@/components/jobs/instructor/instructor-job-card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

const INSTRUCTOR_JOBS_ROUTE = buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.jobs);
const STUDIO_JOBS_ROUTE = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.jobs);
const STUDIO_CALENDAR_ROUTE = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.calendar);

export type Application = {
  applicationId: Id<"jobApplications">;
  instructorId: Id<"instructorProfiles">;
  instructorName: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  appliedAt: number;
  message?: string;
};

export type HomeRoleContentProps = {
  activeRole: "instructor" | "studio";
  locale: string;
  now: number;
  currencyFormatter: Intl.NumberFormat;
  t: TFunction;
  instructorHomeStats:
    | {
        isVerified: boolean;
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
  availableInstructorJobs: InstructorMarketplaceJob[] | undefined;
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
        applications?: Application[];
      }>
    | undefined;
  withdrawingApplicationId?: Id<"jobApplications"> | null;
  onWithdrawApplication?: (applicationId: Id<"jobApplications">) => void;
};

export function HomeRoleContent({
  activeRole,
  locale,
  now,
  currencyFormatter,
  t,
  instructorHomeStats,
  availableInstructorJobs,
  myStudioJobs,
  withdrawingApplicationId,
  onWithdrawApplication,
}: HomeRoleContentProps) {
  const router = useRouter();
  const reviewApplication = useMutation(api.jobs.reviewApplication);

  const openInstructorStudio = (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => {
    router.push(`/instructor/jobs/studios/${String(studioId)}?jobId=${String(jobId)}` as Href);
  };

  if (activeRole === "instructor") {
    return (
      <InstructorHomeContent
        currencyFormatter={currencyFormatter}
        locale={locale}
        now={now}
        lessonsCompleted={instructorHomeStats?.lessonEvents.length ?? 0}
        pendingApplications={instructorHomeStats?.pendingApplications ?? 0}
        t={t}
        totalEarningsAgorot={instructorHomeStats?.totalEarningsAgorot ?? 0}
        upcomingSessions={instructorHomeStats?.upcomingSessions ?? []}
        availableJobs={availableInstructorJobs}
        {...(withdrawingApplicationId !== undefined ? { withdrawingApplicationId } : {})}
        {...(onWithdrawApplication ? { onWithdrawApplication } : {})}
        onOpenJobs={() => router.push(INSTRUCTOR_JOBS_ROUTE)}
        onOpenStudio={openInstructorStudio}
      />
    );
  }

  if (activeRole !== "studio") {
    return <Redirect href="/onboarding" />;
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
      currencyFormatter={currencyFormatter}
      t={t}
      recentJobs={studioJobs}
      jobsFilled={jobsFilled}
      onOpenJobs={() => router.push(STUDIO_JOBS_ROUTE)}
      onOpenCalendar={() => router.push(STUDIO_CALENDAR_ROUTE)}
      reviewApplication={reviewApplication}
    />
  );
}
