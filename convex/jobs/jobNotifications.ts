import { internal } from "../_generated/api";
import type { Id, MutationCtx } from "../_generated/dataModel";

export async function enqueueUserNotification(
  ctx: MutationCtx,
  args: {
    recipientUserId: Id<"users">;
    actorUserId?: Id<"users">;
    kind: import("../_generated/dataModel").Doc<"userNotifications">["kind"];
    title: string;
    body: string;
    jobId?: Id<"jobs">;
    applicationId?: Id<"jobApplications">;
  },
) {
  return await ctx.runMutation(internal.notifications.core.deliverNotificationEvent, args);
}

export async function scheduleGoogleCalendarSyncForUser(
  ctx: MutationCtx,
  userId: Id<"users"> | undefined,
) {
  if (!userId) {
    return;
  }

  await ctx.scheduler.runAfter(0, internal.calendar.googleCalendar.syncGoogleCalendarForUser, {
    userId,
  });
}
