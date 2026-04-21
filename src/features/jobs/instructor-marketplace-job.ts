import type { Id } from "@/convex/_generated/dataModel";
import type { JobStatus } from "@/lib/jobs-utils";
import type { BoostPreset, JobClosureReason } from "@/lib/jobs-utils";

export type InstructorMarketplaceJob = {
  jobId: Id<"jobs">;
  applicationId?: Id<"jobApplications">;
  studioId: Id<"studioProfiles">;
  branchId: Id<"studioBranches">;
  sport: string;
  studioName: string;
  branchName: string;
  branchAddress?: string;
  studioImageUrl?: string | null;
  studioAddress?: string;
  note?: string;
  applicationStatus?: "pending" | "accepted" | "rejected" | "withdrawn";
  applicationDeadline?: number;
  startTime: number;
  endTime: number;
  zone: string;
  pay: number;
  timeZone?: string;
  status?: JobStatus;
  postedAt?: number;
  maxParticipants?: number;
  sessionLanguage?: string;
  equipmentProvided?: boolean;
  isRecurring?: boolean;
  cancellationDeadlineHours?: number;
  requiredLevel?: string;
  closureReason?: JobClosureReason;
  boostPreset?: BoostPreset;
  boostBonusAmount?: number;
  boostActive?: boolean;
  canApplyToJob: boolean;
  jobActionBlockedReason?:
    | "identity_verification_required"
    | "insurance_verification_required"
    | "sport_certificate_required";
  // For max 3 concurrent applicants feature
  pendingApplicationsCount?: number;
  isNearCapacity?: boolean; // true when 2+ applicants (2/3 or 3/3)
};

export type InstructorJobApplicationOverlay = {
  applicationId: Id<"jobApplications">;
  jobId: Id<"jobs">;
  status: NonNullable<InstructorMarketplaceJob["applicationStatus"]>;
};

export function mergeInstructorJobsWithApplications<T extends InstructorMarketplaceJob>(
  jobs: readonly T[] | undefined,
  applications: readonly InstructorJobApplicationOverlay[] | undefined,
): T[] {
  if (!jobs?.length) {
    return [];
  }

  if (!applications?.length) {
    return [...jobs];
  }

  const applicationByJobId = new Map(
    applications.map((application) => [String(application.jobId), application] as const),
  );

  return jobs.map((job) => {
    const application = applicationByJobId.get(String(job.jobId));
    if (!application) {
      return job;
    }

    return {
      ...job,
      applicationId: application.applicationId,
      applicationStatus: application.status,
    };
  });
}

export function sortInstructorJobsBySelectedId<T extends InstructorMarketplaceJob>(
  jobs: readonly T[],
  selectedJobId?: string | null,
): T[] {
  const selectedKey = selectedJobId ? String(selectedJobId) : null;

  return [...jobs].sort((left, right) => {
    if (selectedKey) {
      const leftSelected = String(left.jobId) === selectedKey;
      const rightSelected = String(right.jobId) === selectedKey;
      if (leftSelected && !rightSelected) return -1;
      if (!leftSelected && rightSelected) return 1;
    }

    return left.startTime - right.startTime;
  });
}
