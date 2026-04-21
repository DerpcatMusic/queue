import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { type MutationCtx, mutation } from "../_generated/server";
import { omitUndefined } from "../lib/validation";
import { DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE } from "./shared";

function stripLegacyGeospatialFieldsFromDoc(
  ctx: MutationCtx,
  table: "studioProfiles" | "studioBranches" | "jobs",
  doc: Doc<"studioProfiles"> | Doc<"studioBranches"> | Doc<"jobs">,
) {
  return ctx.db.patch(
    table as any,
    doc._id as any,
    {
      zone: undefined,
      boundaryProvider: undefined,
      boundaryId: undefined,
    } as any,
  );
}

export const removeLegacyStudioProfileGeospatialFields = mutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const result = await ctx.db
      .query("studioProfiles")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let processed = 0;
    for (const profile of result.page) {
      if (
        profile.zone === undefined &&
        profile.boundaryProvider === undefined &&
        profile.boundaryId === undefined
      ) {
        continue;
      }
      await stripLegacyGeospatialFieldsFromDoc(ctx, "studioProfiles", profile);
      processed += 1;
    }

    return {
      processed,
      hasMore: !result.isDone,
      ...omitUndefined({ cursor: result.isDone ? undefined : result.continueCursor }),
    };
  },
});

export const removeLegacyStudioBranchGeospatialFields = mutation({
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
        branch.zone === undefined &&
        branch.boundaryProvider === undefined &&
        branch.boundaryId === undefined
      ) {
        continue;
      }
      await stripLegacyGeospatialFieldsFromDoc(ctx, "studioBranches", branch);
      processed += 1;
    }

    return {
      processed,
      hasMore: !result.isDone,
      ...omitUndefined({ cursor: result.isDone ? undefined : result.continueCursor }),
    };
  },
});

export const removeLegacyJobGeospatialFields = mutation({
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
        job.zone === undefined &&
        job.boundaryProvider === undefined &&
        job.boundaryId === undefined
      ) {
        continue;
      }
      await stripLegacyGeospatialFieldsFromDoc(ctx, "jobs", job);
      processed += 1;
    }

    return {
      processed,
      hasMore: !result.isDone,
      ...omitUndefined({ cursor: result.isDone ? undefined : result.continueCursor }),
    };
  },
});
