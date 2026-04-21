import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireCurrentUser, requireUserRole } from "./auth";

type Ctx = QueryCtx | MutationCtx;

export type StudioMembershipRole = Doc<"studioMemberships">["role"];

export const DEFAULT_STUDIO_BRANCH_LIMIT = 1;
export const DEFAULT_STUDIO_PLAN_KEY = "free";
export const DEFAULT_STUDIO_SUBSCRIPTION_STATUS = "active";
export const DEFAULT_BRANCH_STATUS = "active";

export async function getStudioMembership(
  ctx: Ctx,
  studioId: Id<"studioProfiles">,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("studioMemberships")
    .withIndex("by_studio_user", (q) => q.eq("studioId", studioId).eq("userId", userId))
    .unique();
}

export async function requireStudioMembership(
  ctx: Ctx,
  args: {
    studioId: Id<"studioProfiles">;
    userId?: Id<"users">;
    allowedRoles?: StudioMembershipRole[];
  },
) {
  const user = args.userId ? await ctx.db.get(args.userId) : await requireCurrentUser(ctx);
  if (!user?.isActive) {
    throw new ConvexError("Authentication required");
  }
  const membership = await getStudioMembership(ctx, args.studioId, user._id);
  if (!membership || membership.status !== "active") {
    throw new ConvexError("Not authorized for this studio");
  }
  if (args.allowedRoles && !args.allowedRoles.includes(membership.role)) {
    throw new ConvexError("Not authorized for this studio role");
  }
  const studio = await ctx.db.get(args.studioId);
  if (!studio) {
    throw new ConvexError("Studio profile not found");
  }
  return { user, studio, membership };
}

export async function requireStudioOwnerMembership(
  ctx: Ctx,
  studioId: Id<"studioProfiles">,
  userId?: Id<"users">,
) {
  return await requireStudioMembership(ctx, {
    studioId,
    allowedRoles: ["owner"],
    ...(userId ? { userId } : {}),
  });
}

export async function getPrimaryStudioBranch(ctx: Ctx, studioId: Id<"studioProfiles">) {
  const primary = await ctx.db
    .query("studioBranches")
    .withIndex("by_studio_primary", (q) => q.eq("studioId", studioId).eq("isPrimary", true))
    .unique();
  if (primary) return primary;
  return await ctx.db
    .query("studioBranches")
    .withIndex("by_studio_active", (q) => q.eq("studioId", studioId).eq("status", "active"))
    .first();
}

export async function requirePrimaryStudioBranch(ctx: Ctx, studioId: Id<"studioProfiles">) {
  const branch = await getPrimaryStudioBranch(ctx, studioId);
  if (!branch) {
    throw new ConvexError("Primary studio branch not found");
  }
  return branch;
}

export async function listStudioBranches(
  ctx: Ctx,
  studioId: Id<"studioProfiles">,
  status?: Doc<"studioBranches">["status"],
) {
  const branches = status
    ? await ctx.db
        .query("studioBranches")
        .withIndex("by_studio_active", (q) => q.eq("studioId", studioId).eq("status", status))
        .collect()
    : await ctx.db
        .query("studioBranches")
        .withIndex("by_studio_id", (q) => q.eq("studioId", studioId))
        .collect();
  return [...branches].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

export async function requireAccessibleStudioBranch(
  ctx: Ctx,
  args: {
    studioId: Id<"studioProfiles">;
    branchId: Id<"studioBranches">;
    allowedRoles?: StudioMembershipRole[];
    userId?: Id<"users">;
  },
) {
  const membershipResult = await requireStudioMembership(ctx, {
    studioId: args.studioId,
    ...(args.userId ? { userId: args.userId } : {}),
    ...(args.allowedRoles ? { allowedRoles: args.allowedRoles } : {}),
  });
  const branch = await ctx.db.get(args.branchId);
  if (!branch || branch.studioId !== args.studioId) {
    throw new ConvexError("Studio branch not found");
  }
  if (membershipResult.membership.role === "branch_manager") {
    const allowedBranchIds = new Set((membershipResult.membership.branchIds ?? []).map(String));
    if (!allowedBranchIds.has(String(branch._id))) {
      throw new ConvexError("Not authorized for this branch");
    }
  }
  return { ...membershipResult, branch };
}

export async function requireStudioOwnerContext(ctx: any) {
  const user = await requireUserRole(ctx, ["studio"]);
  const studios = await ctx.db
    .query("studioProfiles")
    .withIndex("by_user_id", (q: any) => q.eq("userId", user._id))
    .take(2);
  if (studios.length > 1) {
    throw new ConvexError("Multiple studio profiles found for this account");
  }
  const studio = studios[0];
  if (!studio) {
    throw new ConvexError("Studio profile not found");
  }
  const membership = await getStudioMembership(ctx, studio._id, user._id);
  if (!membership || membership.status !== "active" || membership.role !== "owner") {
    throw new ConvexError("Studio owner membership not found");
  }
  return { user, studio, membership };
}
