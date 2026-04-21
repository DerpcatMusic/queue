import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  canInstructorPerformJobActions,
  getInstructorJobActionBlockReason,
  instructorJobActionBlockReasonValidator,
  loadInstructorComplianceSnapshot,
} from "../lib/instructorCompliance";
import { queryAvailableJobsForInstructorCoverage } from "../lib/instructorGeoCoverage";
import { normalizeWorkRadiusKm } from "../lib/locationRadius";
import { assertPositiveInteger, omitUndefined } from "../lib/validation";
import { requireInstructorProfile } from "./_helpers";
import { getDistanceMeters } from "./browseShared";

export const getAvailableJobsForInstructor = query({
  args: {
    limit: v.optional(v.number()),
    now: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      jobId: v.id("jobs"),
      studioId: v.id("studioProfiles"),
      branchId: v.id("studioBranches"),
      studioName: v.string(),
      branchName: v.string(),
      branchAddress: v.optional(v.string()),
      branchLatitude: v.optional(v.number()),
      branchLongitude: v.optional(v.number()),
      studioImageUrl: v.optional(v.string()),
      studioAddress: v.optional(v.string()),
      studioLatitude: v.optional(v.number()),
      studioLongitude: v.optional(v.number()),
      distanceMeters: v.optional(v.number()),
      sport: v.string(),
      startTime: v.number(),
      endTime: v.number(),
      timeZone: v.optional(v.string()),
      pay: v.number(),
      note: v.optional(v.string()),
      checkInStatus: v.optional(v.union(v.literal("verified"), v.literal("rejected"))),
      checkInReason: v.optional(
        v.union(
          v.literal("verified"),
          v.literal("outside_radius"),
          v.literal("accuracy_too_low"),
          v.literal("sample_too_old"),
          v.literal("outside_check_in_window"),
          v.literal("branch_location_missing"),
        ),
      ),
      checkedInAt: v.optional(v.number()),
      checkInDistanceMeters: v.optional(v.number()),
      status: v.union(
        v.literal("open"),
        v.literal("filled"),
        v.literal("cancelled"),
        v.literal("completed"),
      ),
      postedAt: v.number(),
      requiredLevel: v.optional(
        v.union(
          v.literal("beginner_friendly"),
          v.literal("all_levels"),
          v.literal("intermediate"),
          v.literal("advanced"),
        ),
      ),
      maxParticipants: v.optional(v.number()),
      equipmentProvided: v.optional(v.boolean()),
      sessionLanguage: v.optional(
        v.union(
          v.literal("hebrew"),
          v.literal("english"),
          v.literal("arabic"),
          v.literal("russian"),
        ),
      ),
      isRecurring: v.optional(v.boolean()),
      cancellationDeadlineHours: v.optional(v.number()),
      applicationDeadline: v.optional(v.number()),
      closureReason: v.optional(
        v.union(v.literal("expired"), v.literal("studio_cancelled"), v.literal("filled")),
      ),
      boostPreset: v.optional(v.union(v.literal("small"), v.literal("medium"), v.literal("large"))),
      boostBonusAmount: v.optional(v.number()),
      boostActive: v.optional(v.boolean()),
      canApplyToJob: v.boolean(),
      jobActionBlockedReason: v.optional(instructorJobActionBlockReasonValidator),
      applicationId: v.optional(v.id("jobApplications")),
      applicationStatus: v.optional(
        v.union(
          v.literal("pending"),
          v.literal("accepted"),
          v.literal("rejected"),
          v.literal("withdrawn"),
        ),
      ),
      // For max 3 concurrent applicants feature
      pendingApplicationsCount: v.number(),
      isNearCapacity: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const now = args.now ?? Date.now();
    const compliance = await loadInstructorComplianceSnapshot(ctx, instructor._id, now);

    const sportRows = await ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructor._id))
      .collect();
    const sports = new Set(sportRows.map((r) => r.sport));

    if (sports.size === 0) return [];

    const rawLimit = args.limit ?? 50;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 200);

    const matchingJobs = await queryAvailableJobsForInstructorCoverage(ctx, {
      instructorId: instructor._id,
      status: "open",
      limit,
    });

    const actionableJobs = matchingJobs.filter((job) => {
      if (job.startTime <= now) return false;
      if (
        typeof job.applicationDeadline === "number" &&
        Number.isFinite(job.applicationDeadline) &&
        job.applicationDeadline <= now
      ) {
        return false;
      }
      return true;
    });

    if (actionableJobs.length === 0) return [];

    const hasInstructorLocation =
      Number.isFinite(instructor.latitude) && Number.isFinite(instructor.longitude);
    const workRadiusKm = normalizeWorkRadiusKm(instructor.workRadiusKm);

    const applicationByJobId = new Map<string, any>();
    const matchingJobIdSet = new Set(actionableJobs.map((job) => String(job._id)));
    const instructorApplications = await ctx.db
      .query("jobApplications")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructor._id))
      .take(100);

    for (const application of instructorApplications) {
      const jobId = String(application.jobId);
      if (!matchingJobIdSet.has(jobId)) continue;
      const existing = applicationByJobId.get(jobId);
      if (!existing) {
        applicationByJobId.set(jobId, application);
        continue;
      }
      const existingUpdatedAt = existing.updatedAt ?? existing.appliedAt;
      const nextUpdatedAt = application.updatedAt ?? application.appliedAt;
      if (nextUpdatedAt > existingUpdatedAt) {
        applicationByJobId.set(jobId, application);
      }
    }

    // Get pending application counts for max 3 concurrent applicants feature
    const pendingApplicationCounts = new Map<string, number>();
    for (const jobId of matchingJobIdSet) {
      const applications = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", jobId as Id<"jobs">))
        .filter((q) => q.eq("status", "pending"))
        .collect();
      pendingApplicationCounts.set(jobId, applications.length);
    }

    const studioIds = [...new Set(actionableJobs.map((job) => job.studioId))];
    const branchIds = [...new Set(actionableJobs.map((job) => job.branchId))];
    const studioById = new Map<string, any>();
    const branchById = new Map<string, any>();
    const studios = await Promise.all(
      studioIds.map((studioId) => ctx.db.get("studioProfiles", studioId)),
    );
    const branches = await Promise.all(
      branchIds.map((branchId) => ctx.db.get("studioBranches", branchId)),
    );
    const studioImageUrls = await Promise.all(
      studios.map((studio) =>
        studio?.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
      ),
    );
    const studioImageUrlById = new Map<string, string>();
    for (let i = 0; i < studioIds.length; i += 1) {
      const studioId = studioIds[i];
      const studio = studios[i];
      const studioImageUrl = studioImageUrls[i];
      if (studio) {
        studioById.set(String(studioId), studio);
      }
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

    return actionableJobs
      .map((job) => {
        const studio = studioById.get(String(job.studioId));
        const branch = branchById.get(String(job.branchId));
        const application = applicationByJobId.get(String(job._id));
        const distanceMeters =
          hasInstructorLocation &&
          Number.isFinite(branch?.latitude) &&
          Number.isFinite(branch?.longitude)
            ? getDistanceMeters(
                { latitude: instructor.latitude!, longitude: instructor.longitude! },
                { latitude: branch.latitude!, longitude: branch.longitude! },
              )
            : undefined;
        if (distanceMeters !== undefined && distanceMeters > workRadiusKm * 1000) {
          return null;
        }
        const canApplyToJob = canInstructorPerformJobActions({
          profile: instructor,
          compliance,
          sport: job.sport,
          requiredCapabilityTags: job.requiredCapabilityTags,
        });
        const jobActionBlockedReason = getInstructorJobActionBlockReason({
          profile: instructor,
          compliance,
          sport: job.sport,
          requiredCapabilityTags: job.requiredCapabilityTags,
        });
        return {
          jobId: job._id,
          studioId: job.studioId,
          branchId: job.branchId,
          studioName: studio?.studioName ?? "Unknown studio",
          branchName: job.branchNameSnapshot ?? branch?.name ?? "Main branch",
          sport: job.sport,
          startTime: job.startTime,
          endTime: job.endTime,
          pay: job.pay,
          status: job.status,
          postedAt: job.postedAt,
          canApplyToJob,
          ...omitUndefined({
            studioImageUrl: studioImageUrlById.get(String(job.studioId)),
            branchAddress: job.branchAddressSnapshot ?? branch?.address,
            branchLatitude: branch?.latitude,
            branchLongitude: branch?.longitude,
            studioAddress: job.branchAddressSnapshot ?? branch?.address ?? studio?.address,
            studioLatitude: studio?.latitude,
            studioLongitude: studio?.longitude,
            distanceMeters,
            timeZone: job.timeZone,
            note: job.note,
            requiredLevel: job.requiredLevel,
            maxParticipants: job.maxParticipants,
            equipmentProvided: job.equipmentProvided,
            sessionLanguage: job.sessionLanguage,
            isRecurring: job.isRecurring,
            cancellationDeadlineHours: job.cancellationDeadlineHours,
            applicationDeadline: job.applicationDeadline,
            closureReason: job.closureReason,
            boostPreset: job.boostPreset,
            boostBonusAmount: job.boostBonusAmount,
            boostActive: job.boostActive,
            jobActionBlockedReason,
            applicationId: application?._id,
            applicationStatus: application?.status,
            // Max 3 concurrent applicants feature
            pendingApplicationsCount: pendingApplicationCounts.get(String(job._id)) ?? 0,
            isNearCapacity: (pendingApplicationCounts.get(String(job._id)) ?? 0) >= 2,
          }),
        };
      })
      .filter((job): job is NonNullable<typeof job> => job !== null);
  },
});
