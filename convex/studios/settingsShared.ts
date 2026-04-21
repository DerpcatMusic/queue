import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { normalizeSportType } from "../lib/domainValidation";
import { DEFAULT_LESSON_REMINDER_MINUTES } from "../lib/notificationPreferences";
import {
  ensurePrimaryStudioBranch,
  ensureStudioInfrastructure,
  getPrimaryStudioBranch,
  getStudioEntitlement,
  listStudioBranches,
  requireStudioOwnerContext,
  syncStudioProfileFromBranch,
} from "../lib/studioBranches";
import {
  normalizeCoordinates,
  normalizeOptionalString,
  normalizeRequiredString,
  omitUndefined,
  trimOptionalString,
} from "../lib/validation";

export const MAX_SPORTS = 12;
export const MAX_STUDIO_NAME_LENGTH = 120;
export const MAX_ADDRESS_LENGTH = 220;
export const MAX_PHONE_LENGTH = 20;
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

export const studioBranchSummaryValidator = v.object({
  branchId: v.id("studioBranches"),
  name: v.string(),
  slug: v.string(),
  address: v.string(),
  isPrimary: v.boolean(),
  status: v.union(v.literal("active"), v.literal("archived")),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  contactPhone: v.optional(v.string()),
  notificationsEnabled: v.optional(v.boolean()),
  lessonReminderMinutesBefore: v.optional(v.number()),
  autoExpireMinutesBefore: v.optional(v.number()),
  autoAcceptDefault: v.optional(v.boolean()),
  calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
  calendarSyncEnabled: v.boolean(),
  calendarConnectedAt: v.optional(v.number()),
});

export const studioEntitlementSummaryValidator = v.object({
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
});

export const publicStudioBranchValidator = v.object({
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

type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];
export type SocialLinksValue = Partial<Record<SocialLinkKey, string>>;

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

export function normalizeOptionalMapMarkerColor(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized.length === 0) return undefined;
  if (!/^#[0-9A-F]{6}$/.test(normalized)) {
    throw new ConvexError("Map marker color must be a 6-digit hex color");
  }
  return normalized;
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

export async function getUniqueStudioProfileByUserId(ctx: QueryCtx, userId: Doc<"users">["_id"]) {
  const profiles = await ctx.db
    .query("studioProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(2);
  if (profiles.length > 1) {
    throw new ConvexError("Multiple studio profiles found for this account");
  }
  return profiles[0] ?? null;
}

export {
  DEFAULT_LESSON_REMINDER_MINUTES,
  ensurePrimaryStudioBranch,
  ensureStudioInfrastructure,
  getPrimaryStudioBranch,
  getStudioEntitlement,
  listStudioBranches,
  normalizeCoordinates,
  normalizeOptionalString,
  normalizeRequiredString,
  normalizeSportType,
  omitUndefined,
  requireStudioOwnerContext,
  syncStudioProfileFromBranch,
  trimOptionalString,
};
