import { v } from "convex/values";
import { query } from "../_generated/server";

export const checkInstructorConflicts = query({
  args: {
    instructorId: v.id("instructorProfiles"),
    startTime: v.number(),
    endTime: v.number(),
    excludeJobId: v.optional(v.id("jobs")),
  },
  returns: v.object({
    hasConflict: v.boolean(),
    conflictingJobs: v.array(
      v.object({
        jobId: v.id("jobs"),
        sport: v.string(),
        studioName: v.string(),
        startTime: v.number(),
        endTime: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_filledByInstructor_startTime", (q) =>
        q.eq("filledByInstructorId", args.instructorId),
      )
      .collect();

    const conflictingJobs = [];

    for (const job of jobs) {
      if (job.status !== "filled") continue;
      if (args.excludeJobId && job._id === args.excludeJobId) continue;
      if (job.startTime < args.endTime && job.endTime > args.startTime) {
        const studio = await ctx.db.get("studioProfiles", job.studioId);
        conflictingJobs.push({
          jobId: job._id,
          sport: job.sport,
          studioName: studio?.studioName ?? "Unknown studio",
          startTime: job.startTime,
          endTime: job.endTime,
        });
      }
    }

    return {
      hasConflict: conflictingJobs.length > 0,
      conflictingJobs,
    };
  },
});
