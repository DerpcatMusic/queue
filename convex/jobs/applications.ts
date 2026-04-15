import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { query, mutation } from "../_generated/server";
import { isInstructorEligibleForJobByCoverage } from "../lib/instructorGeoCoverage";
import { loadInstructorComplianceSnapshot } from "../lib/instructorCompliance";
import {
  loadLatestPaymentDetailsByJobId,
  requireInstructorProfile,
  assertInstructorCanPerformJobActions,
  recomputeJobApplicationStats,
  enqueueUserNotification,
  getUniqueIdsInOrder,
  isPresent,
  toDisplayLabel,
} from "./_helpers";
import { omitUndefined, trimOptionalString } from "../lib/validation";

export const getMyApplications = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      applicationId: v.id("jobApplications"),
      jobId: v.id("jobs"),
      instructorId: v.id("instructorProfiles"),
      studioId: v.id("studioProfiles"),
      branchId: v.id("studioBranches"),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("rejected"),
        v.literal("withdrawn"),
      ),
      appliedAt: v.number(),
      message: v.optional(v.string()),
      studioName: v.string(),
      branchName: v.string(),
      studioImageUrl: v.optional(v.string()),
      sport: v.string(),
      startTime: v.number(),
      endTime: v.number(),
      timeZone: v.optional(v.string()),
      pay: v.number(),
      note: v.optional(v.string()),
      branchAddress: v.optional(v.string()),
      paymentDetails: v.optional(
        v.object({
          status: v.string(),
          payoutStatus: v.optional(v.string()),
          externalInvoiceUrl: v.optional(v.string()),
        }),
      ),
      jobStatus: v.union(
        v.literal("open"),
        v.literal("filled"),
        v.literal("cancelled"),
        v.literal("completed"),
      ),
      closureReason: v.optional(
        v.union(v.literal("expired"), v.literal("studio_cancelled"), v.literal("filled")),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);

    const rawLimit = args.limit ?? 100;
    const limit = Math.min(rawLimit, 250);

    const applications = await ctx.db
      .query("jobApplications")
      .withIndex("by_instructor_appliedAt", (q) => q.eq("instructorId", instructor._id))
      .order("desc")
      .take(limit);

    const applicationJobIds = getUniqueIdsInOrder(
      applications.map((application: any) => application.jobId),
    );
    const jobs = await Promise.all(
      applicationJobIds.map((jobId: any) => ctx.db.get("jobs", jobId)),
    );
    const jobById = new Map<string, any>();
    for (let index = 0; index < applicationJobIds.length; index += 1) {
      const job = jobs[index];
      if (job) {
        jobById.set(String(applicationJobIds[index]), job);
      }
    }

    const studioIds = [...new Set(jobs.filter(isPresent).map((job: any) => job.studioId))];
    const branchIds = [...new Set(jobs.filter(isPresent).map((job: any) => job.branchId))];
    const studios = await Promise.all(
      studioIds.map((studioId: any) => ctx.db.get("studioProfiles", studioId)),
    );
    const branches = await Promise.all(
      branchIds.map((branchId: any) => ctx.db.get("studioBranches", branchId)),
    );
    const studioImageUrls = await Promise.all(
      studios.map((studio: any) =>
        studio?.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
      ),
    );
    const studioById = new Map<string, any>();
    const branchById = new Map<string, any>();
    const studioImageUrlById = new Map<string, string>();
    for (let i = 0; i < studioIds.length; i += 1) {
      const studioId = studioIds[i];
      const studio = studios[i];
      if (studio) {
        studioById.set(String(studioId), studio);
      }
      const studioImageUrl = studioImageUrls[i];
      if (studioImageUrl) {
        studioImageUrlById.set(String(studioId), studioImageUrl);
      }
    }
    for (let i = 0; i < branchIds.length; i += 1) {
      const branchId = branchIds[i];
      const branch = branches[i];
      if (branch) {
        branchById.set(String(branchId), branch);
      }
    }

    const paymentDetailsByJobId = await loadLatestPaymentDetailsByJobId(ctx, {
      jobIds: applicationJobIds
        .map((jobId: any) => jobById.get(String(jobId)))
        .filter((job: any): job is any =>
          Boolean(job && (job.status === "completed" || job.status === "filled")),
        )
        .map((job: any) => job._id),
      instructorUserId: instructor.userId,
    });

    const rows = [];
    for (const application of applications) {
      const job = jobById.get(String(application.jobId));
      if (!job) continue;
      const studio = studioById.get(String(job.studioId));
      const branch = branchById.get(String(job.branchId));

      rows.push({
        applicationId: application._id,
        jobId: application.jobId,
        instructorId: application.instructorId,
        studioId: job.studioId,
        branchId: job.branchId,
        status: application.status,
        appliedAt: application.appliedAt,
        studioName: studio?.studioName ?? "Unknown studio",
        branchName: job.branchNameSnapshot ?? branch?.name ?? "Main branch",
        sport: job.sport,
        startTime: job.startTime,
        endTime: job.endTime,
        pay: job.pay,
        jobStatus: job.status,
        ...omitUndefined({
          message: application.message,
          branchAddress: job.branchAddressSnapshot ?? branch?.address,
          studioImageUrl: studioImageUrlById.get(String(job.studioId)),
          timeZone: job.timeZone,
          note: job.note,
          paymentDetails: paymentDetailsByJobId.get(String(job._id)),
          closureReason: job.closureReason,
        }),
      });
    }

    return rows;
  },
});

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
  }),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);

    const job = await ctx.db.get("jobs", args.jobId);

    if (!job) throw new ConvexError("Job not found");
    const now = Date.now();
    const compliance = await loadInstructorComplianceSnapshot(ctx, instructor._id, now);
    assertInstructorCanPerformJobActions({
      profile: instructor,
      compliance,
      sport: job.sport,
      requiredCapabilityTags: job.requiredCapabilityTags,
    });

    const studio = await ctx.db.get("studioProfiles", job.studioId);
    const studioAutoAcceptEnabled = (studio as any)?.autoAcceptEnabled;
    const studioAutoAcceptDefault = studio?.autoAcceptDefault;
    const autoAcceptEnabled =
      job.autoAcceptEnabled ?? studioAutoAcceptEnabled ?? studioAutoAcceptDefault ?? false;

    // Check H3 proximity instead of zone/boundary eligibility
    const canApplyByLocation = await isInstructorEligibleForJobByCoverage(ctx, {
      instructorId: instructor._id,
      sport: job.sport,
      jobH3Index: job.h3Index,
    });

    if (!autoAcceptEnabled) {
      if (job.status !== "open") throw new ConvexError("Job is not open");
      if (job.applicationDeadline !== undefined && now > job.applicationDeadline) {
        throw new ConvexError("Application deadline has passed");
      }
      if (now >= job.startTime) {
        throw new ConvexError("Job has already started");
      }
      if (!canApplyByLocation) {
        throw new ConvexError("You are not eligible for this job");
      }

      const existing = await ctx.db
        .query("jobApplications")
        .withIndex("by_job_and_instructor", (q) =>
          q.eq("jobId", args.jobId).eq("instructorId", instructor._id),
        )
        .unique();

      const message = trimOptionalString(args.message);

      if (existing) {
        if (existing.status === "accepted") {
          throw new ConvexError("Application already accepted");
        }

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
            title: "New application received",
            body: `${instructor.displayName} applied to teach ${toDisplayLabel(job.sport)}.`,
            jobId: job._id,
            applicationId: existing._id,
          });
        }

        await recomputeJobApplicationStats(ctx, job);
        return { applicationId: existing._id, status: "pending" as const };
      }

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
          body: `${instructor.displayName} applied to teach ${toDisplayLabel(job.sport)}.`,
          jobId: job._id,
          applicationId,
        });
      }

      await recomputeJobApplicationStats(ctx, job);
      return { applicationId, status: "pending" as const };
    }

    const existing = await ctx.db
      .query("jobApplications")
      .withIndex("by_job_and_instructor", (q) =>
        q.eq("jobId", args.jobId).eq("instructorId", instructor._id),
      )
      .unique();

    if (job.status !== "open") {
      const applicationId = await ctx.db.insert("jobApplications", {
        jobId: args.jobId,
        studioId: job.studioId,
        branchId: job.branchId,
        instructorId: instructor._id,
        status: "rejected",
        appliedAt: now,
        updatedAt: now,
      });
      return { applicationId, status: "rejected" as const };
    }

    if (!canApplyByLocation) {
      throw new ConvexError("You are not eligible for this job");
    }
    if (job.applicationDeadline !== undefined && now > job.applicationDeadline) {
      throw new ConvexError("Application deadline has passed");
    }
    if (now >= job.startTime) {
      throw new ConvexError("Job has already started");
    }

    const existingJobs = await ctx.db
      .query("jobs")
      .withIndex("by_filledByInstructor_startTime", (q) =>
        q.eq("filledByInstructorId", instructor._id),
      )
      .collect();
    const hasConflict = existingJobs.some(
      (j: any) => j.status === "filled" && j.startTime < job.endTime && j.endTime > job.startTime,
    );
    if (hasConflict) {
      throw new ConvexError("Instructor has a conflicting booking at this time");
    }

    const message = trimOptionalString(args.message);

    if (existing) {
      if (existing.status === "accepted") {
        throw new ConvexError("Application already accepted");
      }
      await ctx.db.patch("jobApplications", existing._id, {
        studioId: job.studioId,
        branchId: job.branchId,
        status: "rejected",
        updatedAt: now,
      });
    }

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

    await ctx.db.patch("jobs", job._id, {
      status: "filled",
      filledByInstructorId: instructor._id,
    });

    const competingApplications = await ctx.db
      .query("jobApplications")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    for (const row of competingApplications) {
      if (row._id !== applicationId) {
        await ctx.db.patch("jobApplications", row._id, {
          studioId: job.studioId,
          branchId: job.branchId,
          status: "rejected",
          updatedAt: now,
        });
      }
    }

    if (studio) {
      await ctx.runMutation(internal.jobs.review.runAcceptedApplicationReviewWorkflow, {
        jobId: job._id,
        acceptedApplicationId: applicationId,
        studioUserId: studio.userId,
      });
    }

    await recomputeJobApplicationStats(ctx, job);
    return { applicationId, status: "accepted" as const };
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
