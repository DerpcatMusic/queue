import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { query } from "../_generated/server";
import { queryAvailableJobsForInstructorCoverage } from "../lib/instructorGeoCoverage";
import { requireInstructorProfile } from "./_helpers";
import { BADGE_COUNT_CAP, clampBadgeCount } from "./_helpers";

export const getInstructorTabCounts = query({
  args: {
    now: v.optional(v.number()),
  },
  returns: v.object({
    jobsBadgeCount: v.number(),
    calendarBadgeCount: v.number(),
  }),
  handler: async (ctx, args) => {
    let instructor: any;
    try {
      instructor = await requireInstructorProfile(ctx);
    } catch (error) {
      if (error instanceof ConvexError) {
        return { jobsBadgeCount: 0, calendarBadgeCount: 0 };
      }
      throw error;
    }
    const now = args.now ?? Date.now();

    const sportRows = await ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructor._id))
      .collect();
    const sports = new Set(sportRows.map((r: any) => r.sport));

    let jobsBadgeCount = 0;

    if (sports.size > 0) {
      const matchingJobs = await queryAvailableJobsForInstructorCoverage(ctx, {
        instructorId: instructor._id,
        status: "open",
        limit: BADGE_COUNT_CAP,
      });

      for (const job of matchingJobs) {
        if (job.startTime <= now) continue;
        if (typeof job.applicationDeadline === "number" && job.applicationDeadline < now) continue;
        jobsBadgeCount++;
        if (jobsBadgeCount >= BADGE_COUNT_CAP) break;
      }
    }

    const applications = await ctx.db
      .query("jobApplications")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructor._id))
      .take(200);
    const acceptedJobIds = [
      ...new Set(
        applications
          .filter((application: any) => application.status === "accepted")
          .map((application: any) => application.jobId),
      ),
    ];
    const acceptedJobs = await Promise.all(
      acceptedJobIds.map((jobId: any) => ctx.db.get("jobs", jobId)),
    );

    let calendarBadgeCount = 0;
    for (const job of acceptedJobs) {
      if (!job) continue;
      if (job.status === "cancelled" || job.status === "completed") continue;
      if (job.endTime <= now) continue;
      calendarBadgeCount += 1;
      if (calendarBadgeCount >= BADGE_COUNT_CAP) break;
    }

    return {
      jobsBadgeCount: clampBadgeCount(jobsBadgeCount),
      calendarBadgeCount: clampBadgeCount(calendarBadgeCount),
    };
  },
});
