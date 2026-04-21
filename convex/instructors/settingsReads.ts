import { v } from "convex/values";
import { query } from "../_generated/server";
import { getCurrentUser as getCurrentUserDoc } from "../lib/auth";
import { omitUndefined } from "../lib/validation";
import {
  DEFAULT_WORK_RADIUS_KM,
  getUniqueInstructorProfileByUserId,
  socialLinksValidator,
  toOptionalSocialLinksPayload,
} from "./settingsShared";

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
      addressCountry: v.optional(v.string()),
      addressCountryCode: v.optional(v.string()),
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
    if (!user?.isActive || user.role !== "instructor") {
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
        addressCountry: profile.addressCountry,
        addressCountryCode: profile.addressCountryCode,
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
