import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  users: defineTable({
    role: v.union(
      v.literal("pending"),
      v.literal("instructor"),
      v.literal("studio"),
    ),
    onboardingComplete: v.boolean(),
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
    phoneE164: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_role", ["role"]),

  instructorProfiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    bio: v.optional(v.string()),
    address: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    expoPushToken: v.optional(v.string()),
    notificationsEnabled: v.boolean(),
    profileImageStorageId: v.optional(v.id("_storage")),
    hourlyRateExpectation: v.optional(v.number()),
    calendarProvider: v.optional(
      v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    ),
    calendarSyncEnabled: v.optional(v.boolean()),
    calendarConnectedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_id", ["userId"]),

  instructorSports: defineTable({
    instructorId: v.id("instructorProfiles"),
    sport: v.string(),
    createdAt: v.number(),
  })
    .index("by_instructor_id", ["instructorId"])
    .index("by_sport", ["sport"])
    .index("by_instructor_and_sport", ["instructorId", "sport"]),

  instructorZones: defineTable({
    instructorId: v.id("instructorProfiles"),
    zone: v.string(),
    createdAt: v.number(),
  })
    .index("by_instructor_id", ["instructorId"])
    .index("by_zone", ["zone"])
    .index("by_zone_and_instructor", ["zone", "instructorId"]),

  instructorCoverage: defineTable({
    instructorId: v.id("instructorProfiles"),
    sport: v.string(),
    zone: v.string(),
    notificationsEnabled: v.boolean(),
    expoPushToken: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_sport_zone", ["sport", "zone"])
    .index("by_instructor_id", ["instructorId"]),

  studioProfiles: defineTable({
    userId: v.id("users"),
    studioName: v.string(),
    address: v.string(),
    zone: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    contactPhone: v.optional(v.string()),
    expoPushToken: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
    logoStorageId: v.optional(v.id("_storage")),
    autoExpireMinutesBefore: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_zone", ["zone"]),

  jobs: defineTable({
    studioId: v.id("studioProfiles"),
    zone: v.string(),
    sport: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    timeZone: v.optional(v.string()),
    pay: v.number(),
    note: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("filled"),
      v.literal("cancelled"),
      v.literal("completed"),
    ),
    filledByInstructorId: v.optional(v.id("instructorProfiles")),
    postedAt: v.number(),
    requiredLevel: v.optional(
      v.union(
        v.literal("beginner_friendly"),
        v.literal("all_levels"),
        v.literal("intermediate"),
        v.literal("advanced"),
      ),
    ),
    maxParticipants: v.optional(v.number()),
    equipmentProvided: v.optional(v.boolean()),
    sessionLanguage: v.optional(
      v.union(
        v.literal("hebrew"),
        v.literal("english"),
        v.literal("arabic"),
        v.literal("russian"),
      ),
    ),
    isRecurring: v.optional(v.boolean()),
    cancellationDeadlineHours: v.optional(v.number()),
    applicationDeadline: v.optional(v.number()),
  })
    .index("by_studio", ["studioId"])
    .index("by_studio_postedAt", ["studioId", "postedAt"])
    .index("by_status", ["status"])
    .index("by_status_postedAt", ["status", "postedAt"])
    .index("by_sport_and_status", ["sport", "status"])
    .index("by_sport_zone_status_postedAt", ["sport", "zone", "status", "postedAt"])
    .index("by_zone_and_status", ["zone", "status"]),

  jobApplications: defineTable({
    jobId: v.id("jobs"),
    studioId: v.optional(v.id("studioProfiles")),
    instructorId: v.id("instructorProfiles"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("withdrawn"),
    ),
    appliedAt: v.number(),
    updatedAt: v.number(),
    message: v.optional(v.string()),
  })
    .index("by_job", ["jobId"])
    .index("by_studio", ["studioId"])
    .index("by_instructor", ["instructorId"])
    .index("by_instructor_appliedAt", ["instructorId", "appliedAt"])
    .index("by_job_and_instructor", ["jobId", "instructorId"]),

  jobApplicationStats: defineTable({
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    applicationsCount: v.number(),
    pendingApplicationsCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_studio", ["studioId"]),

  userNotifications: defineTable({
    recipientUserId: v.id("users"),
    actorUserId: v.optional(v.id("users")),
    kind: v.union(
      v.literal("application_received"),
      v.literal("application_accepted"),
      v.literal("application_rejected"),
      v.literal("lesson_started"),
      v.literal("lesson_completed"),
    ),
    title: v.string(),
    body: v.string(),
    jobId: v.optional(v.id("jobs")),
    applicationId: v.optional(v.id("jobApplications")),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  }).index("by_recipient_createdAt", ["recipientUserId", "createdAt"]),

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
});
