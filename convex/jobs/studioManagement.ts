import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { query } from "../_generated/server";
import { requireAccessibleStudioBranch } from "../lib/studioBranches";
import {
  requireStudioProfile,
  USE_JOB_APPLICATION_STATS,
  USE_STUDIO_APPLICATIONS_BY_STUDIO,
  BADGE_COUNT_CAP,
  clampBadgeCount,
  recomputeJobApplicationStats,
} from "./_helpers";
import { assertPositiveInteger, omitUndefined } from "../lib/validation";

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

    const jobs = args.branchId
      ? await ctx.db
          .query("jobs")
          .withIndex("by_branch_postedAt", (q) => q.eq("branchId", args.branchId!))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("jobs")
          .withIndex("by_studio_postedAt", (q) => q.eq("studioId", studio._id))
          .order("desc")
          .take(limit);
    const branchIds = [...new Set(jobs.map((job: any) => job.branchId))];
    const branches = await Promise.all(
      branchIds.map((branchId: any) => ctx.db.get("studioBranches", branchId)),
    );
    const branchById = new Map<string, any>();
    for (let index = 0; index < branchIds.length; index += 1) {
      const branch = branches[index];
      if (branch) {
        branchById.set(String(branch._id), branch);
      }
    }
    const jobIds = new Set(jobs.map((job: any) => String(job._id)));
    const statsByJobId = new Map<string, any>();
    const fallbackApplicationsByJobId = new Map<string, any[]>();
    if (USE_JOB_APPLICATION_STATS) {
      const stats = await ctx.db
        .query("jobApplicationStats")
        .withIndex("by_studio", (q) => q.eq("studioId", studio._id))
        .collect();
      for (const stat of stats) {
        const jobId = String(stat.jobId);
        if (!jobIds.has(jobId)) continue;
        statsByJobId.set(jobId, stat);
      }
    } else {
      const applicationsByJob = await Promise.all(
        jobs.map((job: any) =>
          ctx.db
            .query("jobApplications")
            .withIndex("by_job", (q) => q.eq("jobId", job._id))
            .collect(),
        ),
      );
      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i];
        if (!job) continue;
        fallbackApplicationsByJobId.set(String(job._id), applicationsByJob[i] ?? []);
      }
    }

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

    const jobs = args.branchId
      ? await ctx.db
          .query("jobs")
          .withIndex("by_branch_postedAt", (q) => q.eq("branchId", args.branchId!))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("jobs")
          .withIndex("by_studio_postedAt", (q) => q.eq("studioId", studio._id))
          .order("desc")
          .take(limit);
    const branchIds = [...new Set(jobs.map((job: any) => job.branchId))];
    const branches = await Promise.all(
      branchIds.map((branchId: any) => ctx.db.get("studioBranches", branchId)),
    );
    const branchById = new Map<string, any>();
    for (let index = 0; index < branchIds.length; index += 1) {
      const branch = branches[index];
      if (branch) {
        branchById.set(String(branch._id), branch);
      }
    }
    const jobIds = new Set(jobs.map((job: any) => String(job._id)));
    const statsByJobId = new Map<string, any>();
    if (USE_JOB_APPLICATION_STATS) {
      const stats = await ctx.db
        .query("jobApplicationStats")
        .withIndex("by_studio", (q) => q.eq("studioId", studio._id))
        .collect();
      for (const stat of stats) {
        const jobId = String(stat.jobId);
        if (!jobIds.has(jobId)) continue;
        statsByJobId.set(jobId, stat);
      }
    }

    const studioApplications = USE_STUDIO_APPLICATIONS_BY_STUDIO
      ? await ctx.db
          .query("jobApplications")
          .withIndex("by_studio", (q) => q.eq("studioId", studio._id))
          .collect()
      : (
          await Promise.all(
            jobs.map((job: any) =>
              ctx.db
                .query("jobApplications")
                .withIndex("by_job", (q) => q.eq("jobId", job._id))
                .collect(),
            ),
          )
        ).flat();
    const applicationsByJobId = new Map<string, any[]>();
    for (const application of studioApplications) {
      const jobId = String(application.jobId);
      if (!jobIds.has(jobId)) continue;
      const existing = applicationsByJobId.get(jobId);
      if (existing) {
        existing.push(application);
      } else {
        applicationsByJobId.set(jobId, [application]);
      }
    }

    const instructorIds = [
      ...new Set(
        studioApplications
          .filter((application: any) => jobIds.has(String(application.jobId)))
          .map((application: any) => application.instructorId),
      ),
    ];
    const profiles = await Promise.all(
      instructorIds.map((instructorId: any) => ctx.db.get("instructorProfiles", instructorId)),
    );
    const profileById = new Map<string, any>();
    for (let i = 0; i < instructorIds.length; i += 1) {
      const instructorId = instructorIds[i];
      const profile = profiles[i];
      if (profile) {
        profileById.set(String(instructorId), profile);
      }
    }

    // Fetch profile image URLs for each instructor
    const profileImageUrlById = new Map<string, string | undefined>();
    for (const profile of profiles) {
      if (profile) {
        const imageUrl = profile.profileImageStorageId
          ? ((await ctx.storage.getUrl(profile.profileImageStorageId)) ?? undefined)
          : undefined;
        profileImageUrlById.set(String(profile._id), imageUrl);
      }
    }

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
        if (statusRank[a.status] !== statusRank[b.status]) {
          return statusRank[a.status] - statusRank[b.status];
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
      if (USE_JOB_APPLICATION_STATS) {
        const stats = await ctx.db
          .query("jobApplicationStats")
          .withIndex("by_studio", (q) => q.eq("studioId", studio._id))
          .collect();

        for (const stat of stats) {
          if (!activeJobIdSet.has(String(stat.jobId))) continue;
          jobsBadgeCount += stat.pendingApplicationsCount;
          if (jobsBadgeCount >= BADGE_COUNT_CAP) break;
        }
      } else {
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
    }

    return {
      jobsBadgeCount: clampBadgeCount(jobsBadgeCount),
      calendarBadgeCount,
    };
  },
});
