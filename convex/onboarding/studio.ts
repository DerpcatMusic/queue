import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

import type { MutationCtx } from "../_generated/server";
import { mutation } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";
import { normalizeSportType } from "../lib/domainValidation";
import { safeH3Hierarchy } from "../lib/h3";
import { generateUniqueStudioSlug } from "../lib/slug";
import { ensureStudioInfrastructure } from "../lib/studioBranches";
import {
  normalizeCoordinates,
  normalizeOptionalString,
  normalizeRequiredString,
  omitUndefined,
  trimOptionalString,
} from "../lib/validation";
import { assertRoleCanCompleteOnboarding, resolveGetOrCreateProfileAction, AppRole } from "./_shared";

const MAX_STUDIO_NAME_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 220;
const MAX_PHONE_LENGTH = 20;

function mergeOwnedRoles(existingRoles: AppRole[] | undefined, nextRole: AppRole) {
  const roleSet = new Set<AppRole>(existingRoles ?? []);
  roleSet.add(nextRole);
  return (["instructor", "studio"] as const).filter((role) => roleSet.has(role));
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
  slug: string;
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

export const completeStudioOnboarding = mutation({
  args: {
    studioName: v.string(),
    address: v.string(),
    contactPhone: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    expoPushToken: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
    logoStorageId: v.optional(v.id("_storage")),
    sports: v.array(v.string()),
  },
  returns: v.object({
    studioId: v.id("studioProfiles"),
    slug: v.string(),
  }),
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
    const h3Hierarchy = safeH3Hierarchy(latitude, longitude);

    if (args.logoStorageId !== undefined) {
      throw new ConvexError(
        "Studio logo uploads are temporarily disabled until ownership verification is implemented",
      );
    }

    // Generate unique slug for public profile URL
    const slug = await generateUniqueStudioSlug(studioName, ctx);

    const profileResolution = await getOrCreateStudioProfileWithGuard({
      ctx,
      userId: user._id,
      slug,
      create: () =>
        ctx.db.insert("studioProfiles", {
          userId: user._id,
          studioName,
          slug,
          address,
          ...omitUndefined({
            contactPhone,
            latitude,
            longitude,
            expoPushToken,
            h3Index: h3Hierarchy?.h3Index,
            h3Res8: h3Hierarchy?.h3Res8,
            h3Res7: h3Hierarchy?.h3Res7,
            h3Res4: h3Hierarchy?.h3Res4,
            h3Res5: h3Hierarchy?.h3Res5,
            h3Res6: h3Hierarchy?.h3Res6,
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
        ...omitUndefined({
          contactPhone,
          latitude,
          longitude,
          expoPushToken,
          h3Index: h3Hierarchy?.h3Index,
          h3Res8: h3Hierarchy?.h3Res8,
          h3Res7: h3Hierarchy?.h3Res7,
          h3Res4: h3Hierarchy?.h3Res4,
          h3Res5: h3Hierarchy?.h3Res5,
          h3Res6: h3Hierarchy?.h3Res6,
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

      return { studioId, slug };
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

    return { studioId, slug };
  },
});
