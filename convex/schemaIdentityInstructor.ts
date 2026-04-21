import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  diditVerificationStatusValidator,
  instructorCertificateReviewStatusValidator,
  instructorInsuranceReviewStatusValidator,
  socialLinksValidator,
  storedSpecialtyValidator,
} from "./schemaValidators";

export const identityInstructorTables = {
  instructorProfiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    slug: v.optional(v.string()),
    bio: v.optional(v.string()),
    socialLinks: v.optional(socialLinksValidator),
    address: v.optional(v.string()),
    addressCity: v.optional(v.string()),
    addressStreet: v.optional(v.string()),
    addressNumber: v.optional(v.string()),
    addressFloor: v.optional(v.string()),
    addressPostalCode: v.optional(v.string()),
    addressCountry: v.optional(v.string()),
    addressCountryCode: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    workRadiusKm: v.optional(v.number()),
    h3Index: v.optional(v.string()),
    h3Res8: v.optional(v.string()),
    h3Res7: v.optional(v.string()),
    h3Res4: v.optional(v.string()),
    h3Res5: v.optional(v.string()),
    h3Res6: v.optional(v.string()),
    expoPushToken: v.optional(v.string()),
    notificationsEnabled: v.boolean(),
    lessonReminderMinutesBefore: v.optional(v.number()),
    profileImageStorageId: v.optional(v.id("_storage")),
    hourlyRateExpectation: v.optional(v.number()),
    calendarProvider: v.optional(
      v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    ),
    calendarSyncEnabled: v.optional(v.boolean()),
    calendarConnectedAt: v.optional(v.number()),
    diditSessionId: v.optional(v.string()),
    diditVerificationStatus: v.optional(diditVerificationStatusValidator),
    diditStatusRaw: v.optional(v.string()),
    diditDecision: v.optional(v.any()),
    diditLastEventAt: v.optional(v.number()),
    diditVerifiedAt: v.optional(v.number()),
    diditLegalFirstName: v.optional(v.string()),
    diditLegalMiddleName: v.optional(v.string()),
    diditLegalLastName: v.optional(v.string()),
    diditLegalName: v.optional(v.string()),
    professionalRegistryCountry: v.optional(v.string()),
    professionalRegistryIdentifier: v.optional(v.string()),
    professionalRegistryProvider: v.optional(v.string()),
    professionalRegistryStatus: v.optional(
      v.union(v.literal("found"), v.literal("not_found"), v.literal("error")),
    ),
    professionalRegistryCheckedAt: v.optional(v.number()),
    professionalRegistryPublicUrl: v.optional(v.string()),
    professionalRegistryApiUrl: v.optional(v.string()),
    professionalRegistryIsPublic: v.optional(v.boolean()),
    professionalRegistryHasValidRegistration: v.optional(v.boolean()),
    professionalRegistryHolderName: v.optional(v.string()),
    professionalRegistryIssuingAuthority: v.optional(v.string()),
    professionalRegistryNameMatched: v.optional(v.boolean()),
    professionalRegistryExpiresOn: v.optional(v.string()),
    professionalRegistryExpiresAt: v.optional(v.number()),
    professionalRegistryErrorCode: v.optional(v.string()),
    professionalRegistryErrorMessage: v.optional(v.string()),
    professionalRegistryQualifications: v.optional(
      v.array(
        v.object({
          title: v.string(),
          alert: v.optional(v.string()),
          conditions: v.optional(v.string()),
          obtainedOn: v.optional(v.string()),
          obtainedAt: v.optional(v.number()),
          validFromOn: v.optional(v.string()),
          validFromAt: v.optional(v.number()),
          validUntilOn: v.optional(v.string()),
          validUntilAt: v.optional(v.number()),
          lastReviewedOn: v.optional(v.string()),
          lastReviewedAt: v.optional(v.number()),
          renewalRequiredByOn: v.optional(v.string()),
          renewalRequiredByAt: v.optional(v.number()),
        }),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_didit_session_id", ["diditSessionId"])
    .index("by_slug", ["slug"])
    .index("by_h3_index", ["h3Index"])
    .index("by_h3_res8", ["h3Res8"])
    .index("by_h3_res7", ["h3Res7"]),

  instructorHexCoverage: defineTable({
    instructorId: v.id("instructorProfiles"),
    sport: v.string(),
    cell: v.string(),
    resolution: v.number(),
    createdAt: v.number(),
  })
    .index("by_instructor", ["instructorId"])
    .index("by_instructor_sport", ["instructorId", "sport"])
    .index("by_sport_cell", ["sport", "cell"]),

  instructorCertificates: defineTable({
    instructorId: v.id("instructorProfiles"),
    sport: v.optional(v.string()),
    specialties: v.optional(v.array(storedSpecialtyValidator)),
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    fileSizeBytes: v.optional(v.number()),
    reviewStatus: instructorCertificateReviewStatusValidator,
    reviewProvider: v.optional(v.literal("gemini")),
    issuerName: v.optional(v.string()),
    certificateTitle: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    reviewSummary: v.optional(v.string()),
    reviewJson: v.optional(v.string()),
    rejectionReasons: v.optional(v.array(v.string())),
    uploadedAt: v.number(),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_instructor", ["instructorId"])
    .index("by_instructor_review", ["instructorId", "reviewStatus"]),

  instructorInsurancePolicies: defineTable({
    instructorId: v.id("instructorProfiles"),
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    fileSizeBytes: v.optional(v.number()),
    reviewStatus: instructorInsuranceReviewStatusValidator,
    reviewProvider: v.optional(v.literal("gemini")),
    issuerName: v.optional(v.string()),
    policyHolderName: v.optional(v.string()),
    policyNumber: v.optional(v.string()),
    expiresOn: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    reviewSummary: v.optional(v.string()),
    reviewJson: v.optional(v.string()),
    rejectionReasons: v.optional(v.array(v.string())),
    uploadedAt: v.number(),
    reviewedAt: v.optional(v.number()),
    monthReminderSentAt: v.optional(v.number()),
    weekReminderSentAt: v.optional(v.number()),
    firstReminderSentAt: v.optional(v.number()),
    finalReminderSentAt: v.optional(v.number()),
    dayReminderSentAt: v.optional(v.number()),
    expiredNoticeSentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_instructor", ["instructorId"])
    .index("by_instructor_review", ["instructorId", "reviewStatus"])
    .index("by_expiresAt", ["expiresAt"]),

  instructorSports: defineTable({
    instructorId: v.id("instructorProfiles"),
    sport: v.string(),
    createdAt: v.number(),
  })
    .index("by_instructor_id", ["instructorId"])
    .index("by_sport", ["sport"])
    .index("by_instructor_and_sport", ["instructorId", "sport"]),
};
