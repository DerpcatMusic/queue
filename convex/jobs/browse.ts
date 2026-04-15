import { v } from "convex/values";
import { query } from "../_generated/server";
import {
  canInstructorPerformJobActions,
  getInstructorJobActionBlockReason,
  instructorJobActionBlockReasonValidator,
  loadInstructorComplianceSnapshot,
} from "../lib/instructorCompliance";
import { queryAvailableJobsForInstructorCoverage } from "../lib/instructorGeoCoverage";
import { getPrimaryStudioBranch } from "../lib/studioBranches";
import { requireInstructorProfile } from "./_helpers";
import { assertPositiveInteger, omitUndefined } from "../lib/validation";

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
      studioImageUrl: v.optional(v.string()),
      studioAddress: v.optional(v.string()),
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
    }),
  ),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const now = args.now ?? Date.now();
    const compliance = await loadInstructorComplianceSnapshot(ctx, instructor._id, now);

    // Load instructor's sports
    const sportRows = await ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructor._id))
      .collect();
    const sports = new Set(sportRows.map((r: any) => r.sport));

    if (sports.size === 0) return [];

    const rawLimit = args.limit ?? 50;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 200);

    const matchingJobs = await queryAvailableJobsForInstructorCoverage(ctx, {
      instructorId: instructor._id,
      status: "open",
      limit,
    });

    // Filter out jobs that have started or passed application deadline
    const actionableJobs = matchingJobs.filter((job: any) => {
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

    const applicationByJobId = new Map<string, any>();
    const matchingJobIdSet = new Set(actionableJobs.map((job: any) => String(job._id)));
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

    const studioIds = [...new Set(actionableJobs.map((job: any) => job.studioId))];
    const branchIds = [...new Set(actionableJobs.map((job: any) => job.branchId))];
    const studioById = new Map<string, any>();
    const branchById = new Map<string, any>();
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

    return actionableJobs.map((job: any) => {
      const studio = studioById.get(String(job.studioId));
      const branch = branchById.get(String(job.branchId));
      const application = applicationByJobId.get(String(job._id));
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
          studioAddress: job.branchAddressSnapshot ?? branch?.address ?? studio?.address,
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
        }),
      };
    });
  },
});

export const getStudioProfileForInstructor = query({
  args: {
    studioId: v.id("studioProfiles"),
    now: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      studioId: v.id("studioProfiles"),
      studioName: v.string(),
      studioAddress: v.string(),
      bio: v.optional(v.string()),
      studioImageUrl: v.optional(v.string()),
      sports: v.array(v.string()),
      jobs: v.array(
        v.object({
          jobId: v.id("jobs"),
          studioId: v.id("studioProfiles"),
          branchId: v.id("studioBranches"),
          studioName: v.string(),
          branchName: v.string(),
          branchAddress: v.optional(v.string()),
          studioImageUrl: v.optional(v.string()),
          studioAddress: v.optional(v.string()),
          sport: v.string(),
          startTime: v.number(),
          endTime: v.number(),
          timeZone: v.optional(v.string()),
          pay: v.number(),
          note: v.optional(v.string()),
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
          boostPreset: v.optional(
            v.union(v.literal("small"), v.literal("medium"), v.literal("large")),
          ),
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
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const now = args.now ?? Date.now();
    const compliance = await loadInstructorComplianceSnapshot(ctx, instructor._id, now);
    const studio = await ctx.db.get("studioProfiles", args.studioId);

    if (!studio) {
      return null;
    }

    const [sportsRows, jobsForStudio, studioImageUrl, primaryBranch] = await Promise.all([
      ctx.db
        .query("studioSports")
        .withIndex("by_studio_id", (q) => q.eq("studioId", args.studioId))
        .collect(),
      ctx.db
        .query("jobs")
        .withIndex("by_studio_postedAt", (q) => q.eq("studioId", args.studioId))
        .order("desc")
        .take(40),
      studio.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
      getPrimaryStudioBranch(ctx, args.studioId),
    ]);

    const visibleJobs: any[] = jobsForStudio.filter((job: any) => {
      if (job.status !== "open" || job.startTime <= now) {
        return false;
      }
      if (
        typeof job.applicationDeadline === "number" &&
        Number.isFinite(job.applicationDeadline) &&
        job.applicationDeadline <= now
      ) {
        return false;
      }
      return true;
    });
    const visibleJobIdSet = new Set(visibleJobs.map((job: any) => String(job._id)));

    const instructorApplications = await ctx.db
      .query("jobApplications")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructor._id))
      .collect();
    const applicationByJobId = new Map<string, any>();
    for (const application of instructorApplications) {
      const jobId = String(application.jobId);
      if (!visibleJobIdSet.has(jobId)) continue;
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

    const branchIds = [...new Set(visibleJobs.map((job: any) => job.branchId))];
    const branches = await Promise.all(
      branchIds.map((branchId: any) => ctx.db.get("studioBranches", branchId)),
    );
    const branchById = new Map<string, any>();
    for (let index = 0; index < branchIds.length; index += 1) {
      const branchId = branchIds[index];
      const branch = branches[index];
      if (branch) {
        branchById.set(String(branchId), branch);
      }
    }

    return {
      studioId: studio._id,
      studioName: studio.studioName,
      studioAddress: primaryBranch?.address ?? studio.address,
      sports: [...new Set(sportsRows.map((row: any) => row.sport))].sort(),
      ...omitUndefined({
        bio: studio.bio,
        studioImageUrl: studioImageUrl ?? undefined,
      }),
      jobs: visibleJobs.map((job: any) => {
        const application = applicationByJobId.get(String(job._id));
        const branch = branchById.get(String(job.branchId));
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
          studioId: studio._id,
          branchId: job.branchId,
          studioName: studio.studioName,
          branchName: job.branchNameSnapshot ?? branch?.name ?? "Main branch",
          sport: job.sport,
          startTime: job.startTime,
          endTime: job.endTime,
          pay: job.pay,
          status: job.status,
          postedAt: job.postedAt,
          canApplyToJob,
          ...omitUndefined({
            studioImageUrl: studioImageUrl ?? undefined,
            branchAddress: job.branchAddressSnapshot ?? branch?.address,
            studioAddress: job.branchAddressSnapshot ?? branch?.address ?? studio.address,
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
          }),
        };
      }),
    };
  },
});
