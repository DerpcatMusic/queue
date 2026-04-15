import { ConvexError, v } from "convex/values";

import { mutation, query } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";
import { assertPositiveInteger, omitUndefined } from "../lib/validation";

export const getMyNotifications = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      notificationId: v.id("userNotifications"),
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
      createdAt: v.number(),
      readAt: v.optional(v.number()),
      jobId: v.optional(v.id("jobs")),
      applicationId: v.optional(v.id("jobApplications")),
      unread: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const rawLimit = args.limit ?? 30;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 200);

    const rows = await ctx.db
      .query("userNotifications")
      .withIndex("by_recipient_createdAt", (q) => q.eq("recipientUserId", user._id))
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      notificationId: row._id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      ...omitUndefined({
        readAt: row.readAt,
        jobId: row.jobId,
        applicationId: row.applicationId,
      }),
      unread: row.readAt === undefined,
    }));
  },
});

export const getMyUnreadNotificationCount = query({
  args: {},
  returns: v.object({
    count: v.number(),
  }),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const unreadRows = await ctx.db
      .query("userNotifications")
      .withIndex("by_recipient_readAt", (q) =>
        q.eq("recipientUserId", user._id).eq("readAt", undefined),
      )
      .collect();

    return {
      count: unreadRows.length,
    };
  },
});

export const markMyNotificationRead = mutation({
  args: { notificationId: v.id("userNotifications") },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const notification = await ctx.db.get("userNotifications", args.notificationId);
    if (!notification) {
      throw new ConvexError("Notification not found");
    }
    if (notification.recipientUserId !== user._id) {
      throw new ConvexError("Not authorized for this notification");
    }
    if (notification.readAt === undefined) {
      await ctx.db.patch("userNotifications", notification._id, {
        readAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const markAllMyNotificationsRead = mutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ updated: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const rawLimit = args.limit ?? 200;
    assertPositiveInteger(rawLimit, "limit");
    const limit = Math.min(rawLimit, 500);

    const rows = await ctx.db
      .query("userNotifications")
      .withIndex("by_recipient_createdAt", (q) => q.eq("recipientUserId", user._id))
      .order("desc")
      .take(limit);

    const now = Date.now();
    const unreadRows = rows.filter((row) => row.readAt === undefined);
    await Promise.all(
      unreadRows.map((row) => ctx.db.patch("userNotifications", row._id, { readAt: now })),
    );

    return { updated: unreadRows.length };
  },
});
