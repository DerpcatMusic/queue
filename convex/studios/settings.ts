import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getCurrentUser as getCurrentUserDoc } from "../lib/auth";
import { normalizeSportType } from "../lib/domainValidation";
import { safeH3Hierarchy } from "../lib/h3";
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
import { DEFAULT_LESSON_REMINDER_MINUTES } from "../lib/notificationPreferences";

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

const studioBranchSummaryValidator = v.object({
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
const studioEntitlementSummaryValidator = v.object({
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

function normalizeOptionalMapMarkerColor(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized.length === 0) return undefined;
  if (!/^#[0-9A-F]{6}$/.test(normalized)) {
    throw new ConvexError("Map marker color must be a 6-digit hex color");
  }
  return normalized;
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

async function getUniqueStudioProfileByUserId(ctx: QueryCtx, userId: Doc<"users">["_id"]) {
  const profiles = await ctx.db
    .query("studioProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(2);
  if (profiles.length > 1) {
    throw new ConvexError("Multiple studio profiles found for this account");
  }
  return profiles[0] ?? null;
}

export const getMyStudioSettings = query({
  args: {},
  returns: v.union(
    v.object({
      studioId: v.id("studioProfiles"),
      studioName: v.string(),
      address: v.string(),
      addressCity: v.optional(v.string()),
      addressStreet: v.optional(v.string()),
      addressNumber: v.optional(v.string()),
      addressFloor: v.optional(v.string()),
      addressPostalCode: v.optional(v.string()),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      bio: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      notificationsEnabled: v.boolean(),
      hasExpoPushToken: v.boolean(),
      lessonReminderMinutesBefore: v.number(),
      profileImageUrl: v.optional(v.string()),
      socialLinks: v.optional(socialLinksValidator),
      autoExpireMinutesBefore: v.number(),
      autoAcceptDefault: v.optional(v.boolean()),
      mapMarkerColor: v.optional(v.string()),
      sports: v.array(v.string()),
      calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
      calendarSyncEnabled: v.boolean(),
      calendarConnectedAt: v.optional(v.number()),
      primaryBranch: v.optional(studioBranchSummaryValidator),
      branchesSummary: v.array(
        v.object({
          branchId: v.id("studioBranches"),
          name: v.string(),
          isPrimary: v.boolean(),
          status: v.union(v.literal("active"), v.literal("archived")),
        }),
      ),
      entitlement: studioEntitlementSummaryValidator,
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user || !user.isActive || user.role !== "studio") {
      return null;
    }

    const profile = await getUniqueStudioProfileByUserId(ctx, user._id);
    if (!profile) return null;
    const [primaryBranch, branches, entitlement] = await Promise.all([
      getPrimaryStudioBranch(ctx, profile._id),
      listStudioBranches(ctx, profile._id),
      getStudioEntitlement(ctx, profile._id),
    ]);

    const hasExpoPushToken = Boolean(
      trimOptionalString(primaryBranch?.expoPushToken ?? profile.expoPushToken),
    );
    const notificationsEnabled =
      Boolean(primaryBranch?.notificationsEnabled ?? profile.notificationsEnabled) &&
      hasExpoPushToken;

    const sportsRows = await ctx.db
      .query("studioSports")
      .withIndex("by_studio_id", (q) => q.eq("studioId", profile._id))
      .collect();
    const sports = [...new Set(sportsRows.map((row) => row.sport))].sort();
    const profileImageUrl = profile.logoStorageId
      ? ((await ctx.storage.getUrl(profile.logoStorageId)) ?? undefined)
      : undefined;

    return {
      studioId: profile._id,
      studioName: profile.studioName,
      address: primaryBranch?.address ?? profile.address,
      ...omitUndefined({
        bio: profile.bio,
        latitude: primaryBranch?.latitude ?? profile.latitude,
        longitude: primaryBranch?.longitude ?? profile.longitude,
        contactPhone: primaryBranch?.contactPhone ?? profile.contactPhone,
        profileImageUrl,
        socialLinks: toOptionalSocialLinksPayload(profile.socialLinks),
        mapMarkerColor: profile.mapMarkerColor,
        addressCity: profile.addressCity,
        addressStreet: profile.addressStreet,
        addressNumber: profile.addressNumber,
        addressFloor: profile.addressFloor,
        addressPostalCode: profile.addressPostalCode,
      }),
      notificationsEnabled,
      hasExpoPushToken,
      lessonReminderMinutesBefore:
        primaryBranch?.lessonReminderMinutesBefore ??
        profile.lessonReminderMinutesBefore ??
        DEFAULT_LESSON_REMINDER_MINUTES,
      autoExpireMinutesBefore:
        primaryBranch?.autoExpireMinutesBefore ?? profile.autoExpireMinutesBefore ?? 30,
      autoAcceptDefault: primaryBranch?.autoAcceptDefault ?? profile.autoAcceptDefault ?? false,
      sports,
      calendarProvider: primaryBranch?.calendarProvider ?? profile.calendarProvider ?? "none",
      calendarSyncEnabled:
        primaryBranch?.calendarSyncEnabled ?? profile.calendarSyncEnabled ?? false,
      ...(primaryBranch?.calendarConnectedAt !== undefined
        ? { calendarConnectedAt: primaryBranch.calendarConnectedAt }
        : profile.calendarConnectedAt !== undefined
          ? { calendarConnectedAt: profile.calendarConnectedAt }
          : {}),
      ...(primaryBranch
        ? {
            primaryBranch: {
              branchId: primaryBranch._id,
              name: primaryBranch.name,
              slug: primaryBranch.slug,
              address: primaryBranch.address,
              isPrimary: primaryBranch.isPrimary,
              status: primaryBranch.status,
              calendarProvider: primaryBranch.calendarProvider ?? "none",
              calendarSyncEnabled: primaryBranch.calendarSyncEnabled ?? false,
              ...omitUndefined({
                latitude: primaryBranch.latitude,
                longitude: primaryBranch.longitude,
                contactPhone: primaryBranch.contactPhone,
                notificationsEnabled: primaryBranch.notificationsEnabled,
                lessonReminderMinutesBefore: primaryBranch.lessonReminderMinutesBefore,
                autoExpireMinutesBefore: primaryBranch.autoExpireMinutesBefore,
                autoAcceptDefault: primaryBranch.autoAcceptDefault,
                calendarConnectedAt: primaryBranch.calendarConnectedAt,
              }),
            },
          }
        : {}),
      branchesSummary: branches.map((branch) => ({
        branchId: branch._id,
        name: branch.name,
        isPrimary: branch.isPrimary,
        status: branch.status,
      })),
      entitlement: {
        planKey: entitlement?.planKey ?? "free",
        maxBranches: entitlement?.maxBranches ?? 1,
        branchesFeatureEnabled: entitlement?.branchesFeatureEnabled ?? false,
        subscriptionStatus: entitlement?.subscriptionStatus ?? "active",
        activeBranchCount: branches.filter((branch) => branch.status === "active").length,
      },
    };
  },
});

export const updateMyStudioCalendarSettings = mutation({
  args: {
    calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    calendarSyncEnabled: v.boolean(),
  },
  returns: v.object({
    ok: v.boolean(),
    calendarProvider: v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    calendarSyncEnabled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    const branch = await ensurePrimaryStudioBranch(ctx, studio, now);

    const calendarProvider = args.calendarProvider;
    const calendarSyncEnabled = calendarProvider !== "none" && args.calendarSyncEnabled;
    const calendarConnectedAt =
      calendarProvider === "none" ? undefined : (branch.calendarConnectedAt ?? now);

    await ctx.db.patch("studioBranches", branch._id, {
      calendarProvider,
      calendarSyncEnabled,
      ...(calendarConnectedAt !== undefined ? { calendarConnectedAt } : {}),
      updatedAt: now,
    });
    const updatedBranch = await ctx.db.get(branch._id);
    if (updatedBranch) {
      await syncStudioProfileFromBranch(ctx, studio._id, updatedBranch, now);
    }

    return {
      ok: true,
      calendarProvider,
      calendarSyncEnabled,
    };
  },
});

export const updateMyStudioSettings = mutation({
  args: {
    studioName: v.string(),
    address: v.string(),
    addressCity: v.optional(v.string()),
    addressStreet: v.optional(v.string()),
    addressNumber: v.optional(v.string()),
    addressFloor: v.optional(v.string()),
    addressPostalCode: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    autoExpireMinutesBefore: v.optional(v.number()),
    autoAcceptDefault: v.optional(v.boolean()),
    mapMarkerColor: v.optional(v.string()),
    sports: v.optional(v.array(v.string())),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    const { branch: primaryBranch } = await ensureStudioInfrastructure(ctx, studio, now);

    const studioName = normalizeRequiredString(
      args.studioName,
      MAX_STUDIO_NAME_LENGTH,
      "Studio name",
    );
    const address = normalizeRequiredString(args.address, MAX_ADDRESS_LENGTH, "Address");
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
    const h3Hierarchy = safeH3Hierarchy(latitude, longitude);
    const mapMarkerColor = normalizeOptionalMapMarkerColor(args.mapMarkerColor);

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
        throw new ConvexError("autoExpireMinutesBefore must be 5\u2013120 in 5-min increments");
      }
      autoExpireMinutesBefore = val;
    }

    await ctx.db.patch("studioProfiles", studio._id, {
      studioName,
      address,
      ...omitUndefined({
        contactPhone,
        latitude,
        longitude,
        mapMarkerColor,
        autoExpireMinutesBefore,
        autoAcceptDefault: args.autoAcceptDefault,
        addressCity,
        addressStreet,
        addressNumber,
        addressFloor,
        addressPostalCode,
        h3Index: h3Hierarchy?.h3Index,
        h3Res8: h3Hierarchy?.h3Res8,
        h3Res4: h3Hierarchy?.h3Res4,
        h3Res5: h3Hierarchy?.h3Res5,
        h3Res6: h3Hierarchy?.h3Res6,
      }),
      updatedAt: now,
    });
    await ctx.db.patch("studioBranches", primaryBranch._id, {
      address,
      ...omitUndefined({
        contactPhone,
        latitude,
        longitude,
        autoExpireMinutesBefore,
        autoAcceptDefault: args.autoAcceptDefault,
        h3Index: h3Hierarchy?.h3Index,
        h3Res8: h3Hierarchy?.h3Res8,
        h3Res7: h3Hierarchy?.h3Res7,
        h3Res4: h3Hierarchy?.h3Res4,
        h3Res5: h3Hierarchy?.h3Res5,
        h3Res6: h3Hierarchy?.h3Res6,
      }),
      updatedAt: now,
    });

    if (args.sports) {
      const existingSports = await ctx.db
        .query("studioSports")
        .withIndex("by_studio_id", (q) => q.eq("studioId", studio._id))
        .collect();
      await Promise.all(existingSports.map((s) => ctx.db.delete("studioSports", s._id)));
      await Promise.all(
        args.sports.map((sport) =>
          ctx.db.insert("studioSports", {
            studioId: studio._id,
            sport: normalizeSportType(sport),
            createdAt: now,
          }),
        ),
      );
    }

    return {
      ok: true,
    };
  },
});

export const updateMyStudioProfileCard = mutation({
  args: {
    studioName: v.string(),
    bio: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    sports: v.array(v.string()),
    socialLinks: v.optional(socialLinksValidator),
  },
  returns: v.object({
    ok: v.boolean(),
    studioName: v.string(),
    sportsCount: v.number(),
    socialLinks: v.optional(socialLinksValidator),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    const { branch: primaryBranch } = await ensureStudioInfrastructure(ctx, studio, now);

    const studioName = normalizeRequiredString(
      args.studioName,
      MAX_STUDIO_NAME_LENGTH,
      "Studio name",
    );
    const bio = normalizeOptionalString(args.bio, MAX_PROFILE_BIO_LENGTH, "Bio");
    const contactPhone = normalizeOptionalString(
      args.contactPhone,
      MAX_PHONE_LENGTH,
      "Contact phone",
    );
    const socialLinks = normalizeSocialLinks(args.socialLinks);
    const sports = [...new Set(args.sports.map((sport) => normalizeSportType(sport)))];

    if (sports.length === 0) {
      throw new ConvexError("At least one sport is required");
    }
    if (sports.length > MAX_SPORTS) {
      throw new ConvexError("Too many sports selected");
    }

    const existingSports = await ctx.db
      .query("studioSports")
      .withIndex("by_studio_id", (q) => q.eq("studioId", studio._id))
      .collect();

    await Promise.all(existingSports.map((row) => ctx.db.delete("studioSports", row._id)));
    await Promise.all(
      sports.map((sport) =>
        ctx.db.insert("studioSports", {
          studioId: studio._id,
          sport,
          createdAt: now,
        }),
      ),
    );

    await ctx.db.patch("studioProfiles", studio._id, {
      studioName,
      bio,
      contactPhone,
      socialLinks,
      updatedAt: now,
    });
    await ctx.db.patch("studioBranches", primaryBranch._id, {
      contactPhone,
      updatedAt: now,
    });

    return {
      ok: true,
      studioName,
      sportsCount: sports.length,
      ...omitUndefined({
        socialLinks: toOptionalSocialLinksPayload(socialLinks),
      }),
    };
  },
});

export const getMyStudioNotificationSettings = query({
  args: {},
  returns: v.union(
    v.object({
      studioId: v.id("studioProfiles"),
      notificationsEnabled: v.boolean(),
      hasExpoPushToken: v.boolean(),
      lessonReminderMinutesBefore: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserDoc(ctx);
    if (!user || !user.isActive || user.role !== "studio") {
      return null;
    }

    const profile = await getUniqueStudioProfileByUserId(ctx, user._id);
    if (!profile) {
      return null;
    }
    const primaryBranch = await getPrimaryStudioBranch(ctx, profile._id);

    const hasExpoPushToken = Boolean(
      trimOptionalString(primaryBranch?.expoPushToken ?? profile.expoPushToken),
    );
    const notificationsEnabled =
      Boolean(primaryBranch?.notificationsEnabled ?? profile.notificationsEnabled) &&
      hasExpoPushToken;

    return {
      studioId: profile._id,
      notificationsEnabled,
      hasExpoPushToken,
      lessonReminderMinutesBefore: 30,
    };
  },
});

export const updateMyStudioNotificationSettings = mutation({
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
    const { studio } = await requireStudioOwnerContext(ctx);
    const { branch: primaryBranch } = await ensureStudioInfrastructure(ctx, studio, now);

    const nextPushToken = trimOptionalString(args.expoPushToken) ?? primaryBranch.expoPushToken;
    const hasExpoPushToken = Boolean(trimOptionalString(nextPushToken));
    const notificationsEnabled = args.notificationsEnabled && hasExpoPushToken;

    await ctx.db.patch("studioProfiles", studio._id, {
      ...omitUndefined({ expoPushToken: nextPushToken }),
      notificationsEnabled,
      updatedAt: now,
    });
    await ctx.db.patch("studioBranches", primaryBranch._id, {
      ...omitUndefined({ expoPushToken: nextPushToken }),
      notificationsEnabled,
      updatedAt: now,
    });

    return {
      ok: true,
      notificationsEnabled,
      hasExpoPushToken,
      lessonReminderMinutesBefore: 30,
    };
  },
});
