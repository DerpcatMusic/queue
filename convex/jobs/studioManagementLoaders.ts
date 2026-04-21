import type { QueryCtx } from "../_generated/server";
import { USE_JOB_APPLICATION_STATS, USE_STUDIO_APPLICATIONS_BY_STUDIO } from "./_helpers";

export async function loadStudioJobsBase(
  ctx: Pick<QueryCtx, "db">,
  args: {
    studioId: string;
    branchId?: string;
    limit: number;
  },
) {
  return args.branchId
    ? await ctx.db
        .query("jobs")
        .withIndex("by_branch_postedAt", (q) => q.eq("branchId", args.branchId as any))
        .order("desc")
        .take(args.limit)
    : await ctx.db
        .query("jobs")
        .withIndex("by_studio_postedAt", (q) => q.eq("studioId", args.studioId as any))
        .order("desc")
        .take(args.limit);
}

export async function loadBranchByIdForJobs(ctx: Pick<QueryCtx, "db">, jobs: any[]) {
  const branchIds = [...new Set(jobs.map((job) => job.branchId))];
  const branches = await Promise.all(
    branchIds.map((branchId) => ctx.db.get("studioBranches", branchId)),
  );
  const branchById = new Map<string, any>();
  for (let index = 0; index < branchIds.length; index += 1) {
    const branch = branches[index];
    if (branch) {
      branchById.set(String(branch._id), branch);
    }
  }
  return branchById;
}

export async function loadStatsByJobId(
  ctx: Pick<QueryCtx, "db">,
  args: {
    studioId: string;
    jobs: any[];
  },
) {
  const jobIds = new Set(args.jobs.map((job) => String(job._id)));
  const statsByJobId = new Map<string, any>();
  if (!USE_JOB_APPLICATION_STATS) {
    return statsByJobId;
  }
  const stats = await ctx.db
    .query("jobApplicationStats")
    .withIndex("by_studio", (q) => q.eq("studioId", args.studioId as any))
    .collect();
  for (const stat of stats) {
    const jobId = String(stat.jobId);
    if (!jobIds.has(jobId)) continue;
    statsByJobId.set(jobId, stat);
  }
  return statsByJobId;
}

export async function loadFallbackApplicationsByJobId(ctx: Pick<QueryCtx, "db">, jobs: any[]) {
  const fallbackApplicationsByJobId = new Map<string, any[]>();
  if (USE_JOB_APPLICATION_STATS) {
    return fallbackApplicationsByJobId;
  }
  const applicationsByJob = await Promise.all(
    jobs.map((job) =>
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
  return fallbackApplicationsByJobId;
}

export async function loadApplicationsByJobId(
  ctx: Pick<QueryCtx, "db">,
  args: {
    studioId: string;
    jobs: any[];
  },
) {
  const jobIds = new Set(args.jobs.map((job) => String(job._id)));
  const studioApplications = USE_STUDIO_APPLICATIONS_BY_STUDIO
    ? await ctx.db
        .query("jobApplications")
        .withIndex("by_studio", (q) => q.eq("studioId", args.studioId as any))
        .collect()
    : (
        await Promise.all(
          args.jobs.map((job) =>
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

  return { applicationsByJobId, studioApplications };
}
