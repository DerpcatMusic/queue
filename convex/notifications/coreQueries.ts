import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";
import { getJobMatchCells } from "../lib/h3";
import {
  canInstructorPerformJobActions,
  loadInstructorComplianceSnapshot,
} from "../lib/instructorCompliance";
import {
  DEFAULT_LESSON_REMINDER_MINUTES,
  getDefaultNotificationPreferencesForRole,
  getNotificationPreferenceKeysForRole,
} from "../lib/notificationPreferences";
import { omitUndefined } from "../lib/validation";
import { getPushRoutingForUser } from "./coreShared";

export const getJobAndEligibleInstructors = internalQuery({
  args: { jobId: v.id("jobs") },
  returns: v.union(
    v.null(),
    v.object({
      jobId: v.id("jobs"),
      sport: v.string(),
      zone: v.string(),
      boundaryProvider: v.optional(v.string()),
      boundaryId: v.optional(v.string()),
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

    if (!job.h3Index) {
      return {
        jobId: job._id,
        sport: job.sport,
        zone: job.zone,
        startTime: job.startTime,
        recipients: [],
        ...omitUndefined({
          boundaryProvider: job.boundaryProvider,
          boundaryId: job.boundaryId,
        }),
      };
    }

    const seen = new Set<string>();
    const recipients: {
      instructorId: Id<"instructorProfiles">;
      expoPushToken: string;
    }[] = [];

    const coverageRowsByCell = await Promise.all(
      getJobMatchCells(job.h3Index).map((row) =>
        ctx.db
          .query("instructorHexCoverage")
          .withIndex("by_sport_cell", (q) => q.eq("sport", job.sport).eq("cell", row.cell))
          .collect(),
      ),
    );

    for (const coverageRows of coverageRowsByCell) {
      for (const coverage of coverageRows) {
        if (seen.has(String(coverage.instructorId))) continue;
        seen.add(String(coverage.instructorId));

        const profile = await ctx.db.get("instructorProfiles", coverage.instructorId);
        if (!profile?.notificationsEnabled || !profile.expoPushToken) continue;

        const routing = await getPushRoutingForUser(ctx, profile.userId, "job_offer");
        if (!routing?.preferenceEnabled || !routing.globalPushEnabled || !routing.expoPushToken) {
          continue;
        }

        const compliance = await loadInstructorComplianceSnapshot(ctx, profile._id, Date.now());
        if (
          !canInstructorPerformJobActions({
            profile,
            compliance,
            sport: job.sport,
            requiredCapabilityTags: job.requiredCapabilityTags,
          })
        ) {
          continue;
        }

        recipients.push({
          instructorId: profile._id,
          expoPushToken: routing.expoPushToken,
        });
      }
    }

    return {
      jobId: job._id,
      sport: job.sport,
      zone: job.zone,
      startTime: job.startTime,
      recipients,
      ...omitUndefined({
        boundaryProvider: job.boundaryProvider,
        boundaryId: job.boundaryId,
      }),
    };
  },
});

export const getPushRecipientForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      expoPushToken: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user?.isActive) {
      return null;
    }

    if (user.role === "instructor") {
      const routing = await getPushRoutingForUser(ctx, user._id, "lesson_updates");
      if (!routing?.globalPushEnabled || !routing.expoPushToken) {
        return null;
      }
      return { expoPushToken: routing.expoPushToken };
    }

    if (user.role === "studio") {
      const routing = await getPushRoutingForUser(ctx, user._id, "lesson_updates");
      if (!routing?.globalPushEnabled || !routing.expoPushToken) {
        return null;
      }
      return { expoPushToken: routing.expoPushToken };
    }

    return null;
  },
});

export const getMyNotificationPreferences = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      role: v.union(v.literal("instructor"), v.literal("studio")),
      availableKeys: v.array(
        v.union(
          v.literal("job_offer"),
          v.literal("insurance_renewal"),
          v.literal("application_received"),
          v.literal("application_updates"),
          v.literal("lesson_reminder"),
          v.literal("lesson_updates"),
        ),
      ),
      preferenceMap: v.object({
        job_offer: v.boolean(),
        insurance_renewal: v.boolean(),
        application_received: v.boolean(),
        application_updates: v.boolean(),
        lesson_reminder: v.boolean(),
        lesson_updates: v.boolean(),
      }),
      lessonReminderMinutesBefore: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user?.isActive || (user.role !== "instructor" && user.role !== "studio")) {
      return null;
    }

    const defaults = getDefaultNotificationPreferencesForRole(user.role);
    const rows = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of rows) {
      defaults[row.key] = row.enabled;
    }

    const routing = await getPushRoutingForUser(ctx, user._id, "lesson_reminder");
    return {
      role: user.role,
      availableKeys: [...getNotificationPreferenceKeysForRole(user.role)],
      preferenceMap: defaults,
      lessonReminderMinutesBefore:
        routing?.lessonReminderMinutesBefore ?? DEFAULT_LESSON_REMINDER_MINUTES,
    };
  },
});
