import { ConvexError, v } from "convex/values";

import { mutation } from "./_generated/server";
import { requireCurrentUser } from "./lib/auth";
import { normalizeSportType, normalizeZoneId } from "./lib/domainValidation";
import { rebuildInstructorCoverage } from "./lib/instructorCoverage";
import {
  normalizeCoordinates,
  normalizeOptionalString,
  normalizeRequiredString,
  omitUndefined,
  trimOptionalString,
} from "./lib/validation";

const MAX_BIO_LENGTH = 1200;
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_STUDIO_NAME_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 220;
const MAX_PHONE_LENGTH = 20;
const MAX_SPORTS = 12;
const MAX_ZONES = 25;

export const completeInstructorOnboarding = mutation({
  args: {
    displayName: v.string(),
    bio: v.optional(v.string()),
    sports: v.array(v.string()),
    zones: v.array(v.string()),
    address: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    expoPushToken: v.optional(v.string()),
    notificationsEnabled: v.boolean(),
    hourlyRateExpectation: v.optional(v.number()),
  },
  returns: v.object({
    instructorId: v.id("instructorProfiles"),
    sportsCount: v.number(),
    zonesCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireCurrentUser(ctx);

    if (user.role !== "pending" && user.role !== "instructor") {
      throw new ConvexError("Only instructor users can complete this flow");
    }

    const displayName = normalizeRequiredString(
      args.displayName,
      MAX_DISPLAY_NAME_LENGTH,
      "Display name",
    );
    const address = normalizeOptionalString(
      args.address,
      MAX_ADDRESS_LENGTH,
      "Address",
    );
    const { latitude, longitude } = normalizeCoordinates(
      omitUndefined({
        latitude: args.latitude,
        longitude: args.longitude,
      }),
    );
    const bio = normalizeOptionalString(args.bio, MAX_BIO_LENGTH, "Bio");
    const pushToken = trimOptionalString(args.expoPushToken);

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

    const zones = [...new Set(args.zones.map((zone) => normalizeZoneId(zone)))];
    if (zones.length === 0) {
      throw new ConvexError("At least one zone is required");
    }
    if (zones.length > MAX_ZONES) {
      throw new ConvexError("Too many zones selected");
    }

    const notificationsEnabled = args.notificationsEnabled && Boolean(pushToken);

    const existingProfile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    const instructorId = existingProfile
      ? existingProfile._id
      : await ctx.db.insert("instructorProfiles", {
          userId: user._id,
          displayName,
          ...omitUndefined({
            bio,
            expoPushToken: pushToken,
            address,
            latitude,
            longitude,
            hourlyRateExpectation: args.hourlyRateExpectation,
          }),
          notificationsEnabled,
          calendarProvider: "none",
          calendarSyncEnabled: false,
          createdAt: now,
          updatedAt: now,
        });

    if (existingProfile) {
      await ctx.db.patch("instructorProfiles", instructorId, {
        displayName,
        ...omitUndefined({
          bio,
          expoPushToken: pushToken,
          address,
          latitude,
          longitude,
          hourlyRateExpectation: args.hourlyRateExpectation,
        }),
        notificationsEnabled,
        calendarProvider: existingProfile.calendarProvider ?? "none",
        calendarSyncEnabled: existingProfile.calendarSyncEnabled ?? false,
        calendarConnectedAt: existingProfile.calendarConnectedAt,
        updatedAt: now,
      });
    }

    const [existingSports, existingZones] = await Promise.all([
      ctx.db
        .query("instructorSports")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
        .collect(),
      ctx.db
        .query("instructorZones")
        .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
        .collect(),
    ]);

    await Promise.all([
      ...existingSports.map((row) => ctx.db.delete("instructorSports", row._id)),
      ...existingZones.map((row) => ctx.db.delete("instructorZones", row._id)),
    ]);

    await Promise.all([
      ...sports.map((sport) =>
        ctx.db.insert("instructorSports", {
          instructorId,
          sport,
          createdAt: now,
        }),
      ),
      ...zones.map((zone) =>
        ctx.db.insert("instructorZones", {
          instructorId,
          zone,
          createdAt: now,
        }),
      ),
    ]);

    await ctx.db.patch("users", user._id, {
      role: "instructor",
      onboardingComplete: true,
      fullName: user.fullName ?? displayName,
      updatedAt: now,
    });

    await rebuildInstructorCoverage(ctx, instructorId);

    return { instructorId, sportsCount: sports.length, zonesCount: zones.length };
  },
});

export const completeStudioOnboarding = mutation({
  args: {
    studioName: v.string(),
    address: v.string(),
    zone: v.string(),
    contactPhone: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    expoPushToken: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
    logoStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("studioProfiles"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireCurrentUser(ctx);

    if (user.role !== "pending" && user.role !== "studio") {
      throw new ConvexError("Only studio users can complete this flow");
    }

    const studioName = normalizeRequiredString(
      args.studioName,
      MAX_STUDIO_NAME_LENGTH,
      "Studio name",
    );
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
    const expoPushToken = trimOptionalString(args.expoPushToken);
    const notificationsEnabled = Boolean(args.notificationsEnabled && expoPushToken);

    const existingProfile = await ctx.db
      .query("studioProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    if (existingProfile) {
      await ctx.db.patch("studioProfiles", existingProfile._id, {
        studioName,
        address,
        zone,
        ...omitUndefined({
          contactPhone,
          latitude,
          longitude,
          expoPushToken,
          logoStorageId: args.logoStorageId,
        }),
        notificationsEnabled,
        updatedAt: now,
      });

      await ctx.db.patch("users", user._id, {
        role: "studio",
        onboardingComplete: true,
        updatedAt: now,
      });

      return existingProfile._id;
    }

    const studioId = await ctx.db.insert("studioProfiles", {
      userId: user._id,
      studioName,
      address,
      zone,
      ...omitUndefined({
        contactPhone,
        latitude,
        longitude,
        expoPushToken,
        logoStorageId: args.logoStorageId,
      }),
      notificationsEnabled,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch("users", user._id, {
      role: "studio",
      onboardingComplete: true,
      updatedAt: now,
    });

    return studioId;
  },
});
