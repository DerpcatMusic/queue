import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { omitUndefined } from "../lib/validation";

type Ctx = QueryCtx | MutationCtx;

export const DEFAULT_JOB_APPLICATION_LIMIT = 3;
export const DEFAULT_JOB_PAYMENT_TIMING = "after_end" as const;
export const DEFAULT_JOB_PAYMENT_GRACE_DAYS = 3;

export function getJobApplicationLimit(job: Doc<"jobs">) {
  const configured = Math.floor(job.applicationLimit ?? DEFAULT_JOB_APPLICATION_LIMIT);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_JOB_APPLICATION_LIMIT;
  }
  return Math.min(configured, DEFAULT_JOB_APPLICATION_LIMIT);
}

export function getJobPaymentTiming(job: Doc<"jobs">) {
  return job.paymentTiming ?? DEFAULT_JOB_PAYMENT_TIMING;
}

export function getJobPaymentGraceDays(job: Doc<"jobs">) {
  const configured = Math.floor(job.paymentGraceDays ?? DEFAULT_JOB_PAYMENT_GRACE_DAYS);
  if (!Number.isFinite(configured) || configured < 0) {
    return DEFAULT_JOB_PAYMENT_GRACE_DAYS;
  }
  return Math.min(configured, 14);
}

export function getJobSettlementDueAt(job: Doc<"jobs">) {
  const timing = getJobPaymentTiming(job);
  const graceDays = getJobPaymentGraceDays(job);

  switch (timing) {
    case "before_lesson":
      return job.startTime;
    case "after_start":
      return job.startTime + graceDays * 24 * 60 * 60 * 1000;
    case "net_terms":
      return job.endTime + graceDays * 24 * 60 * 60 * 1000;
    default:
      return job.endTime + graceDays * 24 * 60 * 60 * 1000;
  }
}

export async function ensureJobSettlementPolicy(ctx: MutationCtx, job: Doc<"jobs">) {
  const existing = await ctx.db
    .query("jobSettlementPolicies")
    .withIndex("by_job", (q) => q.eq("jobId", job._id))
    .unique();

  const now = Date.now();
  const patch = {
    paymentTiming: getJobPaymentTiming(job),
    graceDays: getJobPaymentGraceDays(job),
    requiresVerifiedCheckIn: true,
    requiresVerifiedCheckOut: true,
    autoSuspendOnOverdue: true,
    updatedAt: now,
  } as const;

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return (await ctx.db.get(existing._id)) ?? existing;
  }

  const policyId = await ctx.db.insert("jobSettlementPolicies", {
    jobId: job._id,
    studioId: job.studioId,
    ...patch,
    createdAt: now,
  });
  const policy = await ctx.db.get(policyId);
  if (!policy) {
    throw new ConvexError("Failed to create settlement policy");
  }
  return policy;
}

export async function getJobSettlementState(
  ctx: Ctx,
  args: {
    jobId: Id<"jobs">;
    assignmentId?: Id<"jobAssignments">;
  },
) {
  if (args.assignmentId) {
    const byAssignment = await ctx.db
      .query("jobSettlementStates")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .unique();
    if (byAssignment) {
      return byAssignment;
    }
  }

  return await ctx.db
    .query("jobSettlementStates")
    .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
    .order("desc")
    .first();
}

export async function upsertJobSettlementState(
  ctx: MutationCtx,
  args: {
    job: Doc<"jobs">;
    instructorId: Id<"instructorProfiles">;
    instructorUserId: Id<"users">;
    assignmentId?: Id<"jobAssignments">;
    paymentOfferId?: Id<"paymentOffers">;
    paymentOrderId?: Id<"paymentOrders">;
    paymentStatus?: Doc<"jobSettlementStates">["paymentStatus"];
    lessonStatus?: Doc<"jobSettlementStates">["lessonStatus"];
    settlementStatus?: Doc<"jobSettlementStates">["settlementStatus"];
    paidAt?: number;
    lessonCompletedAt?: number;
    overdueAt?: number;
    suspendedStudioAt?: number;
  },
) {
  const now = Date.now();
  const dueAt = getJobSettlementDueAt(args.job);
  const existing = await getJobSettlementState(ctx, {
    jobId: args.job._id,
    ...omitUndefined({
      assignmentId: args.assignmentId,
    }),
  });

  const nextFields = {
    jobId: args.job._id,
    studioId: args.job.studioId,
    branchId: args.job.branchId,
    instructorId: args.instructorId,
    instructorUserId: args.instructorUserId,
    ...omitUndefined({
      assignmentId: args.assignmentId,
      paymentOfferId: args.paymentOfferId ?? existing?.paymentOfferId,
      paymentOrderId: args.paymentOrderId ?? existing?.paymentOrderId,
    }),
    paymentStatus: args.paymentStatus ?? existing?.paymentStatus ?? "not_required_yet",
    lessonStatus: args.lessonStatus ?? existing?.lessonStatus ?? "scheduled",
    settlementStatus: args.settlementStatus ?? existing?.settlementStatus ?? "pending",
    dueAt,
    ...omitUndefined({
      paidAt: args.paidAt ?? existing?.paidAt,
      lessonCompletedAt: args.lessonCompletedAt ?? existing?.lessonCompletedAt,
      overdueAt: args.overdueAt ?? existing?.overdueAt,
      suspendedStudioAt: args.suspendedStudioAt ?? existing?.suspendedStudioAt,
    }),
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, nextFields);
    return (await ctx.db.get(existing._id)) ?? existing;
  }

  const settlementId = await ctx.db.insert("jobSettlementStates", {
    ...nextFields,
    createdAt: now,
  });
  const settlement = await ctx.db.get(settlementId);
  if (!settlement) {
    throw new ConvexError("Failed to create settlement state");
  }
  return settlement;
}

export async function getActiveStudioOperationalBlock(ctx: Ctx, studioId: Id<"studioProfiles">) {
  return await ctx.db
    .query("studioOperationalBlocks")
    .withIndex("by_studio_active", (q) => q.eq("studioId", studioId).eq("active", true))
    .order("desc")
    .first();
}

export async function getOverdueStudioSettlementState(ctx: Ctx, studioId: Id<"studioProfiles">) {
  return await ctx.db
    .query("jobSettlementStates")
    .withIndex("by_studio_status_due", (q) =>
      q.eq("studioId", studioId).eq("settlementStatus", "overdue"),
    )
    .order("desc")
    .first();
}

export async function upsertStudioOperationalBlock(
  ctx: MutationCtx,
  args: {
    studioId: Id<"studioProfiles">;
    userId: Id<"users">;
    reason: Doc<"studioOperationalBlocks">["reason"];
    scope: Doc<"studioOperationalBlocks">["scope"];
    detail?: string;
    triggeredByJobId?: Id<"jobs">;
    triggeredBySettlementStateId?: Id<"jobSettlementStates">;
  },
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("studioOperationalBlocks")
    .withIndex("by_studio_active", (q) => q.eq("studioId", args.studioId).eq("active", true))
    .collect();
  const sameReason = existing.find((row) => row.reason === args.reason);
  if (sameReason) {
    await ctx.db.patch(sameReason._id, {
      scope: args.scope,
      detail: args.detail ?? sameReason.detail,
      triggeredByJobId: args.triggeredByJobId ?? sameReason.triggeredByJobId,
      triggeredBySettlementStateId:
        args.triggeredBySettlementStateId ?? sameReason.triggeredBySettlementStateId,
      updatedAt: now,
    });
    return (await ctx.db.get(sameReason._id)) ?? sameReason;
  }

  const blockId = await ctx.db.insert("studioOperationalBlocks", {
    studioId: args.studioId,
    userId: args.userId,
    reason: args.reason,
    scope: args.scope,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...omitUndefined({
      detail: args.detail,
      triggeredByJobId: args.triggeredByJobId,
      triggeredBySettlementStateId: args.triggeredBySettlementStateId,
    }),
  });
  const block = await ctx.db.get(blockId);
  if (!block) {
    throw new ConvexError("Failed to create studio block");
  }
  return block;
}

export async function releaseStudioOperationalBlocks(
  ctx: MutationCtx,
  studioId: Id<"studioProfiles">,
  reason?: Doc<"studioOperationalBlocks">["reason"],
) {
  const blocks = await ctx.db
    .query("studioOperationalBlocks")
    .withIndex("by_studio_active", (q) => q.eq("studioId", studioId).eq("active", true))
    .collect();
  const now = Date.now();

  for (const block of blocks) {
    if (reason && block.reason !== reason) {
      continue;
    }
    await ctx.db.patch(block._id, {
      active: false,
      updatedAt: now,
      liftedAt: now,
    });
  }
}
