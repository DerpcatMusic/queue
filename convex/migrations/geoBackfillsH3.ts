import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getH3HierarchyFromCell, safeH3Hierarchy } from "../lib/h3";
import { rebuildInstructorGeoCoverage } from "../lib/instructorGeoCoverage";
import { omitUndefined } from "../lib/validation";
import { DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE } from "./shared";

export const backfillBranchH3Index = mutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const result = await ctx.db
      .query("studioBranches")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let processed = 0;
    for (const branch of result.page) {
      if (
        branch.h3Index !== undefined &&
        branch.h3Res8 !== undefined &&
        branch.h3Res7 !== undefined &&
        branch.h3Res4 !== undefined &&
        branch.h3Res5 !== undefined &&
        branch.h3Res6 !== undefined
      ) {
        continue;
      }
      const h3 = safeH3Hierarchy(branch.latitude, branch.longitude);
      if (h3 === undefined) continue;
      await ctx.db.patch(branch._id, h3);
      processed += 1;
    }

    return {
      processed,
      hasMore: !result.isDone,
      ...omitUndefined({ cursor: result.isDone ? undefined : result.continueCursor }),
    };
  },
});

export const backfillInstructorH3Index = mutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const result = await ctx.db
      .query("instructorProfiles")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let processed = 0;
    for (const profile of result.page) {
      if (
        profile.h3Index !== undefined &&
        profile.h3Res8 !== undefined &&
        profile.h3Res7 !== undefined &&
        profile.h3Res4 !== undefined &&
        profile.h3Res5 !== undefined &&
        profile.h3Res6 !== undefined
      ) {
        continue;
      }
      const h3 = safeH3Hierarchy(profile.latitude, profile.longitude);
      if (h3 === undefined) continue;
      await ctx.db.patch(profile._id, h3);
      processed += 1;
    }

    return {
      processed,
      hasMore: !result.isDone,
      ...omitUndefined({ cursor: result.isDone ? undefined : result.continueCursor }),
    };
  },
});

export const backfillJobH3Index = mutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const result = await ctx.db
      .query("jobs")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let processed = 0;
    for (const job of result.page) {
      if (
        job.h3Index !== undefined &&
        job.h3Res8 !== undefined &&
        job.h3Res7 !== undefined &&
        job.h3Res4 !== undefined &&
        job.h3Res5 !== undefined &&
        job.h3Res6 !== undefined
      ) {
        continue;
      }
      const branch = await ctx.db.get(job.branchId);
      if (!branch?.h3Index) continue;
      await ctx.db.patch(job._id, getH3HierarchyFromCell(branch.h3Index));
      processed += 1;
    }

    return {
      processed,
      hasMore: !result.isDone,
      ...omitUndefined({ cursor: result.isDone ? undefined : result.continueCursor }),
    };
  },
});

export const rebuildInstructorGeoCoverageBatch = mutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const result = await ctx.db
      .query("instructorProfiles")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let processed = 0;
    for (const profile of result.page) {
      await rebuildInstructorGeoCoverage(ctx, {
        instructorId: profile._id,
      });
      processed += 1;
    }

    return {
      processed,
      hasMore: !result.isDone,
      ...omitUndefined({ cursor: result.isDone ? undefined : result.continueCursor }),
    };
  },
});
