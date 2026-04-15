import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation, internalMutation } from "../_generated/server";
import { loadInstructorComplianceSnapshot } from "../lib/instructorCompliance";
import {
  requireStudioProfile,
  assertInstructorCanPerformJobActions,
  recomputeJobApplicationStats,
  APPLICATION_STATUS_SET,
  enqueueUserNotification,
  toDisplayLabel,
  scheduleGoogleCalendarSyncForUser,
} from "./_helpers";

export const reviewApplication = mutation({
  args: {
    applicationId: v.id("jobApplications"),
    status: v.union(v.literal("accepted"), v.literal("rejected")),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const studio = await requireStudioProfile(ctx);
    const application = await ctx.db.get("jobApplications", args.applicationId);
    if (!application) throw new ConvexError("Application not found");

    if (application.status === args.status) {
      return { ok: true };
    }
    if (application.status === "accepted" && args.status === "rejected") {
      throw new ConvexError("Accepted application cannot be rejected");
    }

    if (!APPLICATION_STATUS_SET.has(args.status)) {
      throw new ConvexError("Invalid application status");
    }

    const job = await ctx.db.get("jobs", application.jobId);
    if (!job) throw new ConvexError("Job not found");
    if (job.studioId !== studio._id) {
      throw new ConvexError("Not authorized for this job");
    }

    if (args.status === "accepted") {
      const instructorProfile = await ctx.db.get("instructorProfiles", application.instructorId);
      if (!instructorProfile) {
        throw new ConvexError("Instructor profile not found");
      }
      const now = Date.now();
      const compliance = await loadInstructorComplianceSnapshot(ctx, instructorProfile._id, now);
      assertInstructorCanPerformJobActions({
        profile: instructorProfile,
        compliance,
        sport: job.sport,
        requiredCapabilityTags: job.requiredCapabilityTags,
      });
      if (job.status !== "open") {
        throw new ConvexError("Job is not open");
      }
      if (now >= job.endTime) {
        throw new ConvexError("Job already ended");
      }
      const existingJobs = await ctx.db
        .query("jobs")
        .withIndex("by_filledByInstructor_startTime", (q) =>
          q.eq("filledByInstructorId", application.instructorId),
        )
        .collect();
      const hasConflict = existingJobs.some(
        (j: any) => j.status === "filled" && j.startTime < job.endTime && j.endTime > job.startTime,
      );
      if (hasConflict) {
        throw new ConvexError("Instructor has a conflicting booking at this time");
      }
      await ctx.db.patch("jobs", job._id, {
        status: "filled",
        filledByInstructorId: application.instructorId,
      });

      const competingApplications = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();

      for (const row of competingApplications) {
        await ctx.db.patch("jobApplications", row._id, {
          studioId: job.studioId,
          branchId: job.branchId,
          status: row._id === application._id ? "accepted" : "rejected",
          updatedAt: Date.now(),
        });
      }

      await ctx.runMutation(internal.jobs.review.runAcceptedApplicationReviewWorkflow, {
        jobId: job._id,
        acceptedApplicationId: application._id,
        studioUserId: studio.userId,
      });

      await recomputeJobApplicationStats(ctx, job);
    } else {
      await ctx.db.patch("jobApplications", application._id, {
        studioId: job.studioId,
        branchId: job.branchId,
        status: "rejected",
        updatedAt: Date.now(),
      });

      await ctx.runMutation(internal.jobs.review.runRejectedApplicationReviewWorkflow, {
        jobId: job._id,
        applicationId: application._id,
        studioUserId: studio.userId,
      });

      await recomputeJobApplicationStats(ctx, job);
    }

    return { ok: true };
  },
});

export const runAcceptedApplicationReviewWorkflow = internalMutation({
  args: {
    jobId: v.id("jobs"),
    acceptedApplicationId: v.id("jobApplications"),
    studioUserId: v.id("users"),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const [job, acceptedApplication] = await Promise.all([
      ctx.db.get("jobs", args.jobId),
      ctx.db.get("jobApplications", args.acceptedApplicationId),
    ]);
    if (!job || !acceptedApplication) {
      return { ok: false };
    }
    if (acceptedApplication.jobId !== job._id) {
      return { ok: false };
    }
    if (
      job.status !== "filled" ||
      job.filledByInstructorId !== acceptedApplication.instructorId ||
      acceptedApplication.status !== "accepted"
    ) {
      return { ok: false };
    }

    const competingApplications = await ctx.db
      .query("jobApplications")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    const uniqueInstructorIds = [
      ...new Set(competingApplications.map((row: any) => row.instructorId)),
    ];
    const profiles = await Promise.all(
      uniqueInstructorIds.map((instructorId: any) =>
        ctx.db.get("instructorProfiles", instructorId),
      ),
    );
    const profileById = new Map<string, any>();
    for (let i = 0; i < uniqueInstructorIds.length; i += 1) {
      const instructorId = uniqueInstructorIds[i];
      const profile = profiles[i];
      if (profile) {
        profileById.set(String(instructorId), profile);
      }
    }

    for (const row of competingApplications) {
      const profile = profileById.get(String(row.instructorId));
      if (!profile) continue;

      const isAccepted = row._id === acceptedApplication._id;
      await enqueueUserNotification(ctx, {
        recipientUserId: profile.userId,
        actorUserId: args.studioUserId,
        kind: isAccepted ? "application_accepted" : "application_rejected",
        title: isAccepted ? "Application accepted" : "Application rejected",
        body: isAccepted
          ? `You were assigned to teach ${toDisplayLabel(job.sport)}.`
          : `Another instructor was selected for ${toDisplayLabel(job.sport)}.`,
        jobId: job._id,
        applicationId: row._id,
      });
    }

    const now = Date.now();
    await ctx.scheduler.runAfter(
      Math.max(job.startTime - now, 0),
      internal.jobs.lessonCompletion.emitLessonLifecycleEvent,
      {
        jobId: job._id,
        instructorId: acceptedApplication.instructorId,
        event: "lesson_started",
      },
    );
    await ctx.scheduler.runAfter(
      Math.max(job.endTime - now, 0),
      internal.jobs.lessonCompletion.emitLessonLifecycleEvent,
      {
        jobId: job._id,
        instructorId: acceptedApplication.instructorId,
        event: "lesson_completed",
      },
    );
    await ctx.scheduler.runAfter(0, internal.notifications.core.syncLessonReminderSchedulesForJob, {
      jobId: job._id,
    });
    const acceptedInstructorProfile = profileById.get(String(acceptedApplication.instructorId));
    await Promise.all([
      scheduleGoogleCalendarSyncForUser(ctx, args.studioUserId),
      scheduleGoogleCalendarSyncForUser(ctx, acceptedInstructorProfile?.userId),
    ]);

    return { ok: true };
  },
});

export const runRejectedApplicationReviewWorkflow = internalMutation({
  args: {
    jobId: v.id("jobs"),
    applicationId: v.id("jobApplications"),
    studioUserId: v.id("users"),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const [job, application] = await Promise.all([
      ctx.db.get("jobs", args.jobId),
      ctx.db.get("jobApplications", args.applicationId),
    ]);
    if (!job || !application) {
      return { ok: false };
    }
    if (application.jobId !== job._id || application.status !== "rejected") {
      return { ok: false };
    }

    const profile = await ctx.db.get("instructorProfiles", application.instructorId);
    if (!profile) {
      return { ok: false };
    }

    await enqueueUserNotification(ctx, {
      recipientUserId: profile.userId,
      actorUserId: args.studioUserId,
      kind: "application_rejected",
      title: "Application rejected",
      body: `The studio passed on your ${toDisplayLabel(job.sport)} application.`,
      jobId: job._id,
      applicationId: application._id,
    });

    return { ok: true };
  },
});
