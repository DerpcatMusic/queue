import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { normalizeSportType } from "../lib/domainValidation";
import { safeH3Hierarchy } from "../lib/h3";
import { rebuildInstructorGeoCoverage } from "../lib/instructorGeoCoverage";
import { DEFAULT_WORK_RADIUS_KM, normalizeWorkRadiusKm } from "../lib/locationRadius";
import {
  normalizeCoordinates,
  normalizeOptionalString,
  normalizeRequiredString,
} from "../lib/validation";

export const MAX_SPORTS = 12;
export const MAX_STUDIO_NAME_LENGTH = 120;
export const MAX_ADDRESS_LENGTH = 220;
export const MAX_PROFILE_BIO_LENGTH = 280;
export const MAX_SOCIAL_LINK_LENGTH = 220;
export const LESSON_REMINDER_MINUTES_OPTIONS = [15, 30, 45, 60] as const;
export const SOCIAL_LINK_KEYS = [
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

export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];
export type SocialLinksValue = Partial<Record<SocialLinkKey, string>>;
export type UserProfileCtx = QueryCtx | MutationCtx;

export function normalizeLessonReminderMinutes(value: number) {
  if (
    !LESSON_REMINDER_MINUTES_OPTIONS.includes(
      value as (typeof LESSON_REMINDER_MINUTES_OPTIONS)[number],
    )
  ) {
    throw new ConvexError("lessonReminderMinutesBefore must be one of 15, 30, 45, or 60");
  }
  return value;
}

export function normalizeSocialLinks(socialLinks: SocialLinksValue | undefined): SocialLinksValue {
  const normalized: SocialLinksValue = {};

  for (const key of SOCIAL_LINK_KEYS) {
    const value = normalizeOptionalString(
      socialLinks?.[key],
      MAX_SOCIAL_LINK_LENGTH,
      `${key} link`,
    );
    if (value) {
      normalized[key] = value;
    }
  }

  return normalized;
}

export function toOptionalSocialLinksPayload(
  socialLinks: SocialLinksValue | undefined,
): SocialLinksValue | undefined {
  if (!socialLinks) {
    return undefined;
  }

  return Object.keys(socialLinks).length > 0 ? socialLinks : undefined;
}

export async function getUniqueInstructorProfileByUserId(ctx: UserProfileCtx, userId: string) {
  const profiles = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(2);
  if (profiles.length > 1) {
    throw new ConvexError("Multiple instructor profiles found for this account");
  }
  return profiles[0] ?? null;
}

export async function requireInstructorProfileByUserId(ctx: UserProfileCtx, userId: string) {
  const profile = await getUniqueInstructorProfileByUserId(ctx, userId);
  if (!profile) {
    throw new ConvexError("Instructor profile not found");
  }
  return profile;
}

export {
  DEFAULT_WORK_RADIUS_KM,
  normalizeCoordinates,
  normalizeRequiredString,
  normalizeSportType,
  normalizeWorkRadiusKm,
  rebuildInstructorGeoCoverage,
  safeH3Hierarchy,
};
