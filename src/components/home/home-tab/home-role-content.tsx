import { memo } from "react";
import { useMutation } from "convex/react";
import { Redirect, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { InstructorHomeContent } from "@/components/home/instructor-home-content";
import { StudioHomeContent } from "@/components/home/studio-home-content";
import type { HomeChecklistItem } from "@/components/home/home-shared";
import { useOpenInstructorSheet, useOpenStudioSheet } from "@/contexts/sheet-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { InstructorMarketplaceJob } from "@/features/jobs/instructor-marketplace-job";
import {
  buildInstructorProfileRoute,
  buildStudioProfileRoute,
} from "@/navigation/public-profile-routes";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

const INSTRUCTOR_JOBS_ROUTE = buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.jobs);
const STUDIO_JOBS_ROUTE = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.jobs);
const STUDIO_CALENDAR_ROUTE = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.calendar);

export type Application = {
  applicationId: Id<"jobApplications">;
  instructorId: Id<"instructorProfiles">;
  instructorName: string;
  profileImageUrl?: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  appliedAt: number;
  message?: string;
};

export type HomeRoleContentProps = {
  activeRole: "instructor" | "studio";
  locale: string;
  currencyFormatter: Intl.NumberFormat;
  t: TFunction;
  instructorHomeStats:
    | {
        isVerified: boolean;
        pendingApplications: number;
        thisMonthEarningsAgorot: number;
        totalEarningsAgorot: number;
        paidOutAmountAgorot: number;
        outstandingAmountAgorot: number;
        availableAmountAgorot: number;
        heldAmountAgorot: number;
        currency: string;
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
        nextCheckInSession: {
          applicationId: string;
          jobId: Id<"jobs">;
          sport: string;
          studioName: string;
          branchName: string;
          branchAddress?: string;
          zone: string;
          startTime: number;
          endTime: number;
          pay: number;
          checkInStatus?: "verified" | "rejected";
          checkInReason?:
            | "verified"
            | "outside_radius"
            | "accuracy_too_low"
            | "sample_too_old"
            | "outside_check_in_window"
            | "branch_location_missing";
          checkedInAt?: number;
        } | null;
      }
    | undefined;
  instructorSettings:
    | {
        displayName: string;
        bio?: string;
        sports: string[];
      }
    | null
    | undefined;
  instructorComplianceSummary:
    | {
        diditApproved: boolean;
      }
    | null
    | undefined;
  instructorPayoutSummary:
    | {
        hasVerifiedDestination: boolean;
      }
    | undefined;
  availableInstructorJobs: InstructorMarketplaceJob[] | undefined;
  studioSettings:
    | {
        studioName: string;
        bio?: string;
        sports: string[];
        primaryBranch?: {
          branchId: Id<"studioBranches">;
        };
      }
    | null
    | undefined;
  studioComplianceSummary:
    | {
        ownerIdentityStatus: "approved" | "pending" | "missing" | "failed";
        businessProfileStatus: "incomplete" | "complete";
        paymentStatus: "missing" | "pending" | "ready" | "failed";
      }
    | null
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
        applications?: Application[];
      }>
    | undefined;
  withdrawingApplicationId?: Id<"jobApplications"> | null;
  onWithdrawApplication?: (applicationId: Id<"jobApplications">) => void;
};

export const HomeRoleContent = memo(function HomeRoleContent({
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
  onWithdrawApplication,
}: HomeRoleContentProps) {
  const router = useRouter();
  const reviewApplication = useMutation(api.jobs.reviewApplication);

  // Sheet openers for instructor profile sub-pages
  const instructorSheetHandlers = useOpenInstructorSheet();

  // Sheet openers for studio profile sub-pages
  const studioSheetHandlers = useOpenStudioSheet();

  const openInstructorStudio = (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => {
    router.push(
      buildStudioProfileRoute({
        owner: "global",
        studioId: String(studioId),
        jobId: String(jobId),
      }),
    );
  };
  const openPublicInstructor = (instructorId: Id<"instructorProfiles">) => {
    router.push(
      buildInstructorProfileRoute({ owner: "global", instructorId: String(instructorId) }),
    );
  };

  if (activeRole === "instructor") {
    const isLoading =
      instructorHomeStats === undefined ||
      availableInstructorJobs === undefined ||
      instructorSettings === undefined ||
      instructorComplianceSummary === undefined ||
      instructorPayoutSummary === undefined;
    const instructorSetupItems: HomeChecklistItem[] = [
      {
        id: "verify",
        label: t("profile.setup.verifyIdentity"),
        icon: "shield.lefthalf.filled",
        done: instructorComplianceSummary?.diditApproved ?? false,
        onPress: () => instructorSheetHandlers.openCompliance(),
      },
      {
        id: "payouts",
        label: t("profile.setup.connectPayouts"),
        icon: "creditcard.fill",
        done: instructorPayoutSummary?.hasVerifiedDestination ?? false,
        onPress: () => instructorSheetHandlers.openPayments(),
      },
      {
        id: "profile",
        label: t("home.tasks.instructor.profileTitle"),
        icon: "person.fill",
        done: Boolean(instructorSettings?.displayName?.trim() && instructorSettings?.bio?.trim()),
        onPress: () => instructorSheetHandlers.openEdit(),
      },
      {
        id: "sports",
        label: t("profile.setup.chooseSports"),
        icon: "flame.fill",
        done: (instructorSettings?.sports?.length ?? 0) > 0,
        onPress: () => instructorSheetHandlers.openSports(),
      },
    ];
    return (
      <InstructorHomeContent
        isLoading={isLoading}
        locale={locale}
        pendingApplications={instructorHomeStats?.pendingApplications ?? 0}
        t={t}
        upcomingSessions={instructorHomeStats?.upcomingSessions ?? []}
        nextCheckInSession={instructorHomeStats?.nextCheckInSession ?? null}
        setupItems={instructorSetupItems}
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

  const isLoading =
    myStudioJobs === undefined ||
    studioSettings === undefined ||
    studioComplianceSummary === undefined;
  const studioSetupItems: HomeChecklistItem[] = [
    {
      id: "owner",
      label: t("home.tasks.studio.ownerTitle"),
      icon: "person.crop.circle.fill",
      done: studioComplianceSummary?.ownerIdentityStatus === "approved",
      onPress: () => studioSheetHandlers.openCompliance(),
    },
    {
      id: "business",
      label: t("home.tasks.studio.businessTitle"),
      icon: "building.2.fill",
      done: studioComplianceSummary?.businessProfileStatus === "complete",
      onPress: () => studioSheetHandlers.openCompliance(),
    },
    {
      id: "payments",
      label: t("profile.setup.connectPayouts"),
      icon: "creditcard.fill",
      done: studioComplianceSummary?.paymentStatus === "ready",
      onPress: () => studioSheetHandlers.openCompliance(),
    },
    {
      id: "profile",
      label: t("home.tasks.studio.profileTitle"),
      icon: "building.columns.fill",
      done: Boolean(studioSettings?.studioName?.trim() && studioSettings?.bio?.trim()),
      onPress: () => studioSheetHandlers.openEdit(),
    },
    {
      id: "sports",
      label: t("profile.setup.chooseSports"),
      icon: "flame.fill",
      done: (studioSettings?.sports?.length ?? 0) > 0,
      onPress: () => studioSheetHandlers.openEdit(),
    },
    {
      id: "branch",
      label: t("home.tasks.studio.branchTitle"),
      icon: "location.fill",
      done: Boolean(studioSettings?.primaryBranch),
      onPress: () => studioSheetHandlers.openBranches(),
    },
  ];

  return (
    <StudioHomeContent
      isLoading={isLoading}
      locale={locale}
      openJobs={openJobs}
      pendingApplicants={pendingApplicants}
      currencyFormatter={currencyFormatter}
      t={t}
      recentJobs={studioJobs}
      jobsFilled={jobsFilled}
      setupItems={studioSetupItems}
      onOpenJobs={() => router.push(STUDIO_JOBS_ROUTE)}
      onOpenCalendar={() => router.push(STUDIO_CALENDAR_ROUTE)}
      onOpenInstructorProfile={openPublicInstructor}
      reviewApplication={reviewApplication}
    />
  );
});
