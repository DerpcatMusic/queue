import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { ensureStudioInfrastructure } from "../lib/studioBranches";
import { omitUndefined } from "../lib/validation";

export const backfillStudioBranchInfrastructure = mutation({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    scanned: v.number(),
    updatedStudios: v.number(),
    updatedJobs: v.number(),
    updatedApplications: v.number(),
    updatedStats: v.number(),
    updatedCalendarIntegrations: v.number(),
    hasMore: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(Math.floor(args.batchSize ?? 50), 1), 200);
    const page = await ctx.db
      .query("studioProfiles")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let updatedStudios = 0;
    let updatedJobs = 0;
    let updatedApplications = 0;
    let updatedStats = 0;
    let updatedCalendarIntegrations = 0;

    for (const studio of page.page) {
      const now = Date.now();
      const { branch } = await ensureStudioInfrastructure(ctx, studio, now);
      updatedStudios += 1;

      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_studio", (q: any) => q.eq("studioId", studio._id))
        .collect();
      for (const job of jobs) {
        const patch = omitUndefined({
          branchId: job.branchId ?? branch._id,
          branchNameSnapshot: job.branchNameSnapshot ?? branch.name,
          branchAddressSnapshot: job.branchAddressSnapshot ?? branch.address,
        });
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(job._id, patch);
          updatedJobs += 1;
        }
      }

      const applications = await ctx.db
        .query("jobApplications")
        .withIndex("by_studio", (q: any) => q.eq("studioId", studio._id))
        .collect();
      for (const application of applications) {
        if (!application.branchId) {
          await ctx.db.patch(application._id, { branchId: branch._id });
          updatedApplications += 1;
        }
      }

      const stats = await ctx.db
        .query("jobApplicationStats")
        .withIndex("by_studio", (q: any) => q.eq("studioId", studio._id))
        .collect();
      for (const stat of stats) {
        if (!stat.branchId) {
          await ctx.db.patch(stat._id, { branchId: branch._id });
          updatedStats += 1;
        }
      }

      const integrations = await ctx.db
        .query("calendarIntegrations")
        .withIndex("by_studio_provider", (q: any) => q.eq("studioId", studio._id))
        .collect();
      for (const integration of integrations) {
        if (!integration.branchId) {
          await ctx.db.patch(integration._id, { branchId: branch._id });
          updatedCalendarIntegrations += 1;
        }
      }
    }

    return {
      scanned: page.page.length,
      updatedStudios,
      updatedJobs,
      updatedApplications,
      updatedStats,
      updatedCalendarIntegrations,
      hasMore: !page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});
