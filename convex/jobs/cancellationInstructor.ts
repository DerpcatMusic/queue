import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import {
  enqueueUserNotification,
  recomputeJobApplicationStats,
  requireInstructorProfile,
  scheduleGoogleCalendarSyncForUser,
  toDisplayLabel,
} from "./_helpers";
import { internal } from "./cancellationShared";
import { auditJobCancellation } from "../lib/audit";

/**
 * cancelMyBooking: Cancel a filled job by instructor.
 * 
 * AUDIT: Logs job cancellations for security and compliance.
 */
export const cancelMyBooking = mutation({
  args: {
    jobId: v.id("jobs"),
    cancellationDeadline: v.number(),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // SECURITY: Validate deadline at mutation start using server timestamp
    const serverTime = Date.now();
    if (args.cancellationDeadline !== undefined && args.cancellationDeadline !== null) {
      if (serverTime > args.cancellationDeadline) {
        throw new ConvexError("Cancellation deadline passed");
      }
    }

    const instructor = await requireInstructorProfile(ctx);
    const job = await ctx.db.get("jobs", args.jobId);

    if (!job) throw new ConvexError("Job not found");
    if (job.status !== "filled") {
      throw new ConvexError("Job is not filled");
    }
    if (job.filledByInstructorId !== instructor._id) {
      throw new ConvexError("Not authorized to cancel this booking");
    }

    // Validate deadline against server-side computation (authoritative source)
    const computedDeadline = job.cancellationDeadlineHours !== undefined
      ? job.startTime - job.cancellationDeadlineHours * 3600000
      : undefined;

    if (computedDeadline !== undefined && serverTime > computedDeadline) {
      throw new ConvexError("Cancellation deadline passed");
    }

    // SECURITY: Re-validate deadline immediately before patch (TOCTOU protection)
    if (computedDeadline !== undefined && Date.now() > computedDeadline) {
      throw new ConvexError("Cancellation deadline passed");
    }

    await ctx.db.patch("jobs", job._id, {
      status: "cancelled",
      filledByInstructorId: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.core.cancelJobNotificationSchedules, {
      jobId: job._id,
      reason: "booking_cancelled",
    });

    const applications = await ctx.db
      .query("jobApplications")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    for (const application of applications) {
      if (application.instructorId === instructor._id && application.status === "accepted") {
        await ctx.db.patch("jobApplications", application._id, {
          status: "withdrawn",
          updatedAt: Date.now(),
        });
        break;
      }
    }

    await recomputeJobApplicationStats(ctx, job);

    const studio = await ctx.db.get("studioProfiles", job.studioId);
    if (studio) {
      await enqueueUserNotification(ctx, {
        recipientUserId: studio.userId,
        kind: "lesson_completed",
        title: "Booking cancelled",
        body: `${instructor.displayName} cancelled their booking for ${toDisplayLabel(job.sport)}.`,
        jobId: job._id,
      });
      await scheduleGoogleCalendarSyncForUser(ctx, studio.userId);
    }

    // Audit: Job cancelled by instructor
    await auditJobCancellation(ctx, {
      actor: { _id: instructor.userId, email: undefined, role: "instructor" },
      jobId: job._id,
      studioId: job.studioId,
      instructorId: instructor._id,
      cancelledBy: "instructor",
      success: true,
    });

    return { ok: true };
  },
});
