import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  DEFAULT_JOB_PAYMENT_GRACE_DAYS,
  DEFAULT_JOB_PAYMENT_TIMING,
  ensureJobSettlementPolicy,
  getJobApplicationLimit,
  getJobPaymentGraceDays,
  getJobPaymentTiming,
  getJobSettlementState,
  getOverdueStudioSettlementState,
  releaseStudioOperationalBlocks,
  upsertJobSettlementState,
  upsertStudioOperationalBlock,
} from "../jobs/lifecycle";
import { getActiveStudioOperationalBlock, getStudioPaymentProfile } from "../lib/studioCompliance";

type Ctx = QueryCtx | MutationCtx;

export async function getStudioBillingPolicy(ctx: Ctx, studio: Doc<"studioProfiles">) {
  const [paymentProfile, activeBlock, overdueSettlementState] = await Promise.all([
    getStudioPaymentProfile(ctx, studio._id),
    getActiveStudioOperationalBlock(ctx, studio._id),
    getOverdueStudioSettlementState(ctx, studio._id),
  ]);

  const savedPaymentMethodCount = paymentProfile?.savedPaymentMethodCount ?? 0;
  const paymentMethodReady =
    paymentProfile?.status === "ready" &&
    savedPaymentMethodCount > 0 &&
    paymentProfile.chargesEnabled !== false;
  const isSuspended = Boolean(activeBlock?.active || overdueSettlementState);

  return {
    paymentMethodReady,
    paymentProfile,
    activeBlock,
    overdueSettlementState,
    isBlocked: isSuspended,
  };
}

export async function enforceStudioBillingPostingPolicy(ctx: Ctx, studio: Doc<"studioProfiles">) {
  const policy = await getStudioBillingPolicy(ctx, studio);
  if (policy.isBlocked) {
    throw new ConvexError("Studio has an active operational payment block");
  }
  if (!policy.paymentMethodReady) {
    throw new ConvexError("Studio must add a usable payment method before posting jobs");
  }
  return policy;
}

export function getJobBillingPolicy(job: Doc<"jobs">) {
  return {
    paymentTiming: getJobPaymentTiming(job) ?? DEFAULT_JOB_PAYMENT_TIMING,
    paymentGraceDays: getJobPaymentGraceDays(job) ?? DEFAULT_JOB_PAYMENT_GRACE_DAYS,
    applicationLimit: getJobApplicationLimit(job),
  };
}

export async function ensureJobBillingPolicy(ctx: MutationCtx, job: Doc<"jobs">) {
  return await ensureJobSettlementPolicy(ctx, job);
}

export async function transitionJobSettlementPolicy(
  ctx: MutationCtx,
  args: Parameters<typeof upsertJobSettlementState>[1],
) {
  return await upsertJobSettlementState(ctx, args);
}

export async function readJobSettlementPolicy(
  ctx: Ctx,
  args: Parameters<typeof getJobSettlementState>[1],
) {
  return await getJobSettlementState(ctx, args);
}

export async function suspendStudioForOverdueBilling(
  ctx: MutationCtx,
  args: {
    studioId: Id<"studioProfiles">;
    userId: Id<"users">;
    jobId?: Id<"jobs">;
    settlementStateId?: Id<"jobSettlementStates">;
    detail?: string;
  },
) {
  return await upsertStudioOperationalBlock(ctx, {
    studioId: args.studioId,
    userId: args.userId,
    reason: "overdue_payment",
    scope: "post_jobs",
    detail: args.detail,
    triggeredByJobId: args.jobId,
    triggeredBySettlementStateId: args.settlementStateId,
  });
}

export async function releaseStudioBillingSuspension(
  ctx: MutationCtx,
  studioId: Id<"studioProfiles">,
) {
  return await releaseStudioOperationalBlocks(ctx, studioId, "overdue_payment");
}
