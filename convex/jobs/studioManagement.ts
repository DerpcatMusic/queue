import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { query } from "../_generated/server";
import { assertPositiveInteger, omitUndefined } from "../lib/validation";
import { requireAccessibleStudioBranch } from "../lib/studioBranches";
import { BADGE_COUNT_CAP, clampBadgeCount, requireStudioProfile } from "./_helpers";
import {
  loadApplicationsByJobId,
  loadBranchByIdForJobs,
  loadFallbackApplicationsByJobId,
  loadInstructorTrustAssets,
  loadStatsByJobId,
  loadStudioJobsBase,
} from "./studioManagementShared";

export const getMyStudioJobs = query({
  args: {
    limit: v.optional(v.number()),
    branchId: v.optional(v.id("studioBranches")),
  },
  returns: v.array(
    v.object({
      jobId: v.id("jobs"),
      branchId: v.id("studioBranches"),
      branchName: v.string(),
      branchAddress: v.optional(v.string()),
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
      applicationsCount: v.number(),
      pendingApplicationsCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const studio = await requireStudioProfile(ctx);
    if (args.branchId) {
      await requireAccessibleStudioBranch(ctx, {
        studioId: studio._id,
        branchId: args.branchId,
        allowedRoles: ["owner"],
      });
    }

    const rawLimit = args.limit ?? 50;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 200);

    const jobs = await loadStudioJobsBase(ctx, {
      studioId: String(studio._id),
      branchId: args.branchId ? String(args.branchId) : undefined,
      limit,
    });
    const [branchById, statsByJobId, fallbackApplicationsByJobId] = await Promise.all([
      loadBranchByIdForJobs(ctx, jobs),
      loadStatsByJobId(ctx, {
        studioId: String(studio._id),
        jobs,
      }),
      loadFallbackApplicationsByJobId(ctx, jobs),
    ]);

    const rows = [];
    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      if (!job) continue;
      const stat = statsByJobId.get(String(job._id));

      rows.push({
        jobId: job._id,
        branchId: job.branchId,
        branchName:
          job.branchNameSnapshot ?? branchById.get(String(job.branchId))?.name ?? "Main branch",
        sport: job.sport,
        startTime: job.startTime,
        endTime: job.endTime,
        pay: job.pay,
        status: job.status,
        postedAt: job.postedAt,
        applicationsCount:
          stat?.applicationsCount ??
          (fallbackApplicationsByJobId.get(String(job._id)) ?? []).length,
        pendingApplicationsCount:
          stat?.pendingApplicationsCount ??
          (fallbackApplicationsByJobId.get(String(job._id)) ?? []).filter(
            (application: any) => application.status === "pending",
          ).length,
        ...omitUndefined({
          branchAddress: job.branchAddressSnapshot ?? branchById.get(String(job.branchId))?.address,
          timeZone: job.timeZone,
          note: job.note,
        }),
      });
    }

    return rows;
  },
});

export const getMyStudioJobsWithApplications = query({
  args: {
    limit: v.optional(v.number()),
    branchId: v.optional(v.id("studioBranches")),
  },
  returns: v.array(
    v.object({
      jobId: v.id("jobs"),
      branchId: v.id("studioBranches"),
      branchName: v.string(),
      branchAddress: v.optional(v.string()),
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
      applicationsCount: v.number(),
      pendingApplicationsCount: v.number(),
      applicationDeadline: v.optional(v.number()),
      closureReason: v.optional(
        v.union(v.literal("expired"), v.literal("studio_cancelled"), v.literal("filled")),
      ),
      boostPreset: v.optional(v.union(v.literal("small"), v.literal("medium"), v.literal("large"))),
      boostBonusAmount: v.optional(v.number()),
      boostActive: v.optional(v.boolean()),
      boostTriggerMinutes: v.optional(v.number()),
      applications: v.array(
        v.object({
          applicationId: v.id("jobApplications"),
          instructorId: v.id("instructorProfiles"),
          instructorName: v.string(),
          profileImageUrl: v.optional(v.string()),
          status: v.union(
            v.literal("pending"),
            v.literal("accepted"),
            v.literal("rejected"),
            v.literal("withdrawn"),
          ),
          appliedAt: v.number(),
          message: v.optional(v.string()),
          trust: v.object({
            identityVerified: v.boolean(),
            insuranceVerified: v.boolean(),
            certificates: v.array(
              v.object({
                specialties: v.array(
                  v.object({
                    sport: v.string(),
                    capabilityTags: v.optional(v.array(v.string())),
                  }),
                ),
                issuerName: v.optional(v.string()),
                certificateTitle: v.optional(v.string()),
                verifiedAt: v.optional(v.number()),
              }),
            ),
          }),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const studio = await requireStudioProfile(ctx);
    if (args.branchId) {
      await requireAccessibleStudioBranch(ctx, {
        studioId: studio._id,
        branchId: args.branchId,
        allowedRoles: ["owner"],
      });
    }

    const rawLimit = args.limit ?? 50;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 200);

    const jobs = await loadStudioJobsBase(ctx, {
      studioId: String(studio._id),
      branchId: args.branchId ? String(args.branchId) : undefined,
      limit,
    });
    const jobIds = new Set(jobs.map((job: any) => String(job._id)));
    const [branchById, statsByJobId, applicationContext] = await Promise.all([
      loadBranchByIdForJobs(ctx, jobs),
      loadStatsByJobId(ctx, {
        studioId: String(studio._id),
        jobs,
      }),
      loadApplicationsByJobId(ctx, {
        studioId: String(studio._id),
        jobs,
      }),
    ]);
    const scopedApplications = applicationContext.studioApplications.filter((application: any) =>
      jobIds.has(String(application.jobId)),
    );
    const { profileById, profileImageUrlById, trustByInstructorId } =
      await loadInstructorTrustAssets(ctx, scopedApplications);
    const applicationsByJobId = applicationContext.applicationsByJobId;

    const rows = [];
    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      if (!job) continue;
      const applications = applicationsByJobId.get(String(job._id)) ?? ([] as any[]);
      const stat = statsByJobId.get(String(job._id));

      const sortedApplications = [...applications].sort((a: any, b: any) => {
        const statusRank: Record<string, number> = {
          pending: 0,
          accepted: 1,
          rejected: 2,
          withdrawn: 3,
        };
        const leftRank = statusRank[a.status] ?? 99;
        const rightRank = statusRank[b.status] ?? 99;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return b.appliedAt - a.appliedAt;
      });

      rows.push({
        jobId: job._id,
        branchId: job.branchId,
        branchName:
          job.branchNameSnapshot ?? branchById.get(String(job.branchId))?.name ?? "Main branch",
        sport: job.sport,
        startTime: job.startTime,
        endTime: job.endTime,
        pay: job.pay,
        status: job.status,
        postedAt: job.postedAt,
        applicationsCount: stat?.applicationsCount ?? applications.length,
        pendingApplicationsCount:
          stat?.pendingApplicationsCount ??
          applications.filter((a: any) => a.status === "pending").length,
        ...omitUndefined({
          branchAddress: job.branchAddressSnapshot ?? branchById.get(String(job.branchId))?.address,
          timeZone: job.timeZone,
          note: job.note,
          applicationDeadline: job.applicationDeadline,
          closureReason: job.closureReason,
          boostPreset: job.boostPreset,
          boostBonusAmount: job.boostBonusAmount,
          boostActive: job.boostActive,
          boostTriggerMinutes: job.boostTriggerMinutes,
        }),
        applications: sortedApplications.map((application: any) => {
          const profile = profileById.get(String(application.instructorId));
          const profileImageUrl = profileImageUrlById.get(String(application.instructorId));
          return {
            applicationId: application._id,
            instructorId: application.instructorId,
            instructorName: profile?.displayName ?? "Unknown instructor",
            status: application.status,
            appliedAt: application.appliedAt,
            trust: trustByInstructorId.get(String(application.instructorId)) ?? {
              identityVerified: false,
              insuranceVerified: false,
              certificates: [],
            },
            ...omitUndefined({
              profileImageUrl,
              message: application.message,
            }),
          };
        }),
      });
    }

    return rows;
  },
});

export const getStudioTabCounts = query({
  args: {
    now: v.optional(v.number()),
  },
  returns: v.object({
    jobsBadgeCount: v.number(),
    calendarBadgeCount: v.number(),
  }),
  handler: async (ctx, args) => {
    let studio: any;
    try {
      studio = await requireStudioProfile(ctx);
    } catch (error) {
      if (error instanceof ConvexError) {
        return { jobsBadgeCount: 0, calendarBadgeCount: 0 };
      }
      throw error;
    }
    const now = args.now ?? Date.now();
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_studio_postedAt", (q) => q.eq("studioId", studio._id))
      .take(200);
    const activeJobs = jobs.filter(
      (job: any) => (job.status === "open" || job.status === "filled") && job.endTime > now,
    );
    const activeJobIdSet = new Set(activeJobs.map((job: any) => String(job._id)));
    const calendarBadgeCount = clampBadgeCount(activeJobs.length);

    let jobsBadgeCount = 0;
    if (activeJobIdSet.size > 0) {
      const applications = await ctx.db
        .query("jobApplications")
        .withIndex("by_studio", (q) => q.eq("studioId", studio._id))
        .collect();
      for (const application of applications) {
        if (!activeJobIdSet.has(String(application.jobId))) continue;
        if (application.status !== "pending") continue;
        jobsBadgeCount += 1;
        if (jobsBadgeCount >= BADGE_COUNT_CAP) break;
      }
    }

    return {
      jobsBadgeCount: clampBadgeCount(jobsBadgeCount),
      calendarBadgeCount,
    };
  },
});
