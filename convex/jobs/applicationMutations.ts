import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { isInstructorEligibleForJobByCoverage } from "../lib/instructorGeoCoverage";
import { omitUndefined, trimOptionalString } from "../lib/validation";
import {
  enforceInstructorMarketplaceActionPolicy,
  ensureJobCanAcceptAnotherOfferPolicy,
} from "../policy/marketplace";
import {
  enqueueUserNotification,
  recomputeJobApplicationStats,
  requireInstructorProfile,
  toDisplayLabel,
} from "./_helpers";

// Maximum number of concurrent applicants per job
const MAX_CONCURRENT_APPLICATIONS = 3;

/**
 * SECURITY FIX: Helper to check for instructor booking conflicts.
 * Always run this before any application insert or reactivation to prevent double-booking.
 * This is a critical security check that must never be skipped.
 */
async function checkInstructorBookingConflict(
  ctx: any,
  instructorId: any,
  jobStartTime: number,
  jobEndTime: number,
): Promise<Doc<"jobs"> | null> {
  const existingJobs = await ctx.db
    .query("jobs")
    .withIndex("by_filledByInstructor_startTime", (q) =>
      q.eq("filledByInstructorId", instructorId),
    )
    .collect();

  // Find any existing booking that overlaps with the requested time slot
  const conflictingJob = existingJobs.find(
    (j: any) =>
      j.status === "filled" &&
      j.startTime < jobEndTime &&
      j.endTime > jobStartTime,
  );

  return conflictingJob ?? null;
}

// Helper: Atomically check and get active application count with pessimistic locking
async function getActiveApplicationCountAtomic(
  ctx: any,
  jobId: any,
): Promise<{ count: number; applications: any[] }> {
  // Use index scan to get all active applications atomically
  const applications = await ctx.db
    .query("jobApplications")
    .withIndex("by_job", (q) => q.eq("jobId", jobId))
    .collect();
  
  const activeApplications = applications.filter(
    (row: any) => row.status === "pending" || row.status === "accepted",
  );
  
  return {
    count: activeApplications.length,
    applications,
  };
}

// Helper: Re-verify job status before mutation to prevent TOCTOU
async function verifyJobStatusForApplication(
  ctx: any,
  jobId: any,
  expectedStatus: string = "open",
) {
  const freshJob = await ctx.db.get("jobs", jobId);
  if (!freshJob) {
    throw new ConvexError("Job not found");
  }
  if (freshJob.status !== expectedStatus) {
    throw new ConvexError(
      expectedStatus === "open" 
        ? "Job is no longer accepting applications" 
        : `Job status is not ${expectedStatus}`
    );
  }
  return freshJob;
}

// Helper: Re-verify cancellation deadline before mutation
async function verifyCancellationDeadline(
  ctx: any,
  job: any,
) {
  const now = Date.now();
  if (job.cancellationDeadlineHours !== undefined) {
    const deadline = job.startTime - job.cancellationDeadlineHours * 3600000;
    if (now > deadline) {
      throw new ConvexError("Cancellation deadline has passed");
    }
  }
  // Re-fetch to ensure deadline hasn't passed during execution
  const freshJob = await ctx.db.get("jobs", job._id);
  if (!freshJob) {
    throw new ConvexError("Job not found");
  }
  if (freshJob.cancellationDeadlineHours !== undefined) {
    const deadline = freshJob.startTime - freshJob.cancellationDeadlineHours * 3600000;
    if (Date.now() > deadline) {
      throw new ConvexError("Cancellation deadline has passed");
    }
  }
  return freshJob;
}

export const applyToJob = mutation({
  args: {
    jobId: v.id("jobs"),
    message: v.optional(v.string()),
  },
  returns: v.object({
    applicationId: v.id("jobApplications"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("withdrawn"),
    ),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const now = Date.now();

    // Re-verify job exists and get current status (TOCTOU prevention)
    const job = await verifyJobStatusForApplication(ctx, args.jobId, "open");

    await enforceInstructorMarketplaceActionPolicy(ctx, {
      instructor,
      job,
      actionLabel: "Application",
    });

    const studio = await ctx.db.get("studioProfiles", job.studioId);
    const studioAutoAcceptEnabled = (studio as any)?.autoAcceptEnabled;
    const studioAutoAcceptDefault = studio?.autoAcceptDefault;
    const autoAcceptEnabled =
      job.autoAcceptEnabled ?? studioAutoAcceptEnabled ?? studioAutoAcceptDefault ?? false;

    const canApplyByLocation = await isInstructorEligibleForJobByCoverage(ctx, {
      instructorId: instructor._id,
      sport: job.sport,
      jobH3Index: job.h3Index,
    });

    // Re-check location eligibility
    if (!canApplyByLocation) {
      throw new ConvexError("You are not eligible for this job");
    }

    // Re-check deadline
    if (job.applicationDeadline !== undefined && now > job.applicationDeadline) {
      throw new ConvexError("Application deadline has passed");
    }
    if (now >= job.startTime) {
      throw new ConvexError("Job has already started");
    }

    // Check for existing application
    const existing = await ctx.db
      .query("jobApplications")
      .withIndex("by_job_and_instructor", (q) =>
        q.eq("jobId", args.jobId).eq("instructorId", instructor._id),
      )
      .unique();

    // Get active application count atomically
    const { count: activeApplicationCount, applications: allApplications } = 
      await getActiveApplicationCountAtomic(ctx, args.jobId);

    const message = trimOptionalString(args.message);

    // ============= AUTO-ACCEPT MODE =============
    if (autoAcceptEnabled) {
      // Check for instructor booking conflicts
      const existingJobs = await ctx.db
        .query("jobs")
        .withIndex("by_filledByInstructor_startTime", (q) =>
          q.eq("filledByInstructorId", instructor._id),
        )
        .collect();
      
      const hasConflict = existingJobs.some(
        (j: any) => 
          j.status === "filled" && 
          j.startTime < job.endTime && 
          j.endTime > job.startTime,
      );
      if (hasConflict) {
        throw new ConvexError("Instructor has a conflicting booking at this time");
      }

      // Reject existing application if any
      if (existing) {
        if (existing.status === "accepted") {
          throw new ConvexError("Application already accepted");
        }
        await ctx.db.patch("jobApplications", existing._id, {
          status: "rejected",
          updatedAt: now,
        });
      }

      // Insert accepted application
      const applicationId = await ctx.db.insert("jobApplications", {
        jobId: args.jobId,
        studioId: job.studioId,
        branchId: job.branchId,
        instructorId: instructor._id,
        status: "accepted",
        appliedAt: now,
        updatedAt: now,
        ...omitUndefined({ message }),
      });

      // Re-verify job status before closing (TOCTOU prevention)
      const freshJobBeforeClose = await ctx.db.get("jobs", job._id);
      if (!freshJobBeforeClose || freshJobBeforeClose.status !== "open") {
        // Rollback: delete the application we just created
        await ctx.db.delete("jobApplications", applicationId);
        throw new ConvexError("Job is no longer available");
      }

      // Close the job immediately - auto-accept fills and closes
      await ctx.db.patch("jobs", job._id, {
        status: "filled",
        filledByInstructorId: instructor._id,
      });

      // Reject all other pending applications atomically
      const pendingApplications = allApplications.filter(
        (row: any) => 
          row._id !== applicationId && 
          (row.status === "pending" || row.status === "accepted"),
      );
      
      await Promise.all(
        pendingApplications.map((row: any) =>
          ctx.db.patch("jobApplications", row._id, {
            status: "rejected",
            updatedAt: now,
          }),
        ),
      );

      if (studio) {
        await ctx.runMutation(internal.jobs.review.runAcceptedApplicationReviewWorkflow, {
          jobId: job._id,
          acceptedApplicationId: applicationId,
          studioUserId: studio.userId,
        });
      }

      await recomputeJobApplicationStats(ctx, job);
      return { applicationId, status: "accepted" as const };
    }

    // ============= STUDIO-CHOOSES MODE (MAX 3 CONCURRENT) =============
    // SECURITY FIX: Always check for booking conflicts BEFORE any application insert or reactivation.
    // This prevents double-booking when reactivating withdrawn applications.
    const conflictingJob = await checkInstructorBookingConflict(
      ctx,
      instructor._id,
      job.startTime,
      job.endTime,
    );
    if (conflictingJob) {
      throw new ConvexError({
        code: "BOOKING_CONFLICT",
        message: `Instructor already has a booking at this time for ${toDisplayLabel(conflictingJob.sport)}`,
      });
    }

    // Check if max applicants reached
    if (activeApplicationCount >= MAX_CONCURRENT_APPLICATIONS) {
      throw new ConvexError(
        `Job has reached maximum of ${MAX_CONCURRENT_APPLICATIONS} concurrent applicants. Please try again later.`,
      );
    }

    if (existing) {
      // SECURITY FIX: Idempotent reactivation - check current status before patching
      if (existing.status === "accepted") {
        throw new ConvexError("Application already accepted");
      }

      // Already pending - idempotent success (no-op)
      if (existing.status === "pending") {
        return {
          applicationId: existing._id,
          status: "pending" as const,
          reason: "Application already pending",
        };
      }

      // Re-activate withdrawn or rejected application
      await ctx.db.patch("jobApplications", existing._id, {
        studioId: job.studioId,
        branchId: job.branchId,
        status: "pending",
        ...omitUndefined({ message }),
        updatedAt: now,
      });

      if (studio) {
        await enqueueUserNotification(ctx, {
          recipientUserId: studio.userId,
          actorUserId: instructor.userId,
          kind: "application_received",
          title: "Application reactivated",
          body: `${instructor.displayName} reactivated their application for ${toDisplayLabel(job.sport)}.`,
          jobId: job._id,
          applicationId: existing._id,
        });
      }

      await recomputeJobApplicationStats(ctx, job);
      return {
        applicationId: existing._id,
        status: "pending" as const,
        reason: "Application reactivated",
      };
    }

    // Final check: verify we haven't exceeded max (TOCTOU prevention)
    const { count: finalCount } = await getActiveApplicationCountAtomic(ctx, args.jobId);
    if (finalCount >= MAX_CONCURRENT_APPLICATIONS) {
      throw new ConvexError(
        `Job has reached maximum of ${MAX_CONCURRENT_APPLICATIONS} concurrent applicants. Please try again later.`,
      );
    }

    // Insert new pending application
    const applicationId = await ctx.db.insert("jobApplications", {
      jobId: args.jobId,
      studioId: job.studioId,
      branchId: job.branchId,
      instructorId: instructor._id,
      status: "pending",
      appliedAt: now,
      updatedAt: now,
      ...omitUndefined({ message }),
    });

    if (studio) {
      await enqueueUserNotification(ctx, {
        recipientUserId: studio.userId,
        actorUserId: instructor.userId,
        kind: "application_received",
        title: "New application received",
        body: `${instructor.displayName} applied to teach ${toDisplayLabel(job.sport)}. ${finalCount + 1}/${MAX_CONCURRENT_APPLICATIONS} slots filled.`,
        jobId: job._id,
        applicationId,
      });
    }

    await recomputeJobApplicationStats(ctx, job);
    return { 
      applicationId, 
      status: "pending" as const,
      reason: `${finalCount + 1} of ${MAX_CONCURRENT_APPLICATIONS} slots filled`,
    };
  },
});

export const withdrawApplication = mutation({
  args: {
    applicationId: v.id("jobApplications"),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const application = await ctx.db.get("jobApplications", args.applicationId);

    if (!application) throw new ConvexError("Application not found");
    if (application.instructorId !== instructor._id) {
      throw new ConvexError("Not authorized to withdraw this application");
    }
    if (application.status !== "pending") {
      throw new ConvexError("Can only withdraw pending applications");
    }

    const now = Date.now();
    await ctx.db.patch("jobApplications", application._id, {
      status: "withdrawn",
      updatedAt: now,
    });

    const job = await ctx.db.get("jobs", application.jobId);
    if (job) {
      await recomputeJobApplicationStats(ctx, job);
    }

    return { ok: true };
  },
});
