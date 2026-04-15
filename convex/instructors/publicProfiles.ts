import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
import {
  getCurrentUser as getCurrentUserDoc,
} from "../lib/auth";
import { isStripeIdentityVerified } from "../lib/stripeIdentity";
import { omitUndefined } from "../lib/validation";

async function getUniqueInstructorProfileByUserId(
  ctx: QueryCtx,
  userId: Doc<"users">["_id"],
) {
  const profiles = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(2);
  if (profiles.length > 1) {
    throw new Error("Multiple instructor profiles found for this account");
  }
  return profiles[0] ?? null;
}

export const getInstructorPublicProfileBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    // Public query — no auth required
    const profile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!profile) {
      return null;
    }

    const [sportsRows, profileImageUrl, stripeAccounts] = await Promise.all([
      ctx.db
        .query("instructorSports")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
        .collect(),
      profile.profileImageStorageId ? ctx.storage.getUrl(profile.profileImageStorageId) : null,
      ctx.db
        .query("connectedAccountsV2")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .order("desc")
        .take(10),
    ]);
    const stripeAccount = stripeAccounts.find((account) => account.provider === "stripe") ?? null;

    return {
      instructorId: profile._id,
      displayName: profile.displayName,
      sports: [...new Set(sportsRows.map((row) => row.sport))].sort(),
      isVerified: isStripeIdentityVerified(stripeAccount),
      slug: profile.slug,
      ...omitUndefined({
        bio: profile.bio,
        profileImageUrl: profileImageUrl ?? undefined,
        hourlyRateExpectation: profile.hourlyRateExpectation,
      }),
    };
  },
});

/**
 * Public query: get instructor profile redirect info by ULID.
 * Returns { slug } if found so old /profiles/instructors/[ulid] URLs
 * can redirect to the new /instructor/{slug} URL.
 */
export const getInstructorProfileRedirect = query({
  args: {
    instructorId: v.id("instructorProfiles"),
  },
  returns: v.union(
    v.null(),
    v.object({
      slug: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    // Public query — no auth required
    const profile = await ctx.db.get(args.instructorId);
    if (!profile || !profile.slug) {
      return null;
    }
    return { slug: profile.slug };
  },
});

export const getInstructorPublicProfileForInstructor = query({
  args: {
    instructorId: v.id("instructorProfiles"),
  },
  returns: v.union(
    v.null(),
    v.object({
      instructorId: v.id("instructorProfiles"),
      displayName: v.string(),
      bio: v.optional(v.string()),
      profileImageUrl: v.optional(v.string()),
      hourlyRateExpectation: v.optional(v.number()),
      sports: v.array(v.string()),
      isVerified: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user || !user.isActive || user.role !== "instructor") {
      return null;
    }

    const profile = await ctx.db.get(args.instructorId);
    if (!profile) {
      return null;
    }

    const [sportsRows, profileImageUrl, stripeAccounts] = await Promise.all([
      ctx.db
        .query("instructorSports")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", args.instructorId))
        .collect(),
      profile.profileImageStorageId ? ctx.storage.getUrl(profile.profileImageStorageId) : null,
      ctx.db
        .query("connectedAccountsV2")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .order("desc")
        .take(10),
    ]);
    const stripeAccount = stripeAccounts.find((account) => account.provider === "stripe") ?? null;

    return {
      instructorId: profile._id,
      displayName: profile.displayName,
      sports: [...new Set(sportsRows.map((row) => row.sport))].sort(),
      isVerified: isStripeIdentityVerified(stripeAccount),
      ...omitUndefined({
        bio: profile.bio,
        profileImageUrl: profileImageUrl ?? undefined,
        hourlyRateExpectation: profile.hourlyRateExpectation,
      }),
    };
  },
});