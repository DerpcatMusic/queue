import { ConvexError } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireUserRole } from "./lib/auth";
import { isKnownZoneId } from "./lib/domainValidation";
import {
  hasCoverageKey,
  type InstructorEligibility,
  isEligibleForJob,
  loadInstructorEligibility,
} from "./lib/instructorEligibility";
import { resolveInternalAccessForUserId } from "./lib/internalAccess";
import { trimOptionalString } from "./lib/validation";
import { getMyInstructorPayoutSnapshotRead } from "./paymentsRead";

const HOME_MATCH_COUNT_CAP = 99;
const HOME_UPCOMING_SESSIONS_LIMIT = 3;
const HOME_HISTORY_JOB_LIMIT = 1000;

type OpenMatchCandidate = Pick<
  Doc<"jobs">,
  "_id" | "sport" | "zone" | "startTime" | "applicationDeadline"
>;

function toAgorot(amount: number) {
  if (!Number.isFinite(amount)) {
    throw new ConvexError("Invalid job pay amount");
  }
  return Math.round(amount * 100);
}

function getPerformanceWindowStart(now: number) {
  const d = new Date(now);
  d.setMonth(d.getMonth() - 11, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function countEligibleOpenJobMatches(args: {
  eligibility: InstructorEligibility;
  jobsByCoveragePair: ReadonlyArray<ReadonlyArray<OpenMatchCandidate>>;
  now: number;
  cap?: number;
}) {
  const matchingJobIds = new Set<string>();
  const cap = args.cap ?? HOME_MATCH_COUNT_CAP;

  for (const jobsForPair of args.jobsByCoveragePair) {
    for (const job of jobsForPair) {
      const normalizedJobZone = trimOptionalString(job.zone);
      if (!normalizedJobZone || !isKnownZoneId(normalizedJobZone)) {
        continue;
      }
      if (!hasCoverageKey(args.eligibility, job.sport, normalizedJobZone)) {
        continue;
      }
      if (job.startTime <= args.now) {
        continue;
      }
      if (job.applicationDeadline !== undefined && job.applicationDeadline < args.now) {
        continue;
      }

      matchingJobIds.add(String(job._id));
      if (matchingJobIds.size >= cap) {
        return matchingJobIds.size;
      }
    }
  }

  return matchingJobIds.size;
}

export function countEligibleOpenJobMatchesBySport(args: {
  eligibility: InstructorEligibility;
  jobsBySport: ReadonlyArray<ReadonlyArray<OpenMatchCandidate>>;
  now: number;
  cap?: number;
}) {
  const matchingJobIds = new Set<string>();
  const cap = args.cap ?? HOME_MATCH_COUNT_CAP;

  for (const jobsForSport of args.jobsBySport) {
    for (const job of jobsForSport) {
      const normalizedJobZone = trimOptionalString(job.zone);
      if (!normalizedJobZone || !isKnownZoneId(normalizedJobZone)) {
        continue;
      }
      if (!isEligibleForJob(args.eligibility, job.sport, normalizedJobZone)) {
        continue;
      }
      if (job.startTime <= args.now) {
        continue;
      }
      if (job.applicationDeadline !== undefined && job.applicationDeadline < args.now) {
        continue;
      }

      matchingJobIds.add(String(job._id));
      if (matchingJobIds.size >= cap) {
        return matchingJobIds.size;
      }
    }
  }

  return matchingJobIds.size;
}

export async function getMyInstructorHomeStatsRead(ctx: QueryCtx) {
  const user = await requireUserRole(ctx, ["instructor"]);
  const instructorProfile = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
    .unique();
  if (!instructorProfile) {
    throw new ConvexError("Instructor profile not found");
  }

  const now = Date.now();
  const performanceWindowStart = getPerformanceWindowStart(now);
  const [eligibility, applications, assignedJobs] = await Promise.all([
    loadInstructorEligibility(ctx, instructorProfile._id),
    ctx.db
      .query("jobApplications")
      .withIndex("by_instructor_appliedAt", (q) => q.eq("instructorId", instructorProfile._id))
      .order("desc")
      .take(250),
    ctx.db
      .query("jobs")
      .withIndex("by_filledByInstructor_startTime", (q) =>
        q.eq("filledByInstructorId", instructorProfile._id),
      )
      .order("desc")
      .take(HOME_HISTORY_JOB_LIMIT),
  ]);
  let openMatches = 0;

  if (eligibility.coverageCount > 0) {
    const fetchPerPair = Math.min(
      Math.max(Math.ceil((HOME_MATCH_COUNT_CAP * 2) / eligibility.coveragePairs.length), 8),
      80,
    );

    const openJobsByCoveragePair = await Promise.all(
      eligibility.coveragePairs.map(({ sport, zone }) =>
        ctx.db
          .query("jobs")
          .withIndex("by_sport_zone_status_postedAt", (q) =>
            q.eq("sport", sport).eq("zone", zone).eq("status", "open"),
          )
          .order("desc")
          .take(fetchPerPair),
      ),
    );

    openMatches = countEligibleOpenJobMatches({
      eligibility,
      jobsByCoveragePair: openJobsByCoveragePair,
      now,
    });
  } else if (eligibility.sports.size > 0) {
    const sports = [...eligibility.sports];
    const fetchPerSport = Math.min(
      Math.max(Math.ceil((HOME_MATCH_COUNT_CAP * 2) / sports.length), 8),
      80,
    );

    const openJobsBySport = await Promise.all(
      sports.map((sport) =>
        ctx.db
          .query("jobs")
          .withIndex("by_sport_and_status", (q) => q.eq("sport", sport).eq("status", "open"))
          .order("desc")
          .take(fetchPerSport),
      ),
    );

    openMatches = countEligibleOpenJobMatchesBySport({
      eligibility,
      jobsBySport: openJobsBySport,
      now,
    });
  }

  const pendingApplications = applications.filter(
    (application) => application.status === "pending",
  ).length;

  const applicationJobIds = [...new Set(applications.map((application) => application.jobId))];
  const applicationJobs = await Promise.all(
    applicationJobIds.map((jobId) => ctx.db.get("jobs", jobId)),
  );
  const applicationJobById = new Map<string, Doc<"jobs">>();
  for (let index = 0; index < applicationJobIds.length; index += 1) {
    const jobId = applicationJobIds[index];
    const job = applicationJobs[index];
    if (job) {
      applicationJobById.set(String(jobId), job);
    }
  }

  const upcomingApplications = applications
    .filter((application) => application.status === "accepted")
    .map((application) => ({
      application,
      job: applicationJobById.get(String(application.jobId)),
    }))
    .filter(
      (
        row,
      ): row is {
        application: Doc<"jobApplications">;
        job: Doc<"jobs">;
      } => Boolean(row.job && row.job.startTime > now),
    )
    .sort((a, b) => a.job.startTime - b.job.startTime)
    .slice(0, HOME_UPCOMING_SESSIONS_LIMIT);

  const upcomingStudioIds = [...new Set(upcomingApplications.map((row) => row.job.studioId))];
  const upcomingStudios = await Promise.all(
    upcomingStudioIds.map((studioId) => ctx.db.get("studioProfiles", studioId)),
  );
  const upcomingStudioById = new Map<string, Doc<"studioProfiles">>();
  for (let index = 0; index < upcomingStudioIds.length; index += 1) {
    const studioId = upcomingStudioIds[index];
    const studio = upcomingStudios[index];
    if (studio) {
      upcomingStudioById.set(String(studioId), studio);
    }
  }

  const countableJobs = assignedJobs.filter(
    (job) => job.status !== "cancelled" && (job.status === "completed" || job.endTime <= now),
  );

  const earningsEvents = countableJobs
    .filter((job) => job.endTime >= performanceWindowStart)
    .map((job) => ({
      timestamp: job.endTime,
      amountAgorot: toAgorot(job.pay),
    }));

  const lessonEvents = countableJobs
    .filter((job) => job.endTime >= performanceWindowStart)
    .map((job) => ({
      endTime: job.endTime,
    }));
  const [internalAccess, payoutSnapshot] = await Promise.all([
    resolveInternalAccessForUserId(ctx, instructorProfile.userId),
    getMyInstructorPayoutSnapshotRead(ctx, user._id),
  ]);

  return {
    isVerified:
      internalAccess.verificationBypass ||
      (instructorProfile.diditVerificationStatus === "approved" &&
        Boolean(instructorProfile.diditLegalName?.trim())),
    openMatches,
    pendingApplications,
    totalEarningsAgorot: payoutSnapshot.lifetimeEarnedAmountAgorot,
    paidOutAmountAgorot: payoutSnapshot.paidAmountAgorot,
    outstandingAmountAgorot: payoutSnapshot.outstandingAmountAgorot,
    availableAmountAgorot: payoutSnapshot.availableAmountAgorot,
    heldAmountAgorot: payoutSnapshot.heldAmountAgorot,
    currency: payoutSnapshot.currency,
    earningsEvents,
    lessonEvents,
    upcomingSessions: upcomingApplications.map(({ application, job }) => ({
      applicationId: application._id,
      sport: job.sport,
      studioName: upcomingStudioById.get(String(job.studioId))?.studioName ?? "Unknown studio",
      zone: trimOptionalString(job.zone) ?? job.zone,
      startTime: job.startTime,
      pay: job.pay,
    })),
  };
}
