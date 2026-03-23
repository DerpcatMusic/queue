import { ConvexError, v } from "convex/values";
import { type Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { normalizeZoneId } from "./lib/domainValidation";
import {
  assertStudioCanCreateAnotherBranch,
  createStudioBranch as createStudioBranchRecord,
  ensureStudioInfrastructure,
  getPrimaryStudioBranch,
  getStudioEntitlement,
  listStudioBranches,
  requireAccessibleStudioBranch,
  requireStudioOwnerContext,
  resolveUniqueStudioBranchSlug,
  syncStudioProfileFromBranch,
} from "./lib/studioBranches";
import {
  normalizeCoordinates,
  normalizeOptionalString,
  normalizeRequiredString,
  omitUndefined,
} from "./lib/validation";

const MAX_BRANCH_NAME_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 220;
const MAX_PHONE_LENGTH = 20;

function normalizeBranchUpdateArgs(args: {
  name: string;
  address: string;
  zone: string;
  contactPhone?: string;
  latitude?: number;
  longitude?: number;
  autoExpireMinutesBefore?: number;
  autoAcceptDefault?: boolean;
}) {
  const name = normalizeRequiredString(args.name, MAX_BRANCH_NAME_LENGTH, "Branch name");
  const address = normalizeRequiredString(args.address, MAX_ADDRESS_LENGTH, "Address");
  const zone = normalizeZoneId(args.zone);
  const contactPhone = normalizeOptionalString(
    args.contactPhone,
    MAX_PHONE_LENGTH,
    "Contact phone",
  );
  const { latitude, longitude } = normalizeCoordinates(
    omitUndefined({
      latitude: args.latitude,
      longitude: args.longitude,
    }),
  );
  let autoExpireMinutesBefore: number | undefined;
  if (args.autoExpireMinutesBefore !== undefined) {
    const val = args.autoExpireMinutesBefore;
    if (
      !Number.isFinite(val) ||
      !Number.isInteger(val) ||
      val < 5 ||
      val > 120 ||
      val % 5 !== 0
    ) {
      throw new ConvexError("autoExpireMinutesBefore must be 5–120 in 5-min increments");
    }
    autoExpireMinutesBefore = val;
  }
  return {
    name,
    address,
    zone,
    contactPhone,
    latitude,
    longitude,
    autoExpireMinutesBefore,
    autoAcceptDefault: args.autoAcceptDefault,
  };
}

function toBranchPayload(branch: Doc<"studioBranches">) {
  return {
    branchId: branch._id,
    studioId: branch.studioId,
    name: branch.name,
    slug: branch.slug,
    address: branch.address,
    zone: branch.zone,
    isPrimary: branch.isPrimary,
    status: branch.status,
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
    ...omitUndefined({
      latitude: branch.latitude,
      longitude: branch.longitude,
      contactPhone: branch.contactPhone,
      notificationsEnabled: branch.notificationsEnabled,
      autoExpireMinutesBefore: branch.autoExpireMinutesBefore,
      autoAcceptDefault: branch.autoAcceptDefault,
      calendarProvider: branch.calendarProvider ?? "none",
      calendarSyncEnabled: branch.calendarSyncEnabled ?? false,
      calendarConnectedAt: branch.calendarConnectedAt,
    }),
  };
}

export const getMyStudioBranches = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      branchId: v.id("studioBranches"),
      studioId: v.id("studioProfiles"),
      name: v.string(),
      slug: v.string(),
      address: v.string(),
      zone: v.string(),
      isPrimary: v.boolean(),
      status: v.union(v.literal("active"), v.literal("archived")),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      contactPhone: v.optional(v.string()),
      notificationsEnabled: v.optional(v.boolean()),
      autoExpireMinutesBefore: v.optional(v.number()),
      autoAcceptDefault: v.optional(v.boolean()),
      calendarProvider: v.optional(
        v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
      ),
      calendarSyncEnabled: v.optional(v.boolean()),
      calendarConnectedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const { studio } = await requireStudioOwnerContext(ctx);
    const branches = await listStudioBranches(
      ctx,
      studio._id,
      args.includeArchived ? undefined : "active",
    );
    return branches.map(toBranchPayload);
  },
});

export const getMyPrimaryStudioBranch = query({
  args: {},
  returns: v.union(
    v.object({
      branchId: v.id("studioBranches"),
      studioId: v.id("studioProfiles"),
      name: v.string(),
      slug: v.string(),
      address: v.string(),
      zone: v.string(),
      isPrimary: v.boolean(),
      status: v.union(v.literal("active"), v.literal("archived")),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      contactPhone: v.optional(v.string()),
      notificationsEnabled: v.optional(v.boolean()),
      autoExpireMinutesBefore: v.optional(v.number()),
      autoAcceptDefault: v.optional(v.boolean()),
      calendarProvider: v.optional(
        v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
      ),
      calendarSyncEnabled: v.optional(v.boolean()),
      calendarConnectedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const { studio } = await requireStudioOwnerContext(ctx);
    const branch = await getPrimaryStudioBranch(ctx, studio._id);
    return branch ? toBranchPayload(branch) : null;
  },
});

export const getStudioBranchEntitlementStatus = query({
  args: {},
  returns: v.object({
    planKey: v.union(v.literal("free"), v.literal("growth"), v.literal("custom")),
    maxBranches: v.number(),
    branchesFeatureEnabled: v.boolean(),
    subscriptionStatus: v.union(
      v.literal("active"),
      v.literal("trialing"),
      v.literal("past_due"),
      v.literal("canceled"),
    ),
    activeBranchCount: v.number(),
  }),
  handler: async (ctx) => {
    const { studio } = await requireStudioOwnerContext(ctx);
    const [entitlement, activeBranches] = await Promise.all([
      getStudioEntitlement(ctx, studio._id),
      listStudioBranches(ctx, studio._id, "active"),
    ]);
    return {
      planKey: entitlement?.planKey ?? "free",
      maxBranches: entitlement?.maxBranches ?? 1,
      branchesFeatureEnabled: entitlement?.branchesFeatureEnabled ?? false,
      subscriptionStatus: entitlement?.subscriptionStatus ?? "active",
      activeBranchCount: activeBranches.length,
    };
  },
});

export const createStudioBranch = mutation({
  args: {
    name: v.string(),
    address: v.string(),
    zone: v.string(),
    contactPhone: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    autoExpireMinutesBefore: v.optional(v.number()),
    autoAcceptDefault: v.optional(v.boolean()),
  },
  returns: v.object({
    branchId: v.id("studioBranches"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    await ensureStudioInfrastructure(ctx, studio, now);
    await assertStudioCanCreateAnotherBranch(ctx, studio._id);
    const normalized = normalizeBranchUpdateArgs(args);
    const branch = await createStudioBranchRecord(ctx, {
      studioId: studio._id,
      name: normalized.name,
      address: normalized.address,
      zone: normalized.zone,
      isPrimary: false,
      status: "active",
      now,
      ...omitUndefined({
        contactPhone: normalized.contactPhone,
        latitude: normalized.latitude,
        longitude: normalized.longitude,
        autoExpireMinutesBefore: normalized.autoExpireMinutesBefore,
        autoAcceptDefault: normalized.autoAcceptDefault,
      }),
    });
    return { branchId: branch._id };
  },
});

export const updateStudioBranch = mutation({
  args: {
    branchId: v.id("studioBranches"),
    name: v.string(),
    address: v.string(),
    zone: v.string(),
    contactPhone: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    autoExpireMinutesBefore: v.optional(v.number()),
    autoAcceptDefault: v.optional(v.boolean()),
  },
  returns: v.object({
    ok: v.boolean(),
    branchId: v.id("studioBranches"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    const { branch } = await requireAccessibleStudioBranch(ctx, {
      studioId: studio._id,
      branchId: args.branchId,
      allowedRoles: ["owner"],
    });
    const normalized = normalizeBranchUpdateArgs(args);
    const slug = await resolveUniqueStudioBranchSlug(ctx, studio._id, normalized.name, branch._id);
    await ctx.db.patch(branch._id, {
      ...normalized,
      slug,
      updatedAt: now,
    });
    const updatedBranch = await ctx.db.get(branch._id);
    if (!updatedBranch) {
      throw new ConvexError("Studio branch not found");
    }
    if (updatedBranch.isPrimary) {
      await syncStudioProfileFromBranch(ctx, studio._id, updatedBranch, now);
    }
    return { ok: true, branchId: branch._id };
  },
});

export const updateStudioBranchCalendarSettings = mutation({
  args: {
    branchId: v.id("studioBranches"),
    calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    calendarSyncEnabled: v.boolean(),
  },
  returns: v.object({
    ok: v.boolean(),
    branchId: v.id("studioBranches"),
    calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    calendarSyncEnabled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    const { branch } = await requireAccessibleStudioBranch(ctx, {
      studioId: studio._id,
      branchId: args.branchId,
      allowedRoles: ["owner"],
    });
    const calendarSyncEnabled = args.calendarProvider !== "none" && args.calendarSyncEnabled;
    await ctx.db.patch(branch._id, {
      calendarProvider: args.calendarProvider,
      calendarSyncEnabled,
      calendarConnectedAt:
        args.calendarProvider === "none" ? undefined : (branch.calendarConnectedAt ?? now),
      updatedAt: now,
    });
    const updatedBranch = await ctx.db.get(branch._id);
    if (updatedBranch?.isPrimary) {
      await syncStudioProfileFromBranch(ctx, studio._id, updatedBranch, now);
    }
    return {
      ok: true,
      branchId: branch._id,
      calendarProvider: args.calendarProvider,
      calendarSyncEnabled,
    };
  },
});

export const archiveStudioBranch = mutation({
  args: {
    branchId: v.id("studioBranches"),
  },
  returns: v.object({
    ok: v.boolean(),
    branchId: v.id("studioBranches"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    const { branch } = await requireAccessibleStudioBranch(ctx, {
      studioId: studio._id,
      branchId: args.branchId,
      allowedRoles: ["owner"],
    });
    if (branch.isPrimary) {
      throw new ConvexError("Cannot archive the primary branch");
    }
    const activeBranches = await listStudioBranches(ctx, studio._id, "active");
    if (activeBranches.length <= 1) {
      throw new ConvexError("Cannot archive the last active branch");
    }
    const openJobs = await ctx.db
      .query("jobs")
      .withIndex("by_branch_postedAt", (q) => q.eq("branchId", branch._id))
      .collect();
    if (openJobs.some((job) => job.status === "open")) {
      throw new ConvexError("Cannot archive a branch with open jobs");
    }
    await ctx.db.patch(branch._id, {
      status: "archived",
      updatedAt: now,
    });
    return { ok: true, branchId: branch._id };
  },
});

export const setPrimaryStudioBranch = mutation({
  args: {
    branchId: v.id("studioBranches"),
  },
  returns: v.object({
    ok: v.boolean(),
    branchId: v.id("studioBranches"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    const { branch } = await requireAccessibleStudioBranch(ctx, {
      studioId: studio._id,
      branchId: args.branchId,
      allowedRoles: ["owner"],
    });
    if (branch.status !== "active") {
      throw new ConvexError("Only active branches can be primary");
    }
    const currentPrimary = await getPrimaryStudioBranch(ctx, studio._id);
    if (currentPrimary && currentPrimary._id !== branch._id) {
      await ctx.db.patch(currentPrimary._id, {
        isPrimary: false,
        updatedAt: now,
      });
    }
    await ctx.db.patch(branch._id, {
      isPrimary: true,
      updatedAt: now,
    });
    const updatedBranch = await ctx.db.get(branch._id);
    if (!updatedBranch) {
      throw new ConvexError("Studio branch not found");
    }
    await syncStudioProfileFromBranch(ctx, studio._id, updatedBranch, now);
    return { ok: true, branchId: branch._id };
  },
});
