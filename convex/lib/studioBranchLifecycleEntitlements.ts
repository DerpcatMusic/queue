import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const DEFAULT_STUDIO_BRANCH_LIMIT = 1;
export const DEFAULT_STUDIO_PLAN_KEY = "free";
export const DEFAULT_STUDIO_SUBSCRIPTION_STATUS = "active";

export async function getStudioEntitlement(ctx: MutationCtx, studioId: Id<"studioProfiles">) {
  return await ctx.db
    .query("studioEntitlements")
    .withIndex("by_studio_id", (q) => q.eq("studioId", studioId))
    .unique();
}

export async function ensureStudioEntitlement(
  ctx: MutationCtx,
  studioId: Id<"studioProfiles">,
  now = Date.now(),
) {
  const existing = await getStudioEntitlement(ctx, studioId);
  if (existing) return existing;
  const entitlementId = await ctx.db.insert("studioEntitlements", {
    studioId,
    planKey: DEFAULT_STUDIO_PLAN_KEY,
    maxBranches: DEFAULT_STUDIO_BRANCH_LIMIT,
    branchesFeatureEnabled: false,
    subscriptionStatus: DEFAULT_STUDIO_SUBSCRIPTION_STATUS,
    effectiveAt: now,
    updatedAt: now,
  });
  const created = await ctx.db.get(entitlementId);
  if (!created) {
    throw new ConvexError("Failed to create studio entitlement");
  }
  return created;
}

export async function assertStudioCanCreateAnotherBranch(
  ctx: MutationCtx,
  studioId: Id<"studioProfiles">,
) {
  const entitlement = await getStudioEntitlement(ctx, studioId);
  const activeBranches = await ctx.db
    .query("studioBranches")
    .withIndex("by_studio_active", (q) => q.eq("studioId", studioId).eq("status", "active"))
    .collect();
  const maxBranches = entitlement?.maxBranches ?? DEFAULT_STUDIO_BRANCH_LIMIT;
  const branchesFeatureEnabled = entitlement?.branchesFeatureEnabled ?? false;
  if (!branchesFeatureEnabled && activeBranches.length >= 1) {
    throw new ConvexError("BRANCH_LIMIT_REACHED");
  }
  if (activeBranches.length >= maxBranches) {
    throw new ConvexError("BRANCH_LIMIT_REACHED");
  }
  return {
    activeBranchCount: activeBranches.length,
    maxBranches,
    branchesFeatureEnabled,
    planKey: entitlement?.planKey ?? DEFAULT_STUDIO_PLAN_KEY,
    subscriptionStatus: entitlement?.subscriptionStatus ?? DEFAULT_STUDIO_SUBSCRIPTION_STATUS,
  };
}
