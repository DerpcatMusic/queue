import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";
import { omitUndefined, trimOptionalString } from "../lib/validation";

export const submitLessonRating = mutation({
  args: {
    jobId: v.id("jobs"),
    score: v.number(),
    comment: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    if (!Number.isFinite(args.score) || args.score < 1 || args.score > 5) {
      throw new ConvexError("score must be between 1 and 5");
    }

    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) {
      throw new ConvexError("Job not found");
    }

    const assignmentRows = await ctx.db
      .query("jobAssignments")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();
    const assignment = assignmentRows.find((row) => row.status === "completed") ?? null;
    if (!assignment) {
      throw new ConvexError("Completed assignment not found");
    }

    const settlement = await ctx.db
      .query("jobSettlementStates")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .order("desc")
      .first();
    if (!settlement || settlement.settlementStatus !== "settled") {
      throw new ConvexError("Ratings are unlocked only after settlement");
    }

    const fromRole =
      currentUser.role === "studio"
        ? ("studio" as const)
        : currentUser.role === "instructor"
          ? ("instructor" as const)
          : null;
    if (!fromRole) {
      throw new ConvexError("Unauthorized");
    }

    const toRole = fromRole === "studio" ? "instructor" : "studio";
    const resolvedToUserId =
      fromRole === "studio"
        ? assignment.instructorUserId
        : (await ctx.db.get("studioProfiles", job.studioId))?.userId;
    if (!resolvedToUserId) {
      throw new ConvexError("Rating target not found");
    }

    const existing = await ctx.db
      .query("lessonRatings")
      .withIndex("by_from_to_job", (q) =>
        q.eq("fromUserId", currentUser._id).eq("toUserId", resolvedToUserId).eq("jobId", job._id),
      )
      .unique();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        score: args.score,
        updatedAt: now,
        ...omitUndefined({
          comment: trimOptionalString(args.comment),
        }),
      });
      return { ok: true };
    }

    await ctx.db.insert("lessonRatings", {
      jobId: job._id,
      assignmentId: assignment._id,
      studioId: job.studioId,
      instructorId: assignment.instructorId,
      fromUserId: currentUser._id,
      toUserId: resolvedToUserId,
      fromRole,
      toRole,
      score: Math.round(args.score),
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        comment: trimOptionalString(args.comment),
      }),
    });

    return { ok: true };
  },
});

export const getRatingsForLesson = query({
  args: {
    jobId: v.id("jobs"),
  },
  returns: v.array(
    v.object({
      ratingId: v.id("lessonRatings"),
      fromRole: v.union(v.literal("studio"), v.literal("instructor")),
      toRole: v.union(v.literal("studio"), v.literal("instructor")),
      score: v.number(),
      comment: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) {
      return [];
    }
    const studio = await ctx.db.get("studioProfiles", job.studioId);
    const assignmentRows = await ctx.db
      .query("jobAssignments")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();
    const assignment = assignmentRows.find((row) => row.status === "completed") ?? null;
    if (currentUser._id !== studio?.userId && currentUser._id !== assignment?.instructorUserId) {
      throw new ConvexError("Unauthorized");
    }

    const ratings = await ctx.db
      .query("lessonRatings")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .order("asc")
      .collect();

    return ratings.map((rating) => ({
      ratingId: rating._id,
      fromRole: rating.fromRole,
      toRole: rating.toRole,
      score: rating.score,
      createdAt: rating.createdAt,
      ...omitUndefined({
        comment: rating.comment,
      }),
    }));
  },
});
