import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireCurrentUser, requireUserRole } from "./auth";
import { safeH3Hierarchy } from "./h3";
import { omitUndefined, trimOptionalString } from "./validation";

type Ctx = QueryCtx | MutationCtx;

export const DEFAULT_STUDIO_BRANCH_LIMIT = 1;
export const DEFAULT_STUDIO_PLAN_KEY = "free";
export const DEFAULT_STUDIO_SUBSCRIPTION_STATUS = "active";
export const DEFAULT_BRANCH_STATUS = "active";

export type StudioMembershipRole = Doc<"studioMemberships">["role"];

function slugifyBranchName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized.length > 0 ? normalized : "branch";
}

export async function resolveUniqueStudioBranchSlug(
  ctx: Ctx,
  studioId: Id<"studioProfiles">,
  name: string,
  excludeBranchId?: Id<"studioBranches">,
) {
  const baseSlug = slugifyBranchName(name);
  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const existing = await ctx.db
      .query("studioBranches")
      .withIndex("by_studio_slug", (q) => q.eq("studioId", studioId).eq("slug", candidate))
      .unique();
    if (!existing || existing._id === excludeBranchId) {
      return candidate;
    }
  }
  throw new ConvexError("Unable to generate a unique branch slug");
}

export function buildDefaultBranchName(studio: Pick<Doc<"studioProfiles">, "studioName">) {
  return trimOptionalString(studio.studioName) ?? "Main branch";
}

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
  if (!user || !user.isActive) {
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

export async function getStudioEntitlement(ctx: Ctx, studioId: Id<"studioProfiles">) {
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

export async function ensureStudioOwnerMembership(
  ctx: MutationCtx,
  studio: Pick<Doc<"studioProfiles">, "_id" | "userId">,
  now = Date.now(),
) {
  const existing = await getStudioMembership(ctx, studio._id, studio.userId);
  if (existing) {
    if (existing.role !== "owner" || existing.status !== "active") {
      await ctx.db.patch(existing._id, {
        role: "owner",
        status: "active",
        updatedAt: now,
      });
      const refreshed = await ctx.db.get(existing._id);
      if (refreshed) return refreshed;
    } else {
      return existing;
    }
  }

  const membershipId = await ctx.db.insert("studioMemberships", {
    studioId: studio._id,
    userId: studio.userId,
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  const created = await ctx.db.get(membershipId);
  if (!created) {
    throw new ConvexError("Failed to create studio membership");
  }
  return created;
}

export async function createStudioBranch(
  ctx: MutationCtx,
  args: {
    studioId: Id<"studioProfiles">;
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
    contactPhone?: string;
    expoPushToken?: string;
    notificationsEnabled?: boolean;
    autoExpireMinutesBefore?: number;
    autoAcceptDefault?: boolean;
    calendarProvider?: Doc<"studioBranches">["calendarProvider"];
    calendarSyncEnabled?: boolean;
    calendarConnectedAt?: number;
    isPrimary?: boolean;
    status?: Doc<"studioBranches">["status"];
    now?: number;
  },
) {
  const now = args.now ?? Date.now();
  const slug = await resolveUniqueStudioBranchSlug(ctx, args.studioId, args.name);
  const h3Hierarchy = safeH3Hierarchy(args.latitude, args.longitude);
  const branchId = await ctx.db.insert("studioBranches", {
    studioId: args.studioId,
    name: args.name,
    slug,
    address: args.address,
    isPrimary: args.isPrimary ?? false,
    status: args.status ?? DEFAULT_BRANCH_STATUS,
    createdAt: now,
    updatedAt: now,
    ...omitUndefined({
      latitude: args.latitude,
      longitude: args.longitude,
      h3Index: h3Hierarchy?.h3Index,
      h3Res8: h3Hierarchy?.h3Res8,
      h3Res7: h3Hierarchy?.h3Res7,
      h3Res4: h3Hierarchy?.h3Res4,
      h3Res5: h3Hierarchy?.h3Res5,
      h3Res6: h3Hierarchy?.h3Res6,
      contactPhone: args.contactPhone,
      expoPushToken: args.expoPushToken,
      notificationsEnabled: args.notificationsEnabled,
      autoExpireMinutesBefore: args.autoExpireMinutesBefore,
      autoAcceptDefault: args.autoAcceptDefault,
      calendarProvider: args.calendarProvider,
      calendarSyncEnabled: args.calendarSyncEnabled,
      calendarConnectedAt: args.calendarConnectedAt,
    }),
  });
  const branch = await ctx.db.get(branchId);
  if (!branch) {
    throw new ConvexError("Failed to create studio branch");
  }
  return branch;
}

export async function ensurePrimaryStudioBranch(
  ctx: MutationCtx,
  studio: Pick<
    Doc<"studioProfiles">,
    | "_id"
    | "studioName"
    | "address"
    | "latitude"
    | "longitude"
    | "h3Index"
    | "h3Res8"
    | "h3Res7"
    | "h3Res4"
    | "h3Res5"
    | "h3Res6"
    | "contactPhone"
    | "expoPushToken"
    | "notificationsEnabled"
    | "autoExpireMinutesBefore"
    | "autoAcceptDefault"
    | "calendarProvider"
    | "calendarSyncEnabled"
    | "calendarConnectedAt"
  >,
  now = Date.now(),
) {
  const existing = await getPrimaryStudioBranch(ctx, studio._id);
  if (existing) {
    return existing;
  }
  return await createStudioBranch(ctx, {
    studioId: studio._id,
    name: buildDefaultBranchName(studio),
    address: studio.address,
    isPrimary: true,
    status: "active",
    calendarProvider: studio.calendarProvider ?? "none",
    calendarSyncEnabled: studio.calendarSyncEnabled ?? false,
    now,
    ...omitUndefined({
      latitude: studio.latitude,
      longitude: studio.longitude,
      h3Index: studio.h3Index,
      h3Res8: studio.h3Res8,
      h3Res7: studio.h3Res7,
      h3Res4: studio.h3Res4,
      h3Res5: studio.h3Res5,
      h3Res6: studio.h3Res6,
      contactPhone: studio.contactPhone,
      expoPushToken: studio.expoPushToken,
      notificationsEnabled: studio.notificationsEnabled,
      autoExpireMinutesBefore: studio.autoExpireMinutesBefore,
      autoAcceptDefault: studio.autoAcceptDefault,
      calendarConnectedAt: studio.calendarConnectedAt,
    }),
  });
}

export async function ensureStudioInfrastructure(
  ctx: MutationCtx,
  studio: Pick<
    Doc<"studioProfiles">,
    | "_id"
    | "userId"
    | "studioName"
    | "address"
    | "latitude"
    | "longitude"
    | "h3Index"
    | "h3Res8"
    | "h3Res7"
    | "h3Res4"
    | "h3Res5"
    | "h3Res6"
    | "contactPhone"
    | "expoPushToken"
    | "notificationsEnabled"
    | "autoExpireMinutesBefore"
    | "autoAcceptDefault"
    | "calendarProvider"
    | "calendarSyncEnabled"
    | "calendarConnectedAt"
  >,
  now = Date.now(),
) {
  const [branch, membership, entitlement] = await Promise.all([
    ensurePrimaryStudioBranch(ctx, studio, now),
    ensureStudioOwnerMembership(ctx, studio, now),
    ensureStudioEntitlement(ctx, studio._id, now),
  ]);
  return { branch, membership, entitlement };
}

export async function syncStudioProfileFromBranch(
  ctx: MutationCtx,
  studioId: Id<"studioProfiles">,
  branch: Pick<
    Doc<"studioBranches">,
    | "address"
    | "latitude"
    | "longitude"
    | "h3Index"
    | "h3Res8"
    | "h3Res7"
    | "h3Res4"
    | "h3Res5"
    | "h3Res6"
    | "contactPhone"
    | "expoPushToken"
    | "notificationsEnabled"
    | "autoExpireMinutesBefore"
    | "autoAcceptDefault"
    | "calendarProvider"
    | "calendarSyncEnabled"
    | "calendarConnectedAt"
  >,
  now = Date.now(),
) {
  await ctx.db.patch(studioId, {
    address: branch.address,
    updatedAt: now,
    ...omitUndefined({
      latitude: branch.latitude,
      longitude: branch.longitude,
      h3Index: branch.h3Index,
      h3Res8: branch.h3Res8,
      h3Res7: branch.h3Res7,
      h3Res4: branch.h3Res4,
      h3Res5: branch.h3Res5,
      h3Res6: branch.h3Res6,
      contactPhone: branch.contactPhone,
      expoPushToken: branch.expoPushToken,
      notificationsEnabled: branch.notificationsEnabled,
      autoExpireMinutesBefore: branch.autoExpireMinutesBefore,
      autoAcceptDefault: branch.autoAcceptDefault,
      calendarProvider: branch.calendarProvider,
      calendarSyncEnabled: branch.calendarSyncEnabled,
      calendarConnectedAt: branch.calendarConnectedAt,
    }),
  });
}

export async function assertStudioCanCreateAnotherBranch(ctx: Ctx, studioId: Id<"studioProfiles">) {
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

export async function requireStudioOwnerContext(ctx: Ctx) {
  const user = await requireUserRole(ctx, ["studio"]);
  const studios = await ctx.db
    .query("studioProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
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
