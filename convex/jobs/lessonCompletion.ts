import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation, internalMutation } from "../_generated/server";
import {
  requireInstructorProfile,
  enqueueUserNotification,
  toDisplayLabel,
  FIVE_MINUTES_MS,
  requireStudioProfile,
  scheduleGoogleCalendarSyncForUser,
} from "./_helpers";

export const markLessonCompleted = mutation({
  args: { jobId: v.id("jobs") },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) {
      throw new ConvexError("Job not found");
    }
    if (job.filledByInstructorId !== instructor._id) {
      throw new ConvexError("Not authorized for this lesson");
    }
    if (job.status === "cancelled") {
      throw new ConvexError("Cancelled lessons cannot be completed");
    }
    if (job.status === "completed") {
      return { ok: true };
    }

    const now = Date.now();
    if (now + FIVE_MINUTES_MS < job.endTime) {
      throw new ConvexError("Lesson can be completed near or after end time");
    }

    await ctx.db.patch("jobs", job._id, { status: "completed" });
    await ctx.scheduler.runAfter(0, internal.notifications.core.cancelJobNotificationSchedules, {
      jobId: job._id,
      reason: "lesson_completed",
    });
    const studio = await ctx.db.get("studioProfiles", job.studioId);
    if (studio) {
      await enqueueUserNotification(ctx, {
        recipientUserId: studio.userId,
        actorUserId: instructor.userId,
        kind: "lesson_completed",
        title: "Lesson marked complete",
        body: `${instructor.displayName} marked ${toDisplayLabel(job.sport)} as complete.`,
        jobId: job._id,
      });
    }

    return { ok: true };
  },
});

export const emitLessonLifecycleEvent = internalMutation({
  args: {
    jobId: v.id("jobs"),
    instructorId: v.id("instructorProfiles"),
    event: v.union(v.literal("lesson_started"), v.literal("lesson_completed")),
  },
  returns: v.object({ emitted: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("jobs", args.jobId);
    const instructor = await ctx.db.get("instructorProfiles", args.instructorId);
    if (!job || !instructor) {
      return { emitted: false };
    }

    if (job.filledByInstructorId !== instructor._id) {
      return { emitted: false };
    }
    if (job.status === "cancelled" || job.status === "open") {
      return { emitted: false };
    }

    const now = Date.now();
    if (args.event === "lesson_started" && now < job.startTime) {
      return { emitted: false };
    }
    if (args.event === "lesson_completed" && now < job.endTime) {
      return { emitted: false };
    }

    const studio = await ctx.db.get("studioProfiles", job.studioId);
    const studioName = studio?.studioName ?? "Your studio";

    if (args.event === "lesson_completed" && job.status === "filled") {
      await ctx.db.patch("jobs", job._id, { status: "completed" });
      await ctx.scheduler.runAfter(0, internal.notifications.core.cancelJobNotificationSchedules, {
        jobId: job._id,
        reason: "lesson_completed",
      });
    }

    await enqueueUserNotification(ctx, {
      recipientUserId: instructor.userId,
      kind: args.event,
      title: args.event === "lesson_started" ? "Lesson started" : "Lesson completed",
      body:
        args.event === "lesson_started"
          ? `${toDisplayLabel(job.sport)} at ${studioName} is now live.`
          : `${toDisplayLabel(job.sport)} at ${studioName} is marked complete.`,
      jobId: job._id,
      ...(studio?.userId !== undefined ? { actorUserId: studio.userId } : {}),
    });

    return { emitted: true };
  },
});
