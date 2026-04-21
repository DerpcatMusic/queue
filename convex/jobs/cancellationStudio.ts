import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import {
  enqueueUserNotification,
  recomputeJobApplicationStats,
  requireStudioProfile,
  scheduleGoogleCalendarSyncForUser,
  toDisplayLabel,
} from "./_helpers";
import { internal } from "./cancellationShared";
import { auditJobCancellation } from "../lib/audit";

/**
 * cancelFilledJob: Cancel an open or filled job by studio.
 * 
 * AUDIT: Logs job cancellations for security and compliance.
 */
export const cancelFilledJob = mutation({
  args: {
    jobId: v.id("jobs"),
    reason: v.optional(v.string()),
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

    const studio = await requireStudioProfile(ctx);
    const job = await ctx.db.get("jobs", args.jobId);

    if (!job) throw new ConvexError("Job not found");
    if (job.studioId !== studio._id) {
      throw new ConvexError("Not authorized to cancel this job");
    }

    if (job.status === "open") {
      // SECURITY: Re-validate deadline immediately before patch (TOCTOU protection)
      if (args.cancellationDeadline !== undefined && args.cancellationDeadline !== null) {
        if (Date.now() > args.cancellationDeadline) {
          throw new ConvexError("Cancellation deadline passed");
        }
      }

      await ctx.db.patch("jobs", job._id, {
        status: "cancelled",
        closureReason: "studio_cancelled",
      });
      await ctx.scheduler.runAfter(0, internal.notifications.core.cancelJobNotificationSchedules, {
        jobId: job._id,
        reason: "studio_cancelled",
      });

      const applications = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();

      const pendingApplications = applications.filter((a: any) => a.status === "pending");
      for (const application of pendingApplications) {
        await ctx.db.patch("jobApplications", application._id, {
          status: "rejected",
          updatedAt: Date.now(),
        });
      }

      await recomputeJobApplicationStats(ctx, job);

      for (const application of pendingApplications) {
        const instructor = await ctx.db.get("instructorProfiles", application.instructorId);
        if (instructor) {
          await enqueueUserNotification(ctx, {
            recipientUserId: instructor.userId,
            kind: "application_rejected",
            title: "Application rejected",
            body: `The studio cancelled this ${toDisplayLabel(job.sport)} job.`,
            jobId: job._id,
            applicationId: application._id,
          });
        }
      }

      await scheduleGoogleCalendarSyncForUser(ctx, studio.userId);

      // Audit: Open job cancelled by studio (no instructor assigned yet)
      await auditJobCancellation(ctx, {
        actor: { _id: studio.userId, email: undefined, role: "studio" },
        jobId: job._id,
        studioId: studio._id,
        cancelledBy: "studio",
        reason: args.reason,
        success: true,
      });

      return { ok: true };
    }

    if (job.status !== "filled") {
      throw new ConvexError("Job is not filled");
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
      closureReason: "studio_cancelled",
    });
    await ctx.scheduler.runAfter(0, internal.notifications.core.cancelJobNotificationSchedules, {
      jobId: job._id,
      reason: "studio_cancelled",
    });

    const applications = await ctx.db
      .query("jobApplications")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    let acceptedInstructorProfile: any = null;
    let acceptedInstructorId: any = null;
    for (const application of applications) {
      if (application.status === "accepted") {
        await ctx.db.patch("jobApplications", application._id, {
          status: "rejected",
          updatedAt: Date.now(),
        });
        acceptedInstructorProfile = await ctx.db.get(
          "instructorProfiles",
          application.instructorId,
        );
        acceptedInstructorId = application.instructorId;
        break;
      }
    }

    await recomputeJobApplicationStats(ctx, job);

    if (acceptedInstructorProfile) {
      await enqueueUserNotification(ctx, {
        recipientUserId: acceptedInstructorProfile.userId,
        kind: "lesson_completed",
        title: "Booking cancelled",
        body: `Your booking for ${toDisplayLabel(job.sport)} was cancelled by the studio${args.reason ? `: ${args.reason}` : "."}`,
        jobId: job._id,
      });
      await scheduleGoogleCalendarSyncForUser(ctx, acceptedInstructorProfile.userId);
    }

    await scheduleGoogleCalendarSyncForUser(ctx, studio.userId);

    // Audit: Filled job cancelled by studio
    await auditJobCancellation(ctx, {
      actor: { _id: studio.userId, email: undefined, role: "studio" },
      jobId: job._id,
      studioId: studio._id,
      instructorId: acceptedInstructorId,
      cancelledBy: "studio",
      reason: args.reason,
      success: true,
    });

    return { ok: true };
  },
});
