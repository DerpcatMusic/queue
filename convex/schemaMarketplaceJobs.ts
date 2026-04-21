import { defineTable } from "convex/server";
import { v } from "convex/values";
import { storedSpecialtyValidator } from "./schemaValidators";

export const marketplaceJobsTables = {
  jobs: defineTable({
    studioId: v.id("studioProfiles"),
    branchId: v.id("studioBranches"),
    zone: v.optional(v.string()),
    boundaryProvider: v.optional(v.string()),
    boundaryId: v.optional(v.string()),
    h3Index: v.optional(v.string()),
    h3Res8: v.optional(v.string()),
    h3Res7: v.optional(v.string()),
    h3Res4: v.optional(v.string()),
    h3Res5: v.optional(v.string()),
    h3Res6: v.optional(v.string()),
    sport: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    timeZone: v.optional(v.string()),
    pay: v.number(),
    note: v.optional(v.string()),
    paymentTiming: v.optional(
      v.union(
        v.literal("before_lesson"),
        v.literal("after_start"),
        v.literal("after_end"),
        v.literal("net_terms"),
      ),
    ),
    paymentGraceDays: v.optional(v.number()),
    applicationLimit: v.optional(v.number()),
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
      v.union(v.literal("hebrew"), v.literal("english"), v.literal("arabic"), v.literal("russian")),
    ),
    requiredCapabilityTags: v.optional(v.array(v.string())),
    preferredCapabilityTags: v.optional(v.array(v.string())),
    isRecurring: v.optional(v.boolean()),
    cancellationDeadlineHours: v.optional(v.number()),
    applicationDeadline: v.optional(v.number()),
    autoAcceptEnabled: v.optional(v.boolean()),
    expiryOverrideMinutes: v.optional(v.number()),
    boostPreset: v.optional(v.union(v.literal("small"), v.literal("medium"), v.literal("large"))),
    boostBonusAmount: v.optional(v.number()),
    boostActive: v.optional(v.boolean()),
    boostTriggerMinutes: v.optional(v.number()),
    branchNameSnapshot: v.optional(v.string()),
    branchAddressSnapshot: v.optional(v.string()),
    closureReason: v.optional(
      v.union(v.literal("studio_cancelled"), v.literal("expired"), v.literal("filled")),
    ),
  })
    .index("by_studio", ["studioId"])
    .index("by_studio_postedAt", ["studioId", "postedAt"])
    .index("by_studio_startTime", ["studioId", "startTime"])
    .index("by_branch_postedAt", ["branchId", "postedAt"])
    .index("by_branch_startTime", ["branchId", "startTime"])
    .index("by_status", ["status"])
    .index("by_status_startTime", ["status", "startTime"])
    .index("by_status_postedAt", ["status", "postedAt"])
    .index("by_filledByInstructor_startTime", ["filledByInstructorId", "startTime"])
    .index("by_sport_and_status", ["sport", "status"])
    .index("by_sport_h3_status_postedAt", ["sport", "h3Index", "status", "postedAt"])
    .index("by_sport_h3_res8_status_postedAt", ["sport", "h3Res8", "status", "postedAt"])
    .index("by_sport_h3_res7_status_postedAt", ["sport", "h3Res7", "status", "postedAt"])
    .index("by_sport_h3_res6_status_postedAt", ["sport", "h3Res6", "status", "postedAt"])
    .index("by_sport_h3_res5_status_postedAt", ["sport", "h3Res5", "status", "postedAt"])
    .index("by_sport_h3_res4_status_postedAt", ["sport", "h3Res4", "status", "postedAt"]),

  lessonCheckIns: defineTable({
    jobId: v.id("jobs"),
    branchId: v.id("studioBranches"),
    studioId: v.id("studioProfiles"),
    instructorId: v.id("instructorProfiles"),
    checkedInByUserId: v.id("users"),
    verificationStatus: v.union(v.literal("verified"), v.literal("rejected")),
    verificationReason: v.union(
      v.literal("verified"),
      v.literal("outside_radius"),
      v.literal("accuracy_too_low"),
      v.literal("sample_too_old"),
      v.literal("outside_check_in_window"),
      v.literal("branch_location_missing"),
    ),
    latitude: v.number(),
    longitude: v.number(),
    accuracyMeters: v.number(),
    sampledAt: v.number(),
    checkedInAt: v.number(),
    distanceToBranchMeters: v.optional(v.number()),
    allowedDistanceMeters: v.optional(v.number()),
  })
    .index("by_job", ["jobId", "checkedInAt"])
    .index("by_job_and_instructor", ["jobId", "instructorId", "checkedInAt"])
    .index("by_instructor", ["instructorId", "checkedInAt"]),

  lessonPresenceEvents: defineTable({
    jobId: v.id("jobs"),
    assignmentId: v.optional(v.id("jobAssignments")),
    branchId: v.id("studioBranches"),
    studioId: v.id("studioProfiles"),
    instructorId: v.id("instructorProfiles"),
    actorUserId: v.id("users"),
    eventType: v.union(v.literal("check_in"), v.literal("check_out"), v.literal("studio_confirm")),
    verificationStatus: v.union(v.literal("verified"), v.literal("rejected")),
    verificationReason: v.union(
      v.literal("verified"),
      v.literal("outside_radius"),
      v.literal("accuracy_too_low"),
      v.literal("sample_too_old"),
      v.literal("outside_check_in_window"),
      v.literal("outside_check_out_window"),
      v.literal("branch_location_missing"),
    ),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    accuracyMeters: v.optional(v.number()),
    sampledAt: v.optional(v.number()),
    occurredAt: v.number(),
    distanceToBranchMeters: v.optional(v.number()),
    allowedDistanceMeters: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_job", ["jobId", "occurredAt"])
    .index("by_assignment", ["assignmentId", "occurredAt"])
    .index("by_job_instructor_event", ["jobId", "instructorId", "eventType", "occurredAt"]),

  jobApplications: defineTable({
    jobId: v.id("jobs"),
    studioId: v.optional(v.id("studioProfiles")),
    branchId: v.optional(v.id("studioBranches")),
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
    .index("by_job_status", ["jobId", "status", "appliedAt"])
    .index("by_studio", ["studioId"])
    .index("by_branch", ["branchId"])
    .index("by_instructor", ["instructorId"])
    .index("by_instructor_appliedAt", ["instructorId", "appliedAt"])
    // SECURITY: Index to prevent duplicate applications (race condition)
    .index("by_job_and_instructor", ["jobId", "instructorId"])
    // SECURITY: Index to prevent multiple accepted applications (double-fill)
    .index("by_job_and_status", ["jobId", "status"]),

  jobAssignments: defineTable({
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    branchId: v.id("studioBranches"),
    instructorId: v.id("instructorProfiles"),
    instructorUserId: v.id("users"),
    sourceApplicationId: v.optional(v.id("jobApplications")),
    slotNumber: v.number(),
    status: v.union(
      v.literal("accepted"),
      v.literal("cancelled"),
      v.literal("completed"),
      v.literal("no_show"),
    ),
    trustSnapshot: v.object({
      identityVerified: v.boolean(),
      insuranceVerified: v.boolean(),
      certificates: v.array(
        v.object({
          specialties: v.array(storedSpecialtyValidator),
          issuerName: v.optional(v.string()),
          certificateTitle: v.optional(v.string()),
          verifiedAt: v.optional(v.number()),
        }),
      ),
    }),
    acceptedAt: v.number(),
    cancelledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_job", ["jobId", "acceptedAt"])
    .index("by_job_status", ["jobId", "status", "acceptedAt"])
    .index("by_instructor_status", ["instructorId", "status", "acceptedAt"])
    .index("by_source_application", ["sourceApplicationId"]),

  jobApplicationStats: defineTable({
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    branchId: v.optional(v.id("studioBranches")),
    applicationsCount: v.number(),
    pendingApplicationsCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_studio", ["studioId"])
    .index("by_branch", ["branchId"]),
};
