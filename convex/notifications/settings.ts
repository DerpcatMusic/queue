import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";
import {
  DEFAULT_LESSON_REMINDER_MINUTES,
  getDefaultNotificationPreferencesForRole,
  getNotificationPreferenceKeysForRole,
  type NotificationPreferenceKey,
} from "../lib/notificationPreferences";
import {
  ensureStudioInfrastructure,
  getPrimaryStudioBranch,
  requireStudioOwnerContext,
} from "../lib/studioBranches";
import { omitUndefined, trimOptionalString } from "../lib/validation";

const LESSON_REMINDER_MINUTES_OPTIONS = [15, 30, 45, 60] as const;

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

const appRoleValidator = v.union(v.literal("instructor"), v.literal("studio"));

async function getUniqueInstructorProfileByUserId(
  ctx: QueryCtx | MutationCtx,
  userId: any,
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

async function requireInstructorProfileByUserId(ctx: QueryCtx | MutationCtx, userId: any) {
  const profile = await getUniqueInstructorProfileByUserId(ctx, userId);
  if (!profile) {
    throw new ConvexError("Instructor profile not found");
  }
  return profile;
}

async function getUniqueStudioProfileByUserId(ctx: QueryCtx | MutationCtx, userId: any) {
  const profiles = await ctx.db
    .query("studioProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(2);
  if (profiles.length > 1) {
    throw new ConvexError("Multiple studio profiles found for this account");
  }
  return profiles[0] ?? null;
}

export const getMyNotificationSettings = query({
  args: {},
  returns: v.union(
    v.object({
      role: appRoleValidator,
      notificationsEnabled: v.boolean(),
      hasExpoPushToken: v.boolean(),
      lessonReminderMinutesBefore: v.number(),
      availablePreferenceKeys: v.array(
        v.union(
          v.literal("job_offer"),
          v.literal("insurance_renewal"),
          v.literal("application_received"),
          v.literal("application_updates"),
          v.literal("lesson_reminder"),
          v.literal("lesson_updates"),
        ),
      ),
      preferences: v.object({
        job_offer: v.boolean(),
        insurance_renewal: v.boolean(),
        application_received: v.boolean(),
        application_updates: v.boolean(),
        lesson_reminder: v.boolean(),
        lesson_updates: v.boolean(),
      }),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    if (!user || !user.isActive || (user.role !== "instructor" && user.role !== "studio")) {
      return null;
    }

    const preferenceDefaults = getDefaultNotificationPreferencesForRole(user.role);
    const preferenceRows = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of preferenceRows) {
      preferenceDefaults[row.key] = row.enabled;
    }

    if (user.role === "instructor") {
      const profile = await getUniqueInstructorProfileByUserId(ctx, user._id);
      if (!profile) {
        return null;
      }
      const hasExpoPushToken = Boolean(trimOptionalString(profile.expoPushToken));
      return {
        role: "instructor" as const,
        notificationsEnabled: profile.notificationsEnabled && hasExpoPushToken,
        hasExpoPushToken,
        lessonReminderMinutesBefore:
          profile.lessonReminderMinutesBefore ?? DEFAULT_LESSON_REMINDER_MINUTES,
        availablePreferenceKeys: [...getNotificationPreferenceKeysForRole("instructor")],
        preferences: preferenceDefaults,
      };
    }

    const profile = await getUniqueStudioProfileByUserId(ctx, user._id);
    if (!profile) {
      return null;
    }
    const primaryBranch = await getPrimaryStudioBranch(ctx, profile._id);
    const pushToken = trimOptionalString(primaryBranch?.expoPushToken ?? profile.expoPushToken);
    const hasExpoPushToken = Boolean(pushToken);
    return {
      role: "studio" as const,
      notificationsEnabled:
        Boolean(primaryBranch?.notificationsEnabled ?? profile.notificationsEnabled) &&
        hasExpoPushToken,
      hasExpoPushToken,
      lessonReminderMinutesBefore:
        primaryBranch?.lessonReminderMinutesBefore ??
        profile.lessonReminderMinutesBefore ??
        DEFAULT_LESSON_REMINDER_MINUTES,
      availablePreferenceKeys: [...getNotificationPreferenceKeysForRole("studio")],
      preferences: preferenceDefaults,
    };
  },
});

export const updateMyNotificationSettings = mutation({
  args: {
    notificationsEnabled: v.boolean(),
    expoPushToken: v.optional(v.string()),
    lessonReminderMinutesBefore: v.optional(v.number()),
    preferenceUpdates: v.optional(
      v.array(
        v.object({
          key: v.union(
            v.literal("job_offer"),
            v.literal("insurance_renewal"),
            v.literal("application_received"),
            v.literal("application_updates"),
            v.literal("lesson_reminder"),
            v.literal("lesson_updates"),
          ),
          enabled: v.boolean(),
        }),
      ),
    ),
  },
  returns: v.object({
    ok: v.boolean(),
    notificationsEnabled: v.boolean(),
    hasExpoPushToken: v.boolean(),
    lessonReminderMinutesBefore: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await requireCurrentUser(ctx);
    if (user.role !== "instructor" && user.role !== "studio") {
      throw new ConvexError("Notification settings are unavailable for this user");
    }

    const allowedKeys = new Set<NotificationPreferenceKey>(
      getNotificationPreferenceKeysForRole(user.role),
    );
    for (const row of args.preferenceUpdates ?? []) {
      if (!allowedKeys.has(row.key)) {
        throw new ConvexError(
          `Notification preference ${row.key} is not available for ${user.role}`,
        );
      }
    }

    const lessonReminderMinutesBefore =
      args.lessonReminderMinutesBefore !== undefined
        ? normalizeLessonReminderMinutes(args.lessonReminderMinutesBefore)
        : undefined;

    if (user.role === "instructor") {
      const profile = await requireInstructorProfileByUserId(ctx, user._id);
      const nextPushToken =
        trimOptionalString(args.expoPushToken) ?? trimOptionalString(profile.expoPushToken);
      const hasExpoPushToken = Boolean(nextPushToken);
      const notificationsEnabled = args.notificationsEnabled && hasExpoPushToken;
      await ctx.db.patch("instructorProfiles", profile._id, {
        notificationsEnabled,
        ...(lessonReminderMinutesBefore !== undefined ? { lessonReminderMinutesBefore } : {}),
        ...omitUndefined({ expoPushToken: nextPushToken }),
        updatedAt: now,
      });

      for (const row of args.preferenceUpdates ?? []) {
        const existing = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user_key", (q) => q.eq("userId", user._id).eq("key", row.key))
          .unique();
        if (existing) {
          await ctx.db.patch(existing._id, {
            enabled: row.enabled,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("notificationPreferences", {
            userId: user._id,
            key: row.key,
            enabled: row.enabled,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      return {
        ok: true,
        notificationsEnabled,
        hasExpoPushToken,
        lessonReminderMinutesBefore:
          lessonReminderMinutesBefore ??
          profile.lessonReminderMinutesBefore ??
          DEFAULT_LESSON_REMINDER_MINUTES,
      };
    }

    const { studio } = await requireStudioOwnerContext(ctx);
    const { branch: primaryBranch } = await ensureStudioInfrastructure(ctx, studio, now);
    const nextPushToken =
      trimOptionalString(args.expoPushToken) ??
      trimOptionalString(primaryBranch.expoPushToken ?? studio.expoPushToken);
    const hasExpoPushToken = Boolean(nextPushToken);
    const notificationsEnabled = args.notificationsEnabled && hasExpoPushToken;
    const nextLessonReminderMinutes =
      lessonReminderMinutesBefore ??
      primaryBranch.lessonReminderMinutesBefore ??
      studio.lessonReminderMinutesBefore ??
      DEFAULT_LESSON_REMINDER_MINUTES;

    await ctx.db.patch("studioProfiles", studio._id, {
      notificationsEnabled,
      lessonReminderMinutesBefore: nextLessonReminderMinutes,
      ...omitUndefined({ expoPushToken: nextPushToken }),
      updatedAt: now,
    });
    await ctx.db.patch("studioBranches", primaryBranch._id, {
      notificationsEnabled,
      lessonReminderMinutesBefore: nextLessonReminderMinutes,
      ...omitUndefined({ expoPushToken: nextPushToken }),
      updatedAt: now,
    });

    for (const row of args.preferenceUpdates ?? []) {
      const existing = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_key", (q) => q.eq("userId", user._id).eq("key", row.key))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          enabled: row.enabled,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("notificationPreferences", {
          userId: user._id,
          key: row.key,
          enabled: row.enabled,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return {
      ok: true,
      notificationsEnabled,
      hasExpoPushToken,
      lessonReminderMinutesBefore: nextLessonReminderMinutes,
    };
  },
});

export const touchMyNotificationClientState = mutation({
  args: {
    localReminderCoverageUntil: v.optional(v.number()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const now = Date.now();

    await ctx.db.patch("users", user._id, {
      notificationClientLastSeenAt: now,
      ...omitUndefined({
        notificationLocalRemindersCoverageUntil: args.localReminderCoverageUntil,
      }),
      updatedAt: now,
    });

    return { ok: true };
  },
});
