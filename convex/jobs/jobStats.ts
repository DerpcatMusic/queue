import type { Doc, MutationCtx } from "../_generated/dataModel";
import { USE_JOB_APPLICATION_STATS } from "./jobConstants";

export async function recomputeJobApplicationStats(ctx: MutationCtx, job: Doc<"jobs">) {
  if (!USE_JOB_APPLICATION_STATS) return;

  const applications = await ctx.db
    .query("jobApplications")
    .withIndex("by_job", (q) => q.eq("jobId", job._id))
    .collect();

  const applicationsCount = applications.length;
  const pendingApplicationsCount = applications.filter(
    (application) => application.status === "pending",
  ).length;
  const existing = await ctx.db
    .query("jobApplicationStats")
    .withIndex("by_job", (q) => q.eq("jobId", job._id))
    .unique();
  const next = {
    studioId: job.studioId,
    branchId: job.branchId,
    applicationsCount,
    pendingApplicationsCount,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, next);
    return;
  }

  await ctx.db.insert("jobApplicationStats", {
    jobId: job._id,
    ...next,
  });
}
