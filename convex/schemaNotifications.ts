import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  notificationInboxKindValidator,
  notificationPreferenceKeyValidator,
  notificationScheduleStatusValidator,
} from "./schemaValidators";

export const notificationTables = {
  notificationPreferences: defineTable({
    userId: v.id("users"),
    key: notificationPreferenceKeyValidator,
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId", "updatedAt"])
    .index("by_user_key", ["userId", "key"]),

  notificationSchedules: defineTable({
    userId: v.id("users"),
    actorUserId: v.optional(v.id("users")),
    preferenceKey: notificationPreferenceKeyValidator,
    kind: notificationInboxKindValidator,
    title: v.string(),
    body: v.string(),
    jobId: v.optional(v.id("jobs")),
    applicationId: v.optional(v.id("jobApplications")),
    insurancePolicyId: v.optional(v.id("instructorInsurancePolicies")),
    leadMinutes: v.optional(v.number()),
    scheduledFor: v.number(),
    dedupeKey: v.string(),
    status: notificationScheduleStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
    sentAt: v.optional(v.number()),
    skippedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    skipReason: v.optional(v.string()),
  })
    .index("by_status_scheduledFor", ["status", "scheduledFor"])
    .index("by_job", ["jobId", "scheduledFor"])
    .index("by_policy", ["insurancePolicyId", "scheduledFor"])
    .index("by_dedupeKey", ["dedupeKey"])
    .index("by_user_status", ["userId", "status"]),

  userNotifications: defineTable({
    recipientUserId: v.id("users"),
    actorUserId: v.optional(v.id("users")),
    kind: notificationInboxKindValidator,
    title: v.string(),
    body: v.string(),
    jobId: v.optional(v.id("jobs")),
    applicationId: v.optional(v.id("jobApplications")),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_recipient_createdAt", ["recipientUserId", "createdAt"])
    .index("by_recipient_readAt", ["recipientUserId", "readAt"]),

  notificationLog: defineTable({
    jobId: v.id("jobs"),
    instructorId: v.id("instructorProfiles"),
    sentAt: v.number(),
    deliveryStatus: v.union(v.literal("sent"), v.literal("failed")),
    expoPushToken: v.string(),
    error: v.optional(v.string()),
  })
    .index("by_job", ["jobId"])
    .index("by_instructor", ["instructorId"])
    .index("by_job_and_instructor", ["jobId", "instructorId"]),

  lessonReminderDispatches: defineTable({
    jobId: v.id("jobs"),
    recipientUserId: v.id("users"),
    targetRole: v.union(v.literal("instructor"), v.literal("studio")),
    reminderMinutesBefore: v.number(),
    sentAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_recipient", ["recipientUserId"])
    .index("by_job_recipient_reminder", ["jobId", "recipientUserId", "reminderMinutesBefore"]),
};
