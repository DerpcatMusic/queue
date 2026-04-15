import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// ============ Constants ============
export const MAX_SPORTS = 12;
export const MAX_STUDIO_NAME_LENGTH = 120;
export const MAX_ADDRESS_LENGTH = 220;
export const MAX_PHONE_LENGTH = 20;
export const MAX_PROFILE_BIO_LENGTH = 280;
export const MAX_SOCIAL_LINK_LENGTH = 220;

// ============ Validators & Types ============
const SOCIAL_LINK_KEYS = [
  "instagram",
  "tiktok",
  "whatsapp",
  "facebook",
  "linkedin",
  "website",
] as const;
export const socialLinksValidator = v.object({
  instagram: v.optional(v.string()),
  tiktok: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
  facebook: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  website: v.optional(v.string()),
});
export const appRoleValidator = v.union(v.literal("instructor"), v.literal("studio"));
export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];
export type SocialLinksValue = Partial<Record<SocialLinkKey, string>>;
export type AppRole = "instructor" | "studio";

// ============ Shared Helpers ============
export function normalizeEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const value = email.trim().toLowerCase();
  return value.length > 0 ? value : undefined;
}

export function mergeOwnedRoles(
  seededRoles: AppRole[],
  userRole: Doc<"users">["role"],
  discoveredRoles?: Partial<Record<AppRole, boolean>>,
) {
  const roleSet = new Set<AppRole>(seededRoles);

  if (userRole === "instructor" || userRole === "studio") {
    roleSet.add(userRole);
  }
  if (discoveredRoles?.instructor) {
    roleSet.add("instructor");
  }
  if (discoveredRoles?.studio) {
    roleSet.add("studio");
  }

  return (["instructor", "studio"] as const).filter((role) => roleSet.has(role));
}

export type UserProfileCtx = QueryCtx | MutationCtx;

export async function getUniqueInstructorProfileByUserId(
  ctx: UserProfileCtx,
  userId: Doc<"users">["_id"],
) {
  const profiles = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(2);
  if (profiles.length > 1) {
    throw new ConvexError("Multiple instructor profiles found for this account");
  }
  return profiles[0] ?? null;
}

export async function getUniqueStudioProfileByUserId(ctx: UserProfileCtx, userId: Doc<"users">["_id"]) {
  const profiles = await ctx.db
    .query("studioProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(2);
  if (profiles.length > 1) {
    throw new ConvexError("Multiple studio profiles found for this account");
  }
  return profiles[0] ?? null;
}

export async function resolveOwnedRoles(ctx: UserProfileCtx, user: Doc<"users">) {
  const seededRoles = (user.roles ?? []).filter(
    (role): role is AppRole => role === "instructor" || role === "studio",
  );

  const [instructorProfile, studioProfile] = await Promise.all([
    getUniqueInstructorProfileByUserId(ctx, user._id),
    getUniqueStudioProfileByUserId(ctx, user._id),
  ]);

  return mergeOwnedRoles(seededRoles, user.role, {
    instructor: instructorProfile !== null,
    studio: studioProfile !== null,
  });
}