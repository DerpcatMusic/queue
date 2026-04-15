import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

import type { MutationCtx } from "../_generated/server";
import { mutation } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";
import { normalizeSportType } from "../lib/domainValidation";
import { safeH3Hierarchy } from "../lib/h3";
import { rebuildInstructorGeoCoverage } from "../lib/instructorGeoCoverage";
import { generateUniqueInstructorSlug } from "../lib/slug";
import {
  normalizeCoordinates,
  normalizeOptionalString,
  normalizeRequiredString,
  omitUndefined,
  trimOptionalString,
} from "../lib/validation";
import { assertRoleCanCompleteOnboarding, resolveGetOrCreateProfileAction, AppRole } from "./_shared";

const MAX_BIO_LENGTH = 1200;
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_ADDRESS_LENGTH = 220;
const MAX_SPORTS = 12;
const DEFAULT_LESSON_REMINDER_MINUTES_BEFORE = 30;

function mergeOwnedRoles(existingRoles: AppRole[] | undefined, nextRole: AppRole) {
  const roleSet = new Set<AppRole>(existingRoles ?? []);
  roleSet.add(nextRole);
  return (["instructor", "studio"] as const).filter((role) => roleSet.has(role));
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
  slug: string;
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

export const completeInstructorOnboarding = mutation({
  args: {
    displayName: v.string(),
    bio: v.optional(v.string()),
    sports: v.array(v.string()),
    address: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    expoPushToken: v.optional(v.string()),
    notificationsEnabled: v.boolean(),
    hourlyRateExpectation: v.optional(v.number()),
  },
  returns: v.object({
    instructorId: v.id("instructorProfiles"),
    slug: v.string(),
    sportsCount: v.number(),
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

    const notificationsEnabled = args.notificationsEnabled && Boolean(pushToken);
    const h3Hierarchy = safeH3Hierarchy(latitude, longitude);

    // Generate unique slug for public profile URL
    const slug = await generateUniqueInstructorSlug(requestedDisplayName, ctx);

    const profileResolution = await getOrCreateInstructorProfileWithGuard({
      ctx,
      userId: user._id,
      slug,
      create: () =>
        ctx.db.insert("instructorProfiles", {
          userId: user._id,
          displayName: requestedDisplayName,
          slug,
          ...omitUndefined({
            bio,
            expoPushToken: pushToken,
            address,
            latitude,
            longitude,
            hourlyRateExpectation: args.hourlyRateExpectation,
            h3Index: h3Hierarchy?.h3Index,
            h3Res8: h3Hierarchy?.h3Res8,
            h3Res7: h3Hierarchy?.h3Res7,
            h3Res4: h3Hierarchy?.h3Res4,
            h3Res5: h3Hierarchy?.h3Res5,
            h3Res6: h3Hierarchy?.h3Res6,
          }),
          notificationsEnabled,
          lessonReminderMinutesBefore: DEFAULT_LESSON_REMINDER_MINUTES_BEFORE,
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
          h3Index: h3Hierarchy?.h3Index,
          h3Res8: h3Hierarchy?.h3Res8,
          h3Res7: h3Hierarchy?.h3Res7,
          h3Res4: h3Hierarchy?.h3Res4,
          h3Res5: h3Hierarchy?.h3Res5,
          h3Res6: h3Hierarchy?.h3Res6,
        }),
        notificationsEnabled,
        lessonReminderMinutesBefore:
          profileResolution.profile.lessonReminderMinutesBefore ??
          DEFAULT_LESSON_REMINDER_MINUTES_BEFORE,
        calendarProvider: profileResolution.profile.calendarProvider ?? "none",
        calendarSyncEnabled: profileResolution.profile.calendarSyncEnabled ?? false,
        calendarConnectedAt: profileResolution.profile.calendarConnectedAt,
        updatedAt: now,
      });
    }

    const existingSports = await ctx.db
      .query("instructorSports")
      .withIndex("by_instructor_id", (q) => q.eq("instructorId", instructorId))
      .collect();

    await Promise.all(existingSports.map((row) => ctx.db.delete("instructorSports", row._id)));

    await Promise.all(
      sports.map((sport) =>
        ctx.db.insert("instructorSports", {
          instructorId,
          sport,
          createdAt: now,
        }),
      ),
    );
    await rebuildInstructorGeoCoverage(ctx, {
      instructorId,
      now,
    });

    await ctx.db.patch("users", user._id, {
      role: "instructor",
      roles: existingRoles,
      onboardingComplete: true,
      fullName: user.fullName ?? displayName,
      updatedAt: now,
    });

    return { instructorId, slug, sportsCount: sports.length };
  },
});
