import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { generateUniqueInstructorSlug, generateUniqueStudioSlug } from "../lib/slug";
import { omitUndefined } from "../lib/validation";
import { DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE } from "./shared";

export const backfillPublicProfileSlugs = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    updatedInstructors: v.number(),
    updatedStudios: v.number(),
    hasMore: v.boolean(),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const instructorPage = await ctx.db
      .query("instructorProfiles")
      .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

    let updatedInstructors = 0;
    for (const profile of instructorPage.page) {
      if (!profile.slug) {
        const slug = await generateUniqueInstructorSlug(profile.displayName, ctx);
        await ctx.db.patch(profile._id, { slug });
        updatedInstructors += 1;
      }
    }

    const studioProfiles = await ctx.db.query("studioProfiles").collect();
    let updatedStudios = 0;
    for (const profile of studioProfiles.slice(0, batchSize)) {
      if (!profile.slug) {
        const slug = await generateUniqueStudioSlug(profile.studioName, ctx);
        await ctx.db.patch(profile._id, { slug });
        updatedStudios += 1;
      }
    }

    return {
      updatedInstructors,
      updatedStudios,
      hasMore: !instructorPage.isDone,
      ...omitUndefined({
        nextCursor: instructorPage.isDone ? undefined : instructorPage.continueCursor,
      }),
    };
  },
});
