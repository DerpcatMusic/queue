import { ConvexError, v } from "convex/values";
import { gridDisk } from "h3-js";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { radiusToK } from "./lib/h3";
import {
  canInstructorPerformJobActions,
  loadInstructorComplianceSnapshot,
} from "./lib/instructorCompliance";
import { MAX_WORK_RADIUS_KM } from "./lib/locationRadius";
import {
  DEFAULT_LESSON_REMINDER_MINUTES,
  getDefaultNotificationPreferencesForRole,
  getNotificationPreferenceKeysForRole,
  LESSON_REMINDER_MINUTES_OPTIONS,
  mapNotificationKindToPreferenceKey,
  type NotificationInboxKind,
  type NotificationPreferenceKey,
} from "./lib/notificationPreferences";
import { omitUndefined, trimOptionalString } from "./lib/validation";

const LOCAL_DEVICE_OWNED_REMINDER_REASON = "local_device_owned";

type NotificationMutationCtx = MutationCtx;

type PushRouting = {
  role: "instructor" | "studio";
  preferenceEnabled: boolean;
  globalPushEnabled: boolean;
  expoPushToken?: string;
  lessonReminderMinutesBefore: number;
};

async function getPushRoutingForUser(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  userId: Id<"users">,
  preferenceKey: NotificationPreferenceKey,
): Promise<PushRouting | null> {
  const user = await ctx.db.get("users", userId);
  if (!user || !user.isActive || (user.role !== "instructor" && user.role !== "studio")) {
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

async function deliverNotificationEventInternal(
  ctx: NotificationMutationCtx,
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
  if (!routing || !routing.preferenceEnabled) {
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
    await ctx.scheduler.runAfter(0, internal.userPushNotifications.sendUserPushNotification, {
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

export const getJobAndEligibleInstructors = internalAction({
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

    const branch = await ctx.db.get("studioBranches", job.branchId);
    if (!branch?.h3Index) {
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

    const kMax = radiusToK(MAX_WORK_RADIUS_KM);
    const allCells = gridDisk(branch.h3Index, kMax);

    const CHUNK_SIZE = 500;
    const seen = new Set<string>();
    const recipients: {
      instructorId: Id<"instructorProfiles">;
      expoPushToken: string;
    }[] = [];

    for (let i = 0; i < allCells.length; i += CHUNK_SIZE) {
      const chunk = allCells.slice(i, i + CHUNK_SIZE);

      const profilesByCell = await Promise.all(
        chunk.map((hex) =>
          ctx.db
            .query("instructorProfiles")
            .withIndex("by_h3_index", (q) => q.eq("h3Index", hex))
            .collect()
        )
      );

      for (const profiles of profilesByCell) {
        for (const profile of profiles) {
          if (seen.has(String(profile._id))) continue;
          seen.add(String(profile._id));

          if (!profile.notificationsEnabled || !profile.expoPushToken) continue;

          const sportLink = await ctx.db
            .query("instructorSports")
            .withIndex("by_instructor_and_sport", (q) =>
              q.eq("instructorId", profile._id).eq("sport", job.sport),
            )
            .unique();
          if (!sportLink) continue;

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
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      expoPushToken: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user || !user.isActive) {
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

export const deliverNotificationEvent = internalMutation({
  args: {
    recipientUserId: v.id("users"),
    actorUserId: v.optional(v.id("users")),
    kind: v.union(
      v.literal("application_received"),
      v.literal("application_accepted"),
      v.literal("application_rejected"),
      v.literal("lesson_reminder"),
      v.literal("lesson_started"),
      v.literal("lesson_completed"),
      v.literal("compliance_certificate_approved"),
      v.literal("compliance_certificate_rejected"),
      v.literal("compliance_insurance_approved"),
      v.literal("compliance_insurance_rejected"),
      v.literal("compliance_insurance_expiring"),
      v.literal("compliance_insurance_expired"),
    ),
    title: v.string(),
    body: v.string(),
    jobId: v.optional(v.id("jobs")),
    applicationId: v.optional(v.id("jobApplications")),
    leadMinutes: v.optional(v.number()),
  },
  returns: v.object({
    stored: v.boolean(),
    pushScheduled: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    return deliverNotificationEventInternal(ctx, args);
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
    if (!user || !user.isActive || (user.role !== "instructor" && user.role !== "studio")) {
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

export const upsertNotificationPreference = internalMutation({
  args: {
    userId: v.id("users"),
    key: v.union(
      v.literal("job_offer"),
      v.literal("insurance_renewal"),
      v.literal("application_received"),
      v.literal("application_updates"),
      v.literal("lesson_reminder"),
      v.literal("lesson_updates"),
    ),
    enabled: v.boolean(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_key", (q) => q.eq("userId", args.userId).eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("notificationPreferences", {
        userId: args.userId,
        key: args.key,
        enabled: args.enabled,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { ok: true };
  },
});

export const syncLessonReminderSchedulesForJob = internalMutation({
  args: { jobId: v.id("jobs") },
  returns: v.object({ scheduled: v.number(), cancelled: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) {
      throw new ConvexError("Job not found");
    }

    const existingRows = await ctx.db
      .query("notificationSchedules")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    if (job.status !== "filled" || job.startTime <= now || !job.filledByInstructorId) {
      let cancelled = 0;
      for (const row of existingRows) {
        if (row.status !== "scheduled") continue;
        cancelled += 1;
        await ctx.db.patch(row._id, {
          status: "cancelled",
          cancelledAt: now,
          updatedAt: now,
          skipReason: "job_not_remindable",
        });
      }
      return { scheduled: 0, cancelled };
    }

    const instructor = await ctx.db.get("instructorProfiles", job.filledByInstructorId);
    const studio = await ctx.db.get("studioProfiles", job.studioId);
    if (!instructor || !studio) {
      throw new ConvexError("Reminder participants are missing");
    }

    const instructorRouting = await getPushRoutingForUser(
      ctx,
      instructor.userId,
      "lesson_reminder",
    );
    const studioRouting = await getPushRoutingForUser(ctx, studio.userId, "lesson_reminder");
    const desired = [
      {
        userId: instructor.userId,
        actorUserId: studio.userId,
        leadMinutes:
          instructorRouting?.lessonReminderMinutesBefore ?? DEFAULT_LESSON_REMINDER_MINUTES,
      },
      {
        userId: studio.userId,
        actorUserId: instructor.userId,
        leadMinutes: studioRouting?.lessonReminderMinutesBefore ?? DEFAULT_LESSON_REMINDER_MINUTES,
      },
    ].filter((row) =>
      LESSON_REMINDER_MINUTES_OPTIONS.includes(
        row.leadMinutes as (typeof LESSON_REMINDER_MINUTES_OPTIONS)[number],
      ),
    );

    const studioName = studio.studioName ?? "Queue";
    const desiredKeys = new Set<string>();
    let scheduled = 0;

    for (const reminder of desired) {
      const scheduledFor = job.startTime - reminder.leadMinutes * 60 * 1000;
      if (scheduledFor <= now) {
        continue;
      }

      const dedupeKey = `lesson_reminder:${String(job._id)}:${String(reminder.userId)}:${reminder.leadMinutes}`;
      desiredKeys.add(dedupeKey);
      const existing = await ctx.db
        .query("notificationSchedules")
        .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
        .unique();
      const payload = {
        userId: reminder.userId,
        preferenceKey: "lesson_reminder" as const,
        kind: "lesson_reminder" as const,
        title: "Lesson reminder",
        body: `${job.sport} starts in ${reminder.leadMinutes} minutes at ${studioName}.`,
        jobId: job._id,
        leadMinutes: reminder.leadMinutes,
        scheduledFor,
        dedupeKey,
        status: "scheduled" as const,
        updatedAt: now,
        ...omitUndefined({
          actorUserId: reminder.actorUserId,
        }),
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("notificationSchedules", {
          ...payload,
          createdAt: now,
        });
      }
      scheduled += 1;
    }

    let cancelled = 0;
    for (const row of existingRows) {
      if (row.status !== "scheduled" || desiredKeys.has(row.dedupeKey)) {
        continue;
      }
      cancelled += 1;
      await ctx.db.patch(row._id, {
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
        skipReason: "superseded",
      });
    }

    return { scheduled, cancelled };
  },
});

export const cancelJobNotificationSchedules = internalMutation({
  args: {
    jobId: v.id("jobs"),
    reason: v.optional(v.string()),
  },
  returns: v.object({ cancelled: v.number() }),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("notificationSchedules")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    const now = Date.now();
    let cancelled = 0;
    for (const row of rows) {
      if (row.status !== "scheduled") continue;
      cancelled += 1;
      await ctx.db.patch(row._id, {
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
        skipReason: args.reason ?? "job_cancelled",
      });
    }
    return { cancelled };
  },
});

export const processDueNotificationSchedules = internalMutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    sent: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
    const rows = await ctx.db
      .query("notificationSchedules")
      .withIndex("by_status_scheduledFor", (q) =>
        q.eq("status", "scheduled").lte("scheduledFor", now),
      )
      .take(limit);

    let sent = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.kind === "lesson_reminder" && row.jobId) {
        const job = await ctx.db.get("jobs", row.jobId);
        if (!job || job.status !== "filled" || job.startTime <= now - 15 * 60 * 1000) {
          skipped += 1;
          await ctx.db.patch(row._id, {
            status: "skipped",
            skippedAt: now,
            updatedAt: now,
            skipReason: "job_no_longer_active",
          });
          continue;
        }

        const recipientUser = await ctx.db.get("users", row.userId);
        if (
          recipientUser?.notificationLocalRemindersCoverageUntil !== undefined &&
          recipientUser.notificationLocalRemindersCoverageUntil >= row.scheduledFor
        ) {
          skipped += 1;
          await ctx.db.patch(row._id, {
            status: "skipped",
            skippedAt: now,
            updatedAt: now,
            skipReason: LOCAL_DEVICE_OWNED_REMINDER_REASON,
          });
          continue;
        }
      }

      const result = await deliverNotificationEventInternal(ctx, {
        recipientUserId: row.userId,
        ...(row.actorUserId ? { actorUserId: row.actorUserId } : {}),
        kind: row.kind,
        title: row.title,
        body: row.body,
        ...(row.jobId ? { jobId: row.jobId } : {}),
        ...(row.applicationId ? { applicationId: row.applicationId } : {}),
        ...(row.leadMinutes !== undefined ? { leadMinutes: row.leadMinutes } : {}),
      });

      if (!result.stored) {
        skipped += 1;
        await ctx.db.patch(row._id, {
          status: "skipped",
          skippedAt: now,
          updatedAt: now,
          skipReason: result.reason ?? "delivery_skipped",
        });
        continue;
      }

      sent += 1;
      await ctx.db.patch(row._id, {
        status: "sent",
        sentAt: now,
        updatedAt: now,
      });
    }

    return {
      processed: rows.length,
      sent,
      skipped,
    };
  },
});
