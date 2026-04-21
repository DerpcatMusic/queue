import { v } from "convex/values";
import { query } from "../_generated/server";
import { omitUndefined } from "../lib/validation";
import {
  getUniqueIdsInOrder,
  isPresent,
  loadLatestPaymentDetailsByJobId,
  requireInstructorProfile,
} from "./_helpers";

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
