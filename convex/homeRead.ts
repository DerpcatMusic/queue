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
import { omitUndefined, trimOptionalString } from "./lib/validation";

const HOME_MATCH_COUNT_CAP = 99;
const HOME_UPCOMING_SESSIONS_LIMIT = 3;
const HOME_HISTORY_JOB_LIMIT = 1000;
const HOME_CHECK_IN_WINDOW_BEFORE_MS = 45 * 60 * 1000;
const HOME_CHECK_IN_WINDOW_AFTER_MS = 30 * 60 * 1000;

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

function getCurrentMonthStart(now: number) {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

async function getMyInstructorPayoutSnapshotReadV2(ctx: QueryCtx, userId: Doc<"users">["_id"]) {
  const connectedAccount = await ctx.db
    .query("connectedAccountsV2")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .first();

  const orders = await ctx.db
    .query("paymentOrdersV2")
    .withIndex("by_instructor_user", (q) => q.eq("instructorUserId", userId))
    .order("desc")
    .collect();

  let currency = orders[0]?.currency ?? "ILS";
  let lifetimeEarnedAmountAgorot = 0;
  let paidAmountAgorot = 0;
  let availableAmountAgorot = 0;
  let heldAmountAgorot = 0;

  for (const order of orders) {
    currency = order.currency || currency;
    const amountAgorot = order.pricing.instructorOfferAmountAgorot;
    lifetimeEarnedAmountAgorot += amountAgorot;

    const split = await ctx.db
      .query("fundSplitsV2")
      .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", order._id))
      .order("desc")
      .first();
    const transfer = split
      ? await ctx.db
          .query("payoutTransfersV2")
          .withIndex("by_fund_split", (q) => q.eq("fundSplitId", split._id))
          .order("desc")
          .first()
      : null;

    const paid = transfer?.status === "paid" || split?.status === "settled";
    const available =
      order.status === "succeeded" &&
      !paid &&
      split !== null &&
      split.status !== "failed" &&
      split.status !== "reversed" &&
      transfer?.status !== "failed" &&
      transfer?.status !== "cancelled" &&
      transfer?.status !== "needs_attention";

    if (paid) {
      paidAmountAgorot += amountAgorot;
      continue;
    }
    if (available) {
      availableAmountAgorot += amountAgorot;
      continue;
    }
    heldAmountAgorot += amountAgorot;
  }

  return {
    currency,
    lifetimeEarnedAmountAgorot,
    paidAmountAgorot,
    availableAmountAgorot,
    heldAmountAgorot,
    outstandingAmountAgorot: Math.max(0, lifetimeEarnedAmountAgorot - paidAmountAgorot),
    hasVerifiedDestination: connectedAccount?.status === "active",
  };
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
  const currentMonthStart = getCurrentMonthStart(now);
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
  const upcomingBranchIds = [...new Set(upcomingApplications.map((row) => row.job.branchId))];
  const upcomingStudios = await Promise.all(
    upcomingStudioIds.map((studioId) => ctx.db.get("studioProfiles", studioId)),
  );
  const upcomingBranches = await Promise.all(
    upcomingBranchIds.map((branchId) => ctx.db.get("studioBranches", branchId)),
  );
  const upcomingStudioById = new Map<string, Doc<"studioProfiles">>();
  for (let index = 0; index < upcomingStudioIds.length; index += 1) {
    const studioId = upcomingStudioIds[index];
    const studio = upcomingStudios[index];
    if (studio) {
      upcomingStudioById.set(String(studioId), studio);
    }
  }
  const upcomingBranchById = new Map<string, Doc<"studioBranches">>();
  for (let index = 0; index < upcomingBranchIds.length; index += 1) {
    const branch = upcomingBranches[index];
    if (branch) {
      upcomingBranchById.set(String(branch._id), branch);
    }
  }

  const countableJobs = assignedJobs.filter(
    (job) => job.status !== "cancelled" && (job.status === "completed" || job.endTime <= now),
  );
  const jobEarnedTotalAgorot = countableJobs.reduce((sum, job) => sum + toAgorot(job.pay), 0);
  const thisMonthEarningsAgorot = countableJobs
    .filter((job) => job.endTime >= currentMonthStart)
    .reduce((sum, job) => sum + toAgorot(job.pay), 0);

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
    getMyInstructorPayoutSnapshotReadV2(ctx, user._id),
  ]);
  const acceptedApplicationByJobId = new Map(
    applications
      .filter((application) => application.status === "accepted")
      .map((application) => [String(application.jobId), application] as const),
  );
  const nextCheckInJob =
    assignedJobs
      .filter((job) => {
        if (job.status !== "filled") {
          return false;
        }
        if (job.endTime <= now) {
          return false;
        }
        if (!acceptedApplicationByJobId.has(String(job._id))) {
          return false;
        }
        const checkInWindowEndsAt = Math.min(
          job.endTime,
          job.startTime + HOME_CHECK_IN_WINDOW_AFTER_MS,
        );
        return now >= job.startTime - HOME_CHECK_IN_WINDOW_BEFORE_MS && now <= checkInWindowEndsAt;
      })
      .sort((a, b) => a.startTime - b.startTime)[0] ?? null;
  const nextCheckInApplication = nextCheckInJob
    ? acceptedApplicationByJobId.get(String(nextCheckInJob._id)) ?? null
    : null;
  const nextCheckInBranch = nextCheckInJob
    ? upcomingBranchById.get(String(nextCheckInJob.branchId)) ??
      (await ctx.db.get("studioBranches", nextCheckInJob.branchId))
    : null;
  const latestCheckIn =
    nextCheckInJob && nextCheckInApplication
      ? await ctx.db
          .query("lessonCheckIns")
          .withIndex("by_job_and_instructor", (q) =>
            q.eq("jobId", nextCheckInJob._id).eq("instructorId", instructorProfile._id),
          )
          .order("desc")
          .first()
      : null;
  const totalEarningsAgorot = Math.max(
    jobEarnedTotalAgorot,
    payoutSnapshot.lifetimeEarnedAmountAgorot,
  );
  const outstandingAmountAgorot = Math.max(
    payoutSnapshot.outstandingAmountAgorot,
    Math.max(0, totalEarningsAgorot - payoutSnapshot.paidAmountAgorot),
  );
  const nextCheckInBranchAddress =
    nextCheckInJob?.branchAddressSnapshot ?? nextCheckInBranch?.address ?? undefined;

  return {
    isVerified:
      internalAccess.verificationBypass ||
      payoutSnapshot.hasVerifiedDestination,
    openMatches,
    pendingApplications,
    thisMonthEarningsAgorot,
    totalEarningsAgorot,
    paidOutAmountAgorot: payoutSnapshot.paidAmountAgorot,
    outstandingAmountAgorot,
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
      ...omitUndefined({
        boundaryProvider: job.boundaryProvider,
        boundaryId: job.boundaryId,
      }),
    })),
    nextCheckInSession:
      nextCheckInJob && nextCheckInApplication
        ? {
            applicationId: nextCheckInApplication._id,
            jobId: nextCheckInJob._id,
            sport: nextCheckInJob.sport,
            studioName:
              upcomingStudioById.get(String(nextCheckInJob.studioId))?.studioName ??
              "Unknown studio",
            branchName:
              nextCheckInJob.branchNameSnapshot ?? nextCheckInBranch?.name ?? "Main branch",
            zone: trimOptionalString(nextCheckInJob.zone) ?? nextCheckInJob.zone,
            startTime: nextCheckInJob.startTime,
            endTime: nextCheckInJob.endTime,
            pay: nextCheckInJob.pay,
            ...(nextCheckInBranchAddress ? { branchAddress: nextCheckInBranchAddress } : {}),
            ...omitUndefined({
              boundaryProvider: nextCheckInJob.boundaryProvider,
              boundaryId: nextCheckInJob.boundaryId,
            }),
            ...(latestCheckIn
              ? {
                  checkInStatus: latestCheckIn.verificationStatus,
                  checkInReason: latestCheckIn.verificationReason,
                  checkedInAt: latestCheckIn.checkedInAt,
                }
              : {}),
          }
        : null,
  };
}
