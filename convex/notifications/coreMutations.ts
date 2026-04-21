import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internalMutation } from "../_generated/server";
import {
  DEFAULT_LESSON_REMINDER_MINUTES,
  LESSON_REMINDER_MINUTES_OPTIONS,
} from "../lib/notificationPreferences";
import { omitUndefined } from "../lib/validation";
import {
  deliverNotificationEventInternal,
  getPushRoutingForUser,
  LOCAL_DEVICE_OWNED_REMINDER_REASON,
} from "./coreShared";
import { ErrorCode } from "../lib/errors";

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
      throw new ConvexError({
        code: ErrorCode.JOB_NOT_FOUND,
        message: "Job not found",
      });
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
      throw new ConvexError({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Reminder participants are missing",
      });
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
