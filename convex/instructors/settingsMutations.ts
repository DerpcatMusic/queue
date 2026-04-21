import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireUserRole } from "../lib/auth";
import {
  normalizeOptionalString,
  normalizeRequiredString,
  omitUndefined,
  trimOptionalString,
} from "../lib/validation";
import {
  MAX_ADDRESS_LENGTH,
  MAX_PROFILE_BIO_LENGTH,
  MAX_SPORTS,
  MAX_STUDIO_NAME_LENGTH,
  normalizeCoordinates,
  normalizeLessonReminderMinutes,
  normalizeSocialLinks,
  normalizeSportType,
  normalizeWorkRadiusKm,
  rebuildInstructorGeoCoverage,
  requireInstructorProfileByUserId,
  safeH3Hierarchy,
  socialLinksValidator,
  toOptionalSocialLinksPayload,
} from "./settingsShared";

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
    addressCountry: v.optional(v.string()),
    addressCountryCode: v.optional(v.string()),
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

    const existingSportsRows = await ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", profile._id))
      .collect();
    const existingSports = [...new Set(existingSportsRows.map((row) => row.sport))];
    const selectedSports = [...new Set(args.sports.map((sport) => normalizeSportType(sport)))];
    const sports = selectedSports.length > 0 ? selectedSports : existingSports;
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
    const addressCountry = normalizeOptionalString(args.addressCountry, 120, "AddressCountry");
    const addressCountryCode = normalizeOptionalString(
      args.addressCountryCode?.toUpperCase(),
      2,
      "AddressCountryCode",
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

    await Promise.all(existingSportsRows.map((row) => ctx.db.delete("instructorSports", row._id)));
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
        addressCountry,
        addressCountryCode,
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
