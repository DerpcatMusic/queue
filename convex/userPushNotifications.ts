"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

export const sendUserPushNotification = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    data: v.optional(
      v.object({
        type: v.string(),
        jobId: v.optional(v.string()),
        applicationId: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    sent: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ sent: boolean; reason?: string }> => {
    const recipient = await ctx.runQuery(
      internal.notificationsCore.getPushRecipientForUser,
      { userId: args.userId },
    );

    if (!recipient) {
      return { sent: false, reason: "push_not_configured" };
    }

    try {
      const response: Response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            to: recipient.expoPushToken,
            sound: "default",
            title: args.title,
            body: args.body,
            data: args.data,
          },
        ]),
      });

      if (!response.ok) {
        return { sent: false, reason: `expo_push_http_${response.status}` };
      }

      const json = (await response.json()) as {
        data?: { status?: string; message?: string; details?: { error?: string } }[];
      };
      const row = json.data?.[0];
      if (row?.status !== "ok") {
        return {
          sent: false,
          reason: row?.details?.error ?? row?.message ?? "expo_push_error",
        };
      }

      return { sent: true };
    } catch (error) {
      return {
        sent: false,
        reason:
          error instanceof Error && error.message
            ? error.message
            : "expo_push_network_error",
      };
    }
  },
});
