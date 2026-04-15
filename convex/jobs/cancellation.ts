import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, mutation } from "../_generated/server";
import {
  requireInstructorProfile,
  requireStudioProfile,
  recomputeJobApplicationStats,
  enqueueUserNotification,
  toDisplayLabel,
  scheduleGoogleCalendarSyncForUser,
  DEFAULT_AUTO_EXPIRE_MINUTES,
} from "./_helpers";

export const cancelMyBooking = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const job = await ctx.db.get("jobs", args.jobId);

    if (!job) throw new ConvexError("Job not found");
    if (job.status !== "filled") {
      throw new ConvexError("Job is not filled");
    }
    if (job.filledByInstructorId !== instructor._id) {
      throw new ConvexError("Not authorized to cancel this booking");
    }

    if (job.cancellationDeadlineHours !== undefined) {
      const deadline = job.startTime - job.cancellationDeadlineHours * 3600000;
      if (Date.now() > deadline) {
        throw new ConvexError("Cancellation deadline passed");
      }
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
      // Google Calendar: real-time sync via server-side action
      await scheduleGoogleCalendarSyncForUser(ctx, studio.userId);
      // Apple Calendar: deleted on next app open when syncEvents recomputes
      // without this cancelled job (buildSyncEvents filters status === "cancelled")
    }

    return { ok: true };
  },
});

export const cancelFilledJob = mutation({
  args: {
    jobId: v.id("jobs"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const studio = await requireStudioProfile(ctx);
    const job = await ctx.db.get("jobs", args.jobId);

    if (!job) throw new ConvexError("Job not found");
    if (job.studioId !== studio._id) {
      throw new ConvexError("Not authorized to cancel this job");
    }

    // Handle open jobs - cancel directly without cancellation deadline check
    if (job.status === "open") {
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
      return { ok: true };
    }

    // Handle filled jobs - require cancellation deadline check
    if (job.status !== "filled") {
      throw new ConvexError("Job is not filled");
    }

    if (job.cancellationDeadlineHours !== undefined) {
      const deadline = job.startTime - job.cancellationDeadlineHours * 3600000;
      if (Date.now() > deadline) {
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

    let acceptedInstructorProfile: any = null;
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
    // Google Calendar: real-time sync via server-side action (above)
    // Apple Calendar: deleted on next app open when syncEvents recomputes
    // without this cancelled job (buildSyncEvents filters status === "cancelled")

    return { ok: true };
  },
});

export const closeJobIfStillOpen = internalMutation({
  args: {
    jobId: v.id("jobs"),
  },
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) {
      return { updated: false };
    }
    if (job.status !== "open") {
      return { updated: false };
    }
    if (Date.now() < job.endTime) {
      return { updated: false };
    }

    await ctx.db.patch("jobs", job._id, { status: "cancelled" });
    await ctx.scheduler.runAfter(0, internal.notifications.core.cancelJobNotificationSchedules, {
      jobId: job._id,
      reason: "job_closed",
    });
    const studio = await ctx.db.get("studioProfiles", job.studioId);
    await scheduleGoogleCalendarSyncForUser(ctx, studio?.userId);
    return { updated: true };
  },
});

export const autoExpireUnfilledJob = internalMutation({
  args: {
    jobId: v.id("jobs"),
  },
  returns: v.object({ expired: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) {
      return { expired: false };
    }
    if (job.status !== "open") {
      return { expired: false };
    }

    const studio = await ctx.db.get("studioProfiles", job.studioId);
    const expireMinutes =
      job.expiryOverrideMinutes ?? studio?.autoExpireMinutesBefore ?? DEFAULT_AUTO_EXPIRE_MINUTES;
    const expireCutoff = job.startTime - expireMinutes * 60 * 1000;

    if (Date.now() < expireCutoff) {
      return { expired: false };
    }

    await ctx.db.patch("jobs", job._id, {
      status: "cancelled",
      closureReason: "expired",
    });
    await ctx.scheduler.runAfter(0, internal.notifications.core.cancelJobNotificationSchedules, {
      jobId: job._id,
      reason: "job_expired",
    });
    await scheduleGoogleCalendarSyncForUser(ctx, studio?.userId);

    const applications = await ctx.db
      .query("jobApplications")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    for (const application of applications) {
      if (application.status === "pending") {
        await ctx.db.patch("jobApplications", application._id, {
          status: "rejected",
          updatedAt: Date.now(),
        });
      }
    }

    await recomputeJobApplicationStats(ctx, job);

    for (const application of applications) {
      const instructor = await ctx.db.get("instructorProfiles", application.instructorId);
      if (instructor) {
        await enqueueUserNotification(ctx, {
          recipientUserId: instructor.userId,
          kind: "lesson_completed",
          title: "Job expired",
          body: `This job expired before an instructor was confirmed. Your application was not accepted.`,
          jobId: job._id,
        });
      }
    }

    if (studio) {
      await enqueueUserNotification(ctx, {
        recipientUserId: studio.userId,
        kind: "lesson_completed",
        title: "Job expired",
        body: `Your ${toDisplayLabel(job.sport)} job was not filled and has been auto-cancelled.`,
        jobId: job._id,
      });
    }

    return { expired: true };
  },
});

export const cleanupCancelledJobs = internalMutation({
  args: {
    /** Minimum age in milliseconds before a cancelled job is deleted (default: 7 days) */
    minAgeMs: v.optional(v.number()),
    /** Maximum number of jobs to delete in one run to avoid timeouts (default: 100) */
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deletedJobs: v.number(),
    deletedApplications: v.number(),
  }),
  handler: async (ctx, args) => {
    const minAgeMs = args.minAgeMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days default
    const batchSize = args.batchSize ?? 100;
    const cutoffTime = Date.now() - minAgeMs;

    // Find cancelled jobs older than cutoff
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

    // Delete associated job applications first (foreign key constraint)
    for (const jobId of jobIds) {
      const applications = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", jobId))
        .collect();

      for (const application of applications) {
        await ctx.db.delete(application._id);
        deletedApplications++;
      }

      // Delete the job itself
      await ctx.db.delete(jobId);
    }

    return {
      deletedJobs: cancelledJobs.length,
      deletedApplications,
    };
  },
});
