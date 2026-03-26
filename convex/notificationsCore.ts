import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";
import { isKnownZoneId } from "./lib/domainValidation";
import { omitUndefined } from "./lib/validation";
import { getCurrentUser as getCurrentUserDoc } from "./lib/auth";

export const getJobAndEligibleInstructors = internalQuery({
  args: { jobId: v.id("jobs") },
  returns: v.union(
    v.null(),
    v.object({
      jobId: v.id("jobs"),
      sport: v.string(),
      zone: v.string(),
      startTime: v.number(),
      recipients: v.array(
        v.object({
          instructorId: v.id("instructorProfiles"),
          expoPushToken: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job || job.status !== "open") {
      return null;
    }
    if (!isKnownZoneId(job.zone)) {
      return {
        jobId: job._id,
        sport: job.sport,
        zone: job.zone,
        startTime: job.startTime,
        recipients: [],
      };
    }

    const coverageRows = await ctx.db
      .query("instructorCoverage")
      .withIndex("by_sport_zone", (q) => q.eq("sport", job.sport).eq("zone", job.zone))
      .collect();

    const recipients = [];
    const seen = new Set<string>();
    for (const row of coverageRows) {
      if (!row.notificationsEnabled || !row.expoPushToken) continue;
      const key = `${row.instructorId}::${row.expoPushToken}`;
      if (seen.has(key)) continue;
      seen.add(key);
      recipients.push({
        instructorId: row.instructorId,
        expoPushToken: row.expoPushToken,
      });
    }

    return {
      jobId: job._id,
      sport: job.sport,
      zone: job.zone,
      startTime: job.startTime,
      recipients,
    };
  },
});

export const logDeliveryBatch = internalMutation({
  args: {
    results: v.array(
      v.object({
        jobId: v.id("jobs"),
        instructorId: v.id("instructorProfiles"),
        expoPushToken: v.string(),
        deliveryStatus: v.union(v.literal("sent"), v.literal("failed")),
        error: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    await Promise.all(
      args.results.map((result) =>
        ctx.db.insert("notificationLog", {
          jobId: result.jobId,
          instructorId: result.instructorId,
          sentAt: now,
          deliveryStatus: result.deliveryStatus,
          expoPushToken: result.expoPushToken,
          ...omitUndefined({ error: result.error }),
        }),
      ),
    );

    return { inserted: args.results.length };
  },
});

export const getPushRecipientForUser = internalQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      expoPushToken: v.string(),
    }),
  ),
  handler: async (ctx) => {
    // SECURITY: Get user from auth context, not from args
    const user = await getCurrentUserDoc(ctx);
    if (!user || !user.isActive) {
      return null;
    }

    if (user.role === "instructor") {
      const profile = await ctx.db
        .query("instructorProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .unique();

      if (!profile?.notificationsEnabled || !profile.expoPushToken) {
        return null;
      }

      return { expoPushToken: profile.expoPushToken };
    }

    if (user.role === "studio") {
      const profile = await ctx.db
        .query("studioProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .unique();

      if (!profile?.notificationsEnabled || !profile.expoPushToken) {
        return null;
      }

      return { expoPushToken: profile.expoPushToken };
    }

    return null;
  },
});
