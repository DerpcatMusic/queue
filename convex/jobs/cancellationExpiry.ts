import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import {
  DEFAULT_AUTO_EXPIRE_MINUTES,
  enqueueUserNotification,
  recomputeJobApplicationStats,
  scheduleGoogleCalendarSyncForUser,
  toDisplayLabel,
} from "./_helpers";
import { internal } from "./cancellationShared";

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
