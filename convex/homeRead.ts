import { ConvexError } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireUserRole } from "./lib/auth";
import { isKnownZoneId } from "./lib/domainValidation";
import { hasCoverageKey, loadInstructorEligibility } from "./lib/instructorEligibility";
import { trimOptionalString } from "./lib/validation";

const HOME_MATCH_COUNT_CAP = 99;
const HOME_UPCOMING_SESSIONS_LIMIT = 3;
const HOME_HISTORY_JOB_LIMIT = 1000;

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

export async function getMyInstructorHomeStatsRead(ctx: QueryCtx) {
  const user = await requireUserRole(ctx, ["instructor"]);
  const [instructorProfile, eligibility] = await Promise.all([
    ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique(),
    ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique()
      .then(async (profile) => {
        if (!profile) {
          throw new ConvexError("Instructor profile not found");
        }
        return await loadInstructorEligibility(ctx, profile._id);
      }),
  ]);

  if (!instructorProfile) {
    throw new ConvexError("Instructor profile not found");
  }

  const now = Date.now();
  const performanceWindowStart = getPerformanceWindowStart(now);
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

    const matchingJobIds = new Set<string>();
    for (const jobsForPair of openJobsByCoveragePair) {
      for (const job of jobsForPair) {
        const normalizedJobZone = trimOptionalString(job.zone);
        if (!normalizedJobZone || !isKnownZoneId(normalizedJobZone)) {
          continue;
        }
        if (!hasCoverageKey(eligibility, job.sport, normalizedJobZone)) {
          continue;
        }
        if (job.startTime <= now) {
          continue;
        }
        if (job.applicationDeadline !== undefined && job.applicationDeadline < now) {
          continue;
        }

        matchingJobIds.add(String(job._id));
        if (matchingJobIds.size >= HOME_MATCH_COUNT_CAP) {
          break;
        }
      }
      if (matchingJobIds.size >= HOME_MATCH_COUNT_CAP) {
        break;
      }
    }

    openMatches = matchingJobIds.size;
  }

  const applications = await ctx.db
    .query("jobApplications")
    .withIndex("by_instructor_appliedAt", (q) => q.eq("instructorId", instructorProfile._id))
    .order("desc")
    .take(250);

  const pendingApplications = applications.filter((application) => application.status === "pending").length;

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

  const assignedJobs = await ctx.db
    .query("jobs")
    .withIndex("by_filledByInstructor_startTime", (q) =>
      q.eq("filledByInstructorId", instructorProfile._id),
    )
    .order("desc")
    .take(HOME_HISTORY_JOB_LIMIT);

  const countableJobs = assignedJobs.filter(
    (job) =>
      job.status !== "cancelled" &&
      (job.status === "completed" || job.endTime <= now),
  );

  const totalEarningsAgorot = countableJobs.reduce(
    (sum, job) => sum + toAgorot(job.pay),
    0,
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

  return {
    isVerified:
      instructorProfile.diditVerificationStatus === "approved" &&
      Boolean(instructorProfile.diditLegalName?.trim()),
    openMatches,
    pendingApplications,
    totalEarningsAgorot,
    earningsEvents,
    lessonEvents,
    upcomingSessions: upcomingApplications.map(({ application, job }) => ({
      applicationId: application._id,
      sport: job.sport,
      studioName:
        upcomingStudioById.get(String(job.studioId))?.studioName ?? "Unknown studio",
      zone: trimOptionalString(job.zone) ?? job.zone,
      startTime: job.startTime,
      pay: job.pay,
    })),
  };
}
