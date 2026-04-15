import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
import { getCurrentUser as getCurrentUserDoc } from "../lib/auth";
import {
  getPrimaryStudioBranch,
  listStudioBranches,
} from "../lib/studioBranches";
import { omitUndefined } from "../lib/validation";

const publicStudioBranchValidator = v.object({
  branchId: v.id("studioBranches"),
  studioId: v.id("studioProfiles"),
  name: v.string(),
  address: v.string(),
  isPrimary: v.boolean(),
  status: v.union(v.literal("active"), v.literal("archived")),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  contactPhone: v.optional(v.string()),
});

export const getStudioPublicProfileBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    // Public query — no auth required
    const studio = await ctx.db
      .query("studioProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!studio) {
      return null;
    }

    const [sportsRows, branches, profileImageUrl, primaryBranch] = await Promise.all([
      ctx.db
        .query("studioSports")
        .withIndex("by_studio_id", (q) => q.eq("studioId", studio._id))
        .collect(),
      ctx.db
        .query("studioBranches")
        .withIndex("by_studio_id", (q) => q.eq("studioId", studio._id))
        .collect(),
      studio.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
      ctx.db
        .query("studioBranches")
        .withIndex("by_studio_primary", (q) => q.eq("studioId", studio._id).eq("isPrimary", true))
        .first(),
    ]);

    return {
      studioId: studio._id,
      studioName: studio.studioName,
      address: primaryBranch?.address ?? studio.address,
      sports: [...new Set(sportsRows.map((row) => row.sport))].sort(),
      branches: branches.map((branch) => ({
        branchId: branch._id,
        studioId: branch.studioId,
        name: branch.name,
        address: branch.address,
        isPrimary: branch.isPrimary,
        status: branch.status,
        ...omitUndefined({
          latitude: branch.latitude,
          longitude: branch.longitude,
          contactPhone: branch.contactPhone,
        }),
      })),
      slug: studio.slug,
      isVerified: studio.diditVerificationStatus === "approved",
      ...omitUndefined({
        bio: studio.bio,
        profileImageUrl: profileImageUrl ?? undefined,
        contactPhone: primaryBranch?.contactPhone ?? studio.contactPhone,
      }),
    };
  },
});

export const getStudioPublicProfileForInstructor = query({
  args: {
    studioId: v.id("studioProfiles"),
  },
  returns: v.union(
    v.null(),
    v.object({
      studioId: v.id("studioProfiles"),
      studioName: v.string(),
      address: v.string(),
      bio: v.optional(v.string()),
      profileImageUrl: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      mapMarkerColor: v.optional(v.string()),
      sports: v.array(v.string()),
      branches: v.array(publicStudioBranchValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user || !user.isActive || user.role !== "instructor") {
      return null;
    }

    const studio = await ctx.db.get(args.studioId);
    if (!studio) {
      return null;
    }

    const [sportsRows, branches, profileImageUrl, primaryBranch] = await Promise.all([
      ctx.db
        .query("studioSports")
        .withIndex("by_studio_id", (q) => q.eq("studioId", args.studioId))
        .collect(),
      listStudioBranches(ctx, args.studioId, "active"),
      studio.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
      getPrimaryStudioBranch(ctx, args.studioId),
    ]);

    return {
      studioId: studio._id,
      studioName: studio.studioName,
      address: primaryBranch?.address ?? studio.address,
      sports: [...new Set(sportsRows.map((row) => row.sport))].sort(),
      branches: branches.map((branch) => ({
        branchId: branch._id,
        studioId: branch.studioId,
        name: branch.name,
        address: branch.address,
        isPrimary: branch.isPrimary,
        status: branch.status,
        ...omitUndefined({
          latitude: branch.latitude,
          longitude: branch.longitude,
          contactPhone: branch.contactPhone,
        }),
      })),
      ...omitUndefined({
        bio: studio.bio,
        profileImageUrl: profileImageUrl ?? undefined,
        contactPhone: primaryBranch?.contactPhone ?? studio.contactPhone,
        mapMarkerColor: studio.mapMarkerColor,
      }),
    };
  },
});

/**
 * Public query: get studio profile redirect info by ULID.
 * Returns { slug } if found so old /profiles/studios/[ulid] URLs
 * can redirect to the new /studio/[slug] URL.
 */
export const getStudioProfileRedirect = query({
  args: {
    studioId: v.id("studioProfiles"),
  },
  returns: v.union(
    v.null(),
    v.object({
      slug: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    // Public query — no auth required
    const studio = await ctx.db.get(args.studioId);
    if (!studio || !studio.slug) {
      return null;
    }
    return { slug: studio.slug };
  },
});
