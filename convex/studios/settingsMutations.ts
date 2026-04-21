import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { normalizeSportType } from "../lib/domainValidation";
import {
  ensurePrimaryStudioBranch,
  ensureStudioInfrastructure,
  normalizeCoordinates,
  normalizeOptionalMapMarkerColor,
  normalizeOptionalString,
  normalizeRequiredString,
  omitUndefined,
  requireStudioOwnerContext,
  syncStudioProfileFromBranch,
  toOptionalSocialLinksPayload,
} from "./settingsShared";

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
    addressCountry: v.optional(v.string()),
    addressCountryCode: v.optional(v.string()),
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

    const studioName = normalizeRequiredString(args.studioName, 120, "Studio name");
    const address = normalizeRequiredString(args.address, 220, "Address");
    const addressCity = normalizeOptionalString(args.addressCity, 220, "AddressCity");
    const addressStreet = normalizeOptionalString(args.addressStreet, 220, "AddressStreet");
    const addressNumber = normalizeOptionalString(args.addressNumber, 20, "AddressNumber");
    const addressFloor = normalizeOptionalString(args.addressFloor, 20, "AddressFloor");
    const addressPostalCode = normalizeOptionalString(
      args.addressPostalCode,
      20,
      "AddressPostalCode",
    );
    const addressCountry = normalizeOptionalString(args.addressCountry, 120, "AddressCountry");
    const addressCountryCode = normalizeOptionalString(
      args.addressCountryCode,
      2,
      "AddressCountryCode",
    )?.toUpperCase();
    const contactPhone = normalizeOptionalString(args.contactPhone, 20, "Contact phone");
    const { latitude, longitude } = normalizeCoordinates(
      omitUndefined({
        latitude: args.latitude,
        longitude: args.longitude,
      }),
    );
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
        throw new ConvexError("autoExpireMinutesBefore must be 5–120 in 5-min increments");
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
        addressCountry,
        addressCountryCode,
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
    socialLinks: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        tiktok: v.optional(v.string()),
        whatsapp: v.optional(v.string()),
        facebook: v.optional(v.string()),
        linkedin: v.optional(v.string()),
        website: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    ok: v.boolean(),
    studioName: v.string(),
    sportsCount: v.number(),
    socialLinks: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        tiktok: v.optional(v.string()),
        whatsapp: v.optional(v.string()),
        facebook: v.optional(v.string()),
        linkedin: v.optional(v.string()),
        website: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { studio } = await requireStudioOwnerContext(ctx);
    const { branch: primaryBranch } = await ensureStudioInfrastructure(ctx, studio, now);

    const studioName = normalizeRequiredString(args.studioName, 120, "Studio name");
    const bio = normalizeOptionalString(args.bio, 280, "Bio");
    const contactPhone = normalizeOptionalString(args.contactPhone, 20, "Contact phone");
    const socialLinks = args.socialLinks ? args.socialLinks : undefined;
    const sports = [...new Set(args.sports.map((sport) => normalizeSportType(sport)))];

    if (sports.length === 0) {
      throw new ConvexError("At least one sport is required");
    }
    if (sports.length > 12) {
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

    const nextPushToken =
      normalizeOptionalString(args.expoPushToken, 500, "Expo push token") ??
      primaryBranch.expoPushToken;
    const hasExpoPushToken = Boolean(
      normalizeOptionalString(nextPushToken, 500, "Expo push token"),
    );
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
