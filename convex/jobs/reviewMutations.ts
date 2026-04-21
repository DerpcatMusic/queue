import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { ensureJobBillingPolicy, transitionJobSettlementPolicy } from "../policy/billing";
import { getInstructorAssignmentTrustPolicy } from "../policy/compliance";
import { enforceInstructorMarketplaceActionPolicy } from "../policy/marketplace";
import {
  APPLICATION_STATUS_SET,
  recomputeJobApplicationStats,
  requireStudioProfile,
} from "./_helpers";
import { auditApplicationReview } from "../lib/audit";

// Helper: Re-verify job status before mutation to prevent TOCTOU
async function verifyJobStatusForAcceptance(
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

/**
 * reviewApplication: Accept or reject a job application.
 * 
 * AUDIT: Logs application acceptances and rejections for security and compliance.
 */
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
    if (!application) {
      throw new ConvexError("Application not found");
    }

    if (application.status === args.status) {
      return { ok: true };
    }
    if (application.status === "accepted" && args.status === "rejected") {
      throw new ConvexError("Accepted application cannot be rejected");
    }

    if (!APPLICATION_STATUS_SET.has(args.status)) {
      throw new ConvexError("Invalid application status");
    }

    // Get fresh job with TOCTOU prevention
    const job = await verifyJobStatusForAcceptance(ctx, application.jobId, "open");
    
    if (job.studioId !== studio._id) {
      throw new ConvexError("Not authorized for this job");
    }

    if (args.status === "accepted") {
      const instructorProfile = await ctx.db.get("instructorProfiles", application.instructorId);
      if (!instructorProfile) {
        throw new ConvexError("Instructor profile not found");
      }
      const now = Date.now();
      await enforceInstructorMarketplaceActionPolicy(ctx, {
        instructor: instructorProfile,
        job,
        actionLabel: "Accept",
      });
      const trustSnapshot = await getInstructorAssignmentTrustPolicy(
        ctx,
        instructorProfile._id,
        now,
      );
      
      if (now >= job.endTime) {
        await auditApplicationReview(ctx, {
          actor: { _id: studio.userId, email: undefined, role: "studio" },
          applicationId: args.applicationId,
          jobId: job._id,
          studioId: studio._id,
          instructorId: application.instructorId,
          status: "accepted",
          success: false,
          errorMessage: "Job already ended",
        });
        throw new ConvexError("Job already ended");
      }
      
      // Check for instructor conflicts
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
        await auditApplicationReview(ctx, {
          actor: { _id: studio.userId, email: undefined, role: "studio" },
          applicationId: args.applicationId,
          jobId: job._id,
          studioId: studio._id,
          instructorId: application.instructorId,
          status: "accepted",
          success: false,
          errorMessage: "Instructor has a conflicting booking at this time",
        });
        throw new ConvexError("Instructor has a conflicting booking at this time");
      }
      
      // CRITICAL: Re-verify job status immediately before patch (TOCTOU prevention)
      const freshJobBeforePatch = await ctx.db.get("jobs", job._id);
      if (!freshJobBeforePatch || freshJobBeforePatch.status !== "open") {
        await auditApplicationReview(ctx, {
          actor: { _id: studio.userId, email: undefined, role: "studio" },
          applicationId: args.applicationId,
          jobId: job._id,
          studioId: studio._id,
          instructorId: application.instructorId,
          status: "accepted",
          success: false,
          errorMessage: "Job was filled by another request. Please refresh and try again.",
        });
        throw new ConvexError("Job was filled by another request. Please refresh and try again.");
      }

      // Patch job to filled
      await ctx.db.patch("jobs", job._id, {
        status: "filled",
        filledByInstructorId: application.instructorId,
      });
      
      const existingAssignment = await ctx.db
        .query("jobAssignments")
        .withIndex("by_source_application", (q) => q.eq("sourceApplicationId", application._id))
        .unique();
      const assignmentId =
        existingAssignment?._id ??
        (await ctx.db.insert("jobAssignments", {
          jobId: job._id,
          studioId: job.studioId,
          branchId: job.branchId,
          instructorId: application.instructorId,
          instructorUserId: instructorProfile.userId,
          sourceApplicationId: application._id,
          slotNumber: 1,
          status: "accepted",
          trustSnapshot,
          acceptedAt: now,
          updatedAt: now,
        }));
      await ensureJobBillingPolicy(ctx, job);
      await transitionJobSettlementPolicy(ctx, {
        job,
        instructorId: application.instructorId,
        instructorUserId: instructorProfile.userId,
        assignmentId,
        paymentStatus: "payment_pending",
        lessonStatus: "scheduled",
        settlementStatus: "pending",
      });

      // Reject all other applications atomically
      const competingApplications = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();

      await Promise.all(
        competingApplications.map((row) =>
          ctx.db.patch("jobApplications", row._id, {
            studioId: job.studioId,
            branchId: job.branchId,
            status: row._id === application._id ? "accepted" : "rejected",
            updatedAt: Date.now(),
          }),
        ),
      );

      await ctx.runMutation(internal.jobs.review.runAcceptedApplicationReviewWorkflow, {
        jobId: job._id,
        acceptedApplicationId: application._id,
        studioUserId: studio.userId,
      });

      await recomputeJobApplicationStats(ctx, job);

      // Audit successful acceptance
      await auditApplicationReview(ctx, {
        actor: { _id: studio.userId, email: undefined, role: "studio" },
        applicationId: args.applicationId,
        jobId: job._id,
        studioId: studio._id,
        instructorId: application.instructorId,
        status: "accepted",
        success: true,
      });
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

      // Audit successful rejection
      await auditApplicationReview(ctx, {
        actor: { _id: studio.userId, email: undefined, role: "studio" },
        applicationId: args.applicationId,
        jobId: job._id,
        studioId: studio._id,
        instructorId: application.instructorId,
        status: "rejected",
        success: true,
      });
    }

    return { ok: true };
  },
});
