import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import {
  getCurrentUser as getCurrentUserDoc,
  requireUserRole,
} from "../lib/auth";
import { normalizeSportType } from "../lib/domainValidation";
import { safeH3Hierarchy } from "../lib/h3";
import { rebuildInstructorGeoCoverage } from "../lib/instructorGeoCoverage";
import { DEFAULT_WORK_RADIUS_KM, normalizeWorkRadiusKm } from "../lib/locationRadius";
import { isStripeIdentityVerified } from "../lib/stripeIdentity";
import {
  normalizeCoordinates,
  normalizeOptionalString,
  normalizeRequiredString,
  omitUndefined,
  trimOptionalString,
} from "../lib/validation";

const MAX_SPORTS = 12;
const MAX_STUDIO_NAME_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 220;
const MAX_PHONE_LENGTH = 20;
const MAX_PROFILE_BIO_LENGTH = 280;
const MAX_SOCIAL_LINK_LENGTH = 220;
const LESSON_REMINDER_MINUTES_OPTIONS = [15, 30, 45, 60] as const;
const SOCIAL_LINK_KEYS = [
  "instagram",
  "tiktok",
  "whatsapp",
  "facebook",
  "linkedin",
  "website",
] as const;
const socialLinksValidator = v.object({
  instagram: v.optional(v.string()),
  tiktok: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
  facebook: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  website: v.optional(v.string()),
});

type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];
type SocialLinksValue = Partial<Record<SocialLinkKey, string>>;

function normalizeLessonReminderMinutes(value: number) {
  if (
    !LESSON_REMINDER_MINUTES_OPTIONS.includes(
      value as (typeof LESSON_REMINDER_MINUTES_OPTIONS)[number],
    )
  ) {
    throw new ConvexError("lessonReminderMinutesBefore must be one of 15, 30, 45, or 60");
  }
  return value;
}

function normalizeSocialLinks(socialLinks: SocialLinksValue | undefined): SocialLinksValue {
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

function toOptionalSocialLinksPayload(
  socialLinks: SocialLinksValue | undefined,
): SocialLinksValue | undefined {
  if (!socialLinks) {
    return undefined;
  }

  return Object.keys(socialLinks).length > 0 ? socialLinks : undefined;
}

type UserProfileCtx = QueryCtx | MutationCtx;

async function getUniqueInstructorProfileByUserId(
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

async function requireInstructorProfileByUserId(ctx: UserProfileCtx, userId: Doc<"users">["_id"]) {
  const profile = await getUniqueInstructorProfileByUserId(ctx, userId);
  if (!profile) {
    throw new ConvexError("Instructor profile not found");
  }
  return profile;
}

export const getMyInstructorSettings = query({
  args: {},
  returns: v.union(
    v.object({
      instructorId: v.id("instructorProfiles"),
      displayName: v.string(),
      bio: v.optional(v.string()),
      notificationsEnabled: v.boolean(),
      hasExpoPushToken: v.boolean(),
      lessonReminderMinutesBefore: v.number(),
      hourlyRateExpectation: v.optional(v.number()),
      sports: v.array(v.string()),
      profileImageUrl: v.optional(v.string()),
      socialLinks: v.optional(socialLinksValidator),
      address: v.optional(v.string()),
      addressCity: v.optional(v.string()),
      addressStreet: v.optional(v.string()),
      addressNumber: v.optional(v.string()),
      addressFloor: v.optional(v.string()),
      addressPostalCode: v.optional(v.string()),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      workRadiusKm: v.optional(v.number()),
      calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
      calendarSyncEnabled: v.boolean(),
      calendarConnectedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user || !user.isActive || user.role !== "instructor") {
      return null;
    }

    const profile = await getUniqueInstructorProfileByUserId(ctx, user._id);
    if (!profile) return null;

    const sportsRows = await ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
      .collect();

    const sports = [...new Set(sportsRows.map((row) => row.sport))].sort();
    const profileImageUrl = profile.profileImageStorageId
      ? ((await ctx.storage.getUrl(profile.profileImageStorageId)) ?? undefined)
      : undefined;

    return {
      instructorId: profile._id,
      displayName: profile.displayName,
      notificationsEnabled: profile.notificationsEnabled,
      hasExpoPushToken: Boolean(profile.expoPushToken),
      lessonReminderMinutesBefore: profile.lessonReminderMinutesBefore ?? 30,
      sports,
      ...omitUndefined({
        bio: profile.bio,
        hourlyRateExpectation: profile.hourlyRateExpectation,
        profileImageUrl,
        socialLinks: toOptionalSocialLinksPayload(profile.socialLinks),
        address: profile.address,
        addressCity: profile.addressCity,
        addressStreet: profile.addressStreet,
        addressNumber: profile.addressNumber,
        addressFloor: profile.addressFloor,
        addressPostalCode: profile.addressPostalCode,
        latitude: profile.latitude,
        longitude: profile.longitude,
      }),
      calendarProvider: profile.calendarProvider ?? "none",
      calendarSyncEnabled: profile.calendarSyncEnabled ?? false,
      workRadiusKm: profile.workRadiusKm ?? DEFAULT_WORK_RADIUS_KM,
      ...omitUndefined({ calendarConnectedAt: profile.calendarConnectedAt }),
    };
  },
});

export const updateMyInstructorSettings = mutation({
  args: {
    notificationsEnabled: v.boolean(),
    expoPushToken: v.optional(v.string()),
    lessonReminderMinutesBefore: v.optional(v.number()),
    hourlyRateExpectation: v.optional(v.number()),
    sports: v.array(v.string()),
    address: v.optional(v.string()),
    addressCity: v.optional(v.string()),
    addressStreet: v.optional(v.string()),
    addressNumber: v.optional(v.string()),
    addressFloor: v.optional(v.string()),
    addressPostalCode: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    workRadiusKm: v.optional(v.number()),
    includeDetectedZone: v.optional(v.boolean()),
    calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    calendarSyncEnabled: v.boolean(),
  },
  returns: v.object({
    ok: v.boolean(),
    sportsCount: v.number(),
    notificationsEnabled: v.boolean(),
    calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    calendarSyncEnabled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireUserRole(ctx, ["instructor"]);

    const profile = await requireInstructorProfileByUserId(ctx, user._id);

    if (
      args.hourlyRateExpectation !== undefined &&
      (!Number.isFinite(args.hourlyRateExpectation) || args.hourlyRateExpectation <= 0)
    ) {
      throw new ConvexError("hourlyRateExpectation must be greater than 0");
    }

    const sports = [...new Set(args.sports.map((sport) => normalizeSportType(sport)))];
    if (sports.length === 0) {
      throw new ConvexError("At least one sport is required");
    }
    if (sports.length > MAX_SPORTS) {
      throw new ConvexError("Too many sports selected");
    }
    const address = normalizeOptionalString(args.address, MAX_ADDRESS_LENGTH, "Address");
    const addressCity = normalizeOptionalString(
      args.addressCity,
      MAX_ADDRESS_LENGTH,
      "AddressCity",
    );
    const addressStreet = normalizeOptionalString(
      args.addressStreet,
      MAX_ADDRESS_LENGTH,
      "AddressStreet",
    );
    const addressNumber = normalizeOptionalString(args.addressNumber, 20, "AddressNumber");
    const addressFloor = normalizeOptionalString(args.addressFloor, 20, "AddressFloor");
    const addressPostalCode = normalizeOptionalString(
      args.addressPostalCode,
      20,
      "AddressPostalCode",
    );
    const workRadiusKm = normalizeWorkRadiusKm(args.workRadiusKm ?? profile.workRadiusKm);
    const { latitude, longitude } = normalizeCoordinates(
      omitUndefined({
        latitude: args.latitude,
        longitude: args.longitude,
      }),
    );
    const h3Hierarchy = safeH3Hierarchy(latitude, longitude);
    const nextPushToken =
      trimOptionalString(args.expoPushToken) ?? trimOptionalString(profile.expoPushToken);
    const nextHasExpoPushToken = Boolean(nextPushToken);
    const notificationsEnabled = args.notificationsEnabled && nextHasExpoPushToken;
    const lessonReminderMinutesBefore =
      args.lessonReminderMinutesBefore !== undefined
        ? normalizeLessonReminderMinutes(args.lessonReminderMinutesBefore)
        : (profile.lessonReminderMinutesBefore ?? 30);

    const calendarProvider = args.calendarProvider;
    const calendarSyncEnabled = calendarProvider !== "none" && args.calendarSyncEnabled;
    const calendarConnectedAt =
      calendarProvider === "none" ? undefined : (profile.calendarConnectedAt ?? now);

    const existingSports = await ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
      .collect();

    await Promise.all(existingSports.map((row) => ctx.db.delete("instructorSports", row._id)));
    await Promise.all(
      sports.map((sport) =>
        ctx.db.insert("instructorSports", {
          instructorId: profile._id,
          sport,
          createdAt: now,
        }),
      ),
    );

    await ctx.db.patch("instructorProfiles", profile._id, {
      notificationsEnabled,
      lessonReminderMinutesBefore,
      ...omitUndefined({
        expoPushToken: nextPushToken,
        hourlyRateExpectation: args.hourlyRateExpectation,
        address,
        addressCity,
        addressStreet,
        addressNumber,
        addressFloor,
        addressPostalCode,
        latitude,
        longitude,
        workRadiusKm,
        h3Index: h3Hierarchy?.h3Index,
        h3Res8: h3Hierarchy?.h3Res8,
        h3Res7: h3Hierarchy?.h3Res7,
        h3Res4: h3Hierarchy?.h3Res4,
        h3Res5: h3Hierarchy?.h3Res5,
        h3Res6: h3Hierarchy?.h3Res6,
      }),
      calendarProvider,
      calendarSyncEnabled,
      ...(calendarConnectedAt !== undefined ? { calendarConnectedAt } : {}),
      updatedAt: now,
    });
    await rebuildInstructorGeoCoverage(ctx, {
      instructorId: profile._id,
      now,
    });

    return {
      ok: true,
      sportsCount: sports.length,
      notificationsEnabled,
      calendarProvider,
      calendarSyncEnabled,
    };
  },
});

export const updateMyInstructorNotificationSettings = mutation({
  args: {
    notificationsEnabled: v.boolean(),
    expoPushToken: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    notificationsEnabled: v.boolean(),
    hasExpoPushToken: v.boolean(),
    lessonReminderMinutesBefore: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireUserRole(ctx, ["instructor"]);
    const profile = await requireInstructorProfileByUserId(ctx, user._id);

    const nextPushToken =
      trimOptionalString(args.expoPushToken) ?? trimOptionalString(profile.expoPushToken);
    const hasExpoPushToken = Boolean(nextPushToken);
    const notificationsEnabled = args.notificationsEnabled && hasExpoPushToken;
    const lessonReminderMinutesBefore = profile.lessonReminderMinutesBefore ?? 30;

    await ctx.db.patch("instructorProfiles", profile._id, {
      notificationsEnabled,
      ...omitUndefined({
        expoPushToken: nextPushToken,
      }),
      updatedAt: now,
    });

    return {
      ok: true,
      notificationsEnabled,
      hasExpoPushToken,
      lessonReminderMinutesBefore,
    };
  },
});

export const updateMyInstructorProfileCard = mutation({
  args: {
    displayName: v.string(),
    bio: v.optional(v.string()),
    sports: v.array(v.string()),
    socialLinks: v.optional(socialLinksValidator),
  },
  returns: v.object({
    ok: v.boolean(),
    displayName: v.string(),
    sportsCount: v.number(),
    socialLinks: v.optional(socialLinksValidator),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireUserRole(ctx, ["instructor"]);
    const profile = await requireInstructorProfileByUserId(ctx, user._id);

    const displayName = normalizeRequiredString(
      args.displayName,
      MAX_STUDIO_NAME_LENGTH,
      "Display name",
    );
    const bio = normalizeOptionalString(args.bio, MAX_PROFILE_BIO_LENGTH, "Bio");
    const socialLinks = normalizeSocialLinks(args.socialLinks);
    const sports = [...new Set(args.sports.map((sport) => normalizeSportType(sport)))];

    if (sports.length === 0) {
      throw new ConvexError("At least one sport is required");
    }
    if (sports.length > MAX_SPORTS) {
      throw new ConvexError("Too many sports selected");
    }

    const existingSports = await ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
      .collect();

    await Promise.all(existingSports.map((row) => ctx.db.delete("instructorSports", row._id)));
    await Promise.all(
      sports.map((sport) =>
        ctx.db.insert("instructorSports", {
          instructorId: profile._id,
          sport,
          createdAt: now,
        }),
      ),
    );

    await ctx.db.patch("instructorProfiles", profile._id, {
      displayName,
      bio,
      socialLinks,
      updatedAt: now,
    });
    await rebuildInstructorGeoCoverage(ctx, {
      instructorId: profile._id,
      now,
    });

    return {
      ok: true,
      displayName,
      sportsCount: sports.length,
      ...omitUndefined({
        socialLinks: toOptionalSocialLinksPayload(socialLinks),
      }),
    };
  },
});