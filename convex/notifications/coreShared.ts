import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  DEFAULT_LESSON_REMINDER_MINUTES,
  getDefaultNotificationPreferencesForRole,
  mapNotificationKindToPreferenceKey,
  type NotificationInboxKind,
  type NotificationPreferenceKey,
} from "../lib/notificationPreferences";
import { omitUndefined, trimOptionalString } from "../lib/validation";

export const LOCAL_DEVICE_OWNED_REMINDER_REASON = "local_device_owned";

export type PushRouting = {
  role: "instructor" | "studio";
  preferenceEnabled: boolean;
  globalPushEnabled: boolean;
  expoPushToken?: string;
  lessonReminderMinutesBefore: number;
};

export async function getPushRoutingForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  preferenceKey: NotificationPreferenceKey,
): Promise<PushRouting | null> {
  const user = await ctx.db.get("users", userId);
  if (!user?.isActive || (user.role !== "instructor" && user.role !== "studio")) {
    return null;
  }

  const preferenceRow = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", preferenceKey))
    .unique();
  const defaultPreferences = getDefaultNotificationPreferencesForRole(user.role);
  const preferenceEnabled = preferenceRow?.enabled ?? defaultPreferences[preferenceKey];

  if (user.role === "instructor") {
    const profile = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) {
      return null;
    }

    return {
      role: "instructor",
      preferenceEnabled,
      globalPushEnabled: Boolean(profile.notificationsEnabled),
      lessonReminderMinutesBefore:
        profile.lessonReminderMinutesBefore ?? DEFAULT_LESSON_REMINDER_MINUTES,
      ...omitUndefined({
        expoPushToken: trimOptionalString(profile.expoPushToken),
      }),
    };
  }

  const profile = await ctx.db
    .query("studioProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) {
    return null;
  }

  const primaryBranch = await ctx.db
    .query("studioBranches")
    .withIndex("by_studio_primary", (q) => q.eq("studioId", profile._id).eq("isPrimary", true))
    .unique();

  return {
    role: "studio",
    preferenceEnabled,
    globalPushEnabled: Boolean(primaryBranch?.notificationsEnabled ?? profile.notificationsEnabled),
    lessonReminderMinutesBefore:
      primaryBranch?.lessonReminderMinutesBefore ??
      profile.lessonReminderMinutesBefore ??
      DEFAULT_LESSON_REMINDER_MINUTES,
    ...omitUndefined({
      expoPushToken: trimOptionalString(primaryBranch?.expoPushToken ?? profile.expoPushToken),
    }),
  };
}

export async function deliverNotificationEventInternal(
  ctx: MutationCtx,
  args: {
    recipientUserId: Id<"users">;
    actorUserId?: Id<"users">;
    kind: NotificationInboxKind;
    title: string;
    body: string;
    jobId?: Id<"jobs">;
    applicationId?: Id<"jobApplications">;
    leadMinutes?: number;
  },
) {
  const preferenceKey = mapNotificationKindToPreferenceKey(args.kind);
  const routing = await getPushRoutingForUser(ctx, args.recipientUserId, preferenceKey);
  if (!routing?.preferenceEnabled) {
    return { stored: false, pushScheduled: false, reason: "notifications_disabled" as const };
  }

  const createdAt = Date.now();
  await ctx.db.insert("userNotifications", {
    recipientUserId: args.recipientUserId,
    kind: args.kind,
    title: args.title,
    body: args.body,
    ...omitUndefined({
      actorUserId: args.actorUserId,
      jobId: args.jobId,
      applicationId: args.applicationId,
    }),
    createdAt,
  });

  const canSendPush = routing.globalPushEnabled && Boolean(routing.expoPushToken);
  if (canSendPush) {
    await ctx.scheduler.runAfter(0, internal.notifications.pushDelivery.sendUserPushNotification, {
      userId: args.recipientUserId,
      title: args.title,
      body: args.body,
      data: {
        type: args.kind,
        ...omitUndefined({
          jobId: args.jobId ? String(args.jobId) : undefined,
          applicationId: args.applicationId ? String(args.applicationId) : undefined,
          leadMinutes: args.leadMinutes,
        }),
      },
    });
  }

  return { stored: true, pushScheduled: canSendPush };
}
