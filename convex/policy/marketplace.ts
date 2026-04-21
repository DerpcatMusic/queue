import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  enforceStudioBillingPostingPolicy,
  ensureJobBillingPolicy,
  getJobBillingPolicy,
  readJobSettlementPolicy,
  transitionJobSettlementPolicy,
} from "./billing";
import { enforceInstructorJobAccessPolicy, enforceStudioPublishingPolicy } from "./compliance";

type Ctx = QueryCtx | MutationCtx;

export async function enforceStudioJobPostingPolicy(ctx: Ctx, studio: Doc<"studioProfiles">) {
  const [compliance] = await Promise.all([
    enforceStudioPublishingPolicy(ctx, studio),
    enforceStudioBillingPostingPolicy(ctx, studio),
  ]);
  return compliance;
}

export async function initializeJobMarketplacePolicy(ctx: MutationCtx, job: Doc<"jobs">) {
  await ensureJobBillingPolicy(ctx, job);
  return getJobBillingPolicy(job);
}

export async function enforceInstructorMarketplaceActionPolicy(
  ctx: Ctx,
  args: {
    instructor: Doc<"instructorProfiles">;
    job: Doc<"jobs">;
    actionLabel: string;
  },
) {
  return await enforceInstructorJobAccessPolicy(ctx, {
    instructor: args.instructor,
    sport: args.job.sport,
    requiredCapabilityTags: args.job.requiredCapabilityTags,
    now: Date.now(),
    actionLabel: args.actionLabel,
  });
}

export function getJobOfferCapacityPolicy(job: Doc<"jobs">) {
  return getJobBillingPolicy(job).applicationLimit;
}

export async function ensureJobCanAcceptAnotherOfferPolicy(
  _ctx: Ctx,
  args: {
    job: Doc<"jobs">;
    activeApplicationCount: number;
  },
) {
  const limit = getJobOfferCapacityPolicy(args.job);
  if (args.activeApplicationCount >= limit) {
    throw new ConvexError("This job already has the maximum number of instructor offers");
  }
  return limit;
}

export async function transitionLessonCheckInPolicy(
  ctx: MutationCtx,
  args: Parameters<typeof transitionJobSettlementPolicy>[1],
) {
  return await transitionJobSettlementPolicy(ctx, args);
}

export async function readLessonSettlementPolicy(
  ctx: Ctx,
  args: Parameters<typeof readJobSettlementPolicy>[1],
) {
  return await readJobSettlementPolicy(ctx, args);
}
