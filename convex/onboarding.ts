import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

import type { MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { requireCurrentUser } from "./lib/auth";
import { normalizeSportType, normalizeZoneId } from "./lib/domainValidation";
import { rebuildInstructorCoverage } from "./lib/instructorCoverage";
import { ensureStudioInfrastructure } from "./lib/studioBranches";
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
type AppRole = "instructor" | "studio";

function mergeOwnedRoles(existingRoles: AppRole[] | undefined, nextRole: AppRole) {
  const roleSet = new Set<AppRole>(existingRoles ?? []);
  roleSet.add(nextRole);
  return (["instructor", "studio"] as const).filter((role) => roleSet.has(role));
}

export function assertRoleCanCompleteOnboarding(user: Doc<"users">, targetRole: AppRole) {
  const activeRole = user.role;
  const oppositeRole: AppRole = targetRole === "instructor" ? "studio" : "instructor";

  if (activeRole === oppositeRole && user.onboardingComplete) {
    throw new ConvexError(
      `This account is already set up as a ${oppositeRole}. Sign out and use another account for a separate ${targetRole} account.`,
    );
  }
}

export function resolveGetOrCreateProfileAction(
  profileCount: number,
  profileType: "instructor" | "studio",
) {
  if (!Number.isInteger(profileCount) || profileCount < 0) {
    throw new ConvexError("Invalid profile count");
  }
  if (profileCount > 1) {
    throw new ConvexError(`Multiple ${profileType} profiles found for this account`);
  }
  return profileCount === 0 ? "create" : "reuse";
}

async function getUniqueInstructorProfileByUserId(ctx: MutationCtx, userId: Doc<"users">["_id"]) {
  const profiles = await ctx.db
    .query("instructorProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(2);
  resolveGetOrCreateProfileAction(profiles.length, "instructor");
  return profiles[0] ?? null;
}

async function getOrCreateInstructorProfileWithGuard(args: {
  ctx: MutationCtx;
  userId: Doc<"users">["_id"];
  create: () => Promise<Doc<"instructorProfiles">["_id"]>;
}) {
  const existingProfile = await getUniqueInstructorProfileByUserId(args.ctx, args.userId);
  if (existingProfile) {
    return { profile: existingProfile, created: false as const };
  }
  const profileId = await args.create();
  const created = await args.ctx.db.get("instructorProfiles", profileId);
  if (!created) {
    throw new ConvexError("Failed to create instructor profile");
  }
  return { profile: created, created: true as const };
}

async function getUniqueStudioProfileByUserId(ctx: MutationCtx, userId: Doc<"users">["_id"]) {
  const profiles = await ctx.db
    .query("studioProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(2);
  resolveGetOrCreateProfileAction(profiles.length, "studio");
  return profiles[0] ?? null;
}

async function getOrCreateStudioProfileWithGuard(args: {
  ctx: MutationCtx;
  userId: Doc<"users">["_id"];
  create: () => Promise<Doc<"studioProfiles">["_id"]>;
}) {
  const existingProfile = await getUniqueStudioProfileByUserId(args.ctx, args.userId);
  if (existingProfile) {
    return { profile: existingProfile, created: false as const };
  }
  const profileId = await args.create();
  const created = await args.ctx.db.get("studioProfiles", profileId);
  if (!created) {
    throw new ConvexError("Failed to create studio profile");
  }
  return { profile: created, created: true as const };
}

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
    assertRoleCanCompleteOnboarding(user, "instructor");
    const existingRoles = mergeOwnedRoles(user.roles, "instructor");

    const requestedDisplayName = normalizeRequiredString(
      args.displayName,
      MAX_DISPLAY_NAME_LENGTH,
      "Display name",
    );
    const address = normalizeOptionalString(args.address, MAX_ADDRESS_LENGTH, "Address");
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

    const profileResolution = await getOrCreateInstructorProfileWithGuard({
      ctx,
      userId: user._id,
      create: () =>
        ctx.db.insert("instructorProfiles", {
          userId: user._id,
          displayName: requestedDisplayName,
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
        }),
    });
    const existingProfile = profileResolution.created ? null : profileResolution.profile;
    const verifiedLegalName =
      existingProfile?.diditVerificationStatus === "approved"
        ? trimOptionalString(existingProfile.diditLegalName)
        : undefined;
    const displayName = verifiedLegalName ?? requestedDisplayName;
    const instructorId = profileResolution.profile._id;

    if (!profileResolution.created) {
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
        calendarProvider: profileResolution.profile.calendarProvider ?? "none",
        calendarSyncEnabled: profileResolution.profile.calendarSyncEnabled ?? false,
        calendarConnectedAt: profileResolution.profile.calendarConnectedAt,
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
      roles: existingRoles,
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
    sports: v.array(v.string()),
  },
  returns: v.id("studioProfiles"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireCurrentUser(ctx);
    assertRoleCanCompleteOnboarding(user, "studio");
    const existingRoles = mergeOwnedRoles(user.roles, "studio");

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

    if (args.logoStorageId !== undefined) {
      throw new ConvexError(
        "Studio logo uploads are temporarily disabled until ownership verification is implemented",
      );
    }

    const profileResolution = await getOrCreateStudioProfileWithGuard({
      ctx,
      userId: user._id,
      create: () =>
        ctx.db.insert("studioProfiles", {
          userId: user._id,
          studioName,
          address,
          zone,
          ...omitUndefined({
            contactPhone,
            latitude,
            longitude,
            expoPushToken,
          }),
          notificationsEnabled,
          calendarProvider: "none",
          calendarSyncEnabled: false,
          createdAt: now,
          updatedAt: now,
        }),
    });
    const studioId = profileResolution.profile._id;

    if (!profileResolution.created) {
      await ctx.db.patch("studioProfiles", studioId, {
        studioName,
        address,
        zone,
        ...omitUndefined({
          contactPhone,
          latitude,
          longitude,
          expoPushToken,
        }),
        notificationsEnabled,
        calendarProvider: profileResolution.profile.calendarProvider ?? "none",
        calendarSyncEnabled: profileResolution.profile.calendarSyncEnabled ?? false,
        calendarConnectedAt: profileResolution.profile.calendarConnectedAt,
        updatedAt: now,
      });
      await ensureStudioInfrastructure(
        ctx,
        {
          ...profileResolution.profile,
          studioName,
          address,
          zone,
          notificationsEnabled,
          ...omitUndefined({
            contactPhone,
            latitude,
            longitude,
            expoPushToken,
          }),
        },
        now,
      );

      const existingSports = await ctx.db
        .query("studioSports")
        .withIndex("by_studio_id", (q) => q.eq("studioId", studioId))
        .collect();
      await Promise.all(existingSports.map((s) => ctx.db.delete("studioSports", s._id)));
      await Promise.all(
        args.sports.map((sport) =>
          ctx.db.insert("studioSports", {
            studioId,
            sport: normalizeSportType(sport),
            createdAt: now,
          }),
        ),
      );

      await ctx.db.patch("users", user._id, {
        role: "studio",
        roles: existingRoles,
        onboardingComplete: true,
        updatedAt: now,
      });

      return studioId;
    }

    await Promise.all(
      args.sports.map((sport) =>
        ctx.db.insert("studioSports", {
          studioId,
          sport: normalizeSportType(sport),
          createdAt: now,
        }),
      ),
    );
    await ensureStudioInfrastructure(ctx, profileResolution.profile, now);

    await ctx.db.patch("users", user._id, {
      role: "studio",
      roles: existingRoles,
      onboardingComplete: true,
      updatedAt: now,
    });

    return studioId;
  },
});
