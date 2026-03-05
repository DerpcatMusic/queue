"use node";

import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { omitUndefined } from "./lib/validation";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const PUSH_BATCH_SIZE = 100;
const PUSH_BATCH_CONCURRENCY = 5;

type DeliveryStatus = "sent" | "failed";

type DeliveryResult = {
  jobId: Id<"jobs">;
  instructorId: Id<"instructorProfiles">;
  expoPushToken: string;
  deliveryStatus: DeliveryStatus;
  error?: string;
};

type NotificationRecipient = {
  instructorId: Id<"instructorProfiles">;
  expoPushToken: string;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export const sendJobNotifications = internalAction({
  args: { jobId: v.id("jobs") },
  returns: v.object({
    total: v.number(),
    sent: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(internal.notificationsCore.getJobAndEligibleInstructors, {
      jobId: args.jobId,
    });

    if (!payload || payload.recipients.length === 0) {
      return { total: 0, sent: 0, failed: 0 };
    }

    const recipients = payload.recipients as NotificationRecipient[];
    const batches = chunk(recipients, PUSH_BATCH_SIZE);

    const sendBatch = async (batch: NotificationRecipient[]): Promise<DeliveryResult[]> => {
      const messages = batch.map((recipient) => ({
        to: recipient.expoPushToken,
        sound: "default",
        title: "New class opportunity",
        body: `${payload.sport} - ${payload.zone}`,
        data: {
          type: "job_opened",
          jobId: String(payload.jobId),
        },
      }));

      try {
        const response = await fetch(EXPO_PUSH_ENDPOINT, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messages),
        });

        if (!response.ok) {
          const error = `expo_push_http_${response.status}`;
          return batch.map((recipient) => ({
            jobId: payload.jobId,
            instructorId: recipient.instructorId,
            expoPushToken: recipient.expoPushToken,
            deliveryStatus: "failed",
            error,
          }));
        }

        const json = (await response.json()) as {
          data?: {
            status?: string;
            message?: string;
            details?: { error?: string };
          }[];
        };

        const resultRows = json.data ?? [];
        const batchResults: DeliveryResult[] = [];
        for (const [i, recipient] of batch.entries()) {
          const row = resultRows[i];
          const status = row?.status === "ok" ? "sent" : "failed";
          const error =
            status === "failed"
              ? (row?.details?.error ?? row?.message ?? "expo_push_error")
              : undefined;

          batchResults.push({
            jobId: payload.jobId,
            instructorId: recipient.instructorId,
            expoPushToken: recipient.expoPushToken,
            deliveryStatus: status,
            ...omitUndefined({ error }),
          });
        }
        return batchResults;
      } catch (error) {
        const message =
          error instanceof Error && error.message ? error.message : "expo_push_network_error";

        return batch.map((recipient) => ({
          jobId: payload.jobId,
          instructorId: recipient.instructorId,
          expoPushToken: recipient.expoPushToken,
          deliveryStatus: "failed",
          error: message,
        }));
      }
    };

    const results: DeliveryResult[] = [];
    for (let i = 0; i < batches.length; i += PUSH_BATCH_CONCURRENCY) {
      const window = batches.slice(i, i + PUSH_BATCH_CONCURRENCY);
      const windowResults = await Promise.all(window.map((batch) => sendBatch(batch)));
      for (const batchResults of windowResults) {
        results.push(...batchResults);
      }
    }

    const sent = results.filter((row) => row.deliveryStatus === "sent").length;
    const failed = results.length - sent;

    if (results.length > 0) {
      await ctx.runMutation(internal.notificationsCore.logDeliveryBatch, {
        results: results.map((row) => {
          if (row.deliveryStatus !== "sent" && !row.error) {
            throw new ConvexError("Failed notification rows must include an error");
          }
          return row;
        }),
      });
    }

    return {
      total: results.length,
      sent,
      failed,
    };
  },
});
