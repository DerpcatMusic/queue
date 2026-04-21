import { v } from "convex/values";
import { query } from "../_generated/server";
import { getCurrentUser as getCurrentUserDoc } from "../lib/auth";
import { DEFAULT_LESSON_REMINDER_MINUTES } from "../lib/notificationPreferences";
import { omitUndefined } from "../lib/validation";
import {
  getPrimaryStudioBranch,
  getStudioEntitlement,
  getUniqueStudioProfileByUserId,
  listStudioBranches,
  socialLinksValidator,
  studioBranchSummaryValidator,
  studioEntitlementSummaryValidator,
  toOptionalSocialLinksPayload,
  trimOptionalString,
} from "./settingsShared";

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
      addressCountry: v.optional(v.string()),
      addressCountryCode: v.optional(v.string()),
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
    if (!user?.isActive || user.role !== "studio") {
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
        addressCountry: profile.addressCountry,
        addressCountryCode: profile.addressCountryCode,
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
    if (!user?.isActive || user.role !== "studio") {
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
