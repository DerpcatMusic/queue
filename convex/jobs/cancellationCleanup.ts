import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const cleanupCancelledJobs = internalMutation({
  args: {
    minAgeMs: v.optional(v.number()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deletedJobs: v.number(),
    deletedApplications: v.number(),
  }),
  handler: async (ctx, args) => {
    const minAgeMs = args.minAgeMs ?? 7 * 24 * 60 * 60 * 1000;
    const batchSize = args.batchSize ?? 100;
    const cutoffTime = Date.now() - minAgeMs;

    const cancelledJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "cancelled"))
      .filter((q: any) => q.lt(q.field("startTime"), cutoffTime))
      .take(batchSize);

    if (cancelledJobs.length === 0) {
      return { deletedJobs: 0, deletedApplications: 0 };
    }

    const jobIds = cancelledJobs.map((job: any) => job._id);
    let deletedApplications = 0;

    for (const jobId of jobIds) {
      const applications = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", jobId))
        .collect();

      for (const application of applications) {
        await ctx.db.delete(application._id);
        deletedApplications++;
      }

      await ctx.db.delete(jobId);
    }

    return {
      deletedJobs: cancelledJobs.length,
      deletedApplications,
    };
  },
});
