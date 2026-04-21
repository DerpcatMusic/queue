import { defineTable } from "convex/server";
import { v } from "convex/values";
import { socialLinksValidator } from "./schemaValidators";

export const identityStudioTables = {
  studioProfiles: defineTable({
    userId: v.id("users"),
    studioName: v.string(),
    slug: v.optional(v.string()),
    bio: v.optional(v.string()),
    socialLinks: v.optional(socialLinksValidator),
    address: v.string(),
    addressCity: v.optional(v.string()),
    addressStreet: v.optional(v.string()),
    addressNumber: v.optional(v.string()),
    addressFloor: v.optional(v.string()),
    addressPostalCode: v.optional(v.string()),
    addressCountry: v.optional(v.string()),
    addressCountryCode: v.optional(v.string()),
    zone: v.optional(v.string()),
    boundaryProvider: v.optional(v.string()),
    boundaryId: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    h3Index: v.optional(v.string()),
    h3Res8: v.optional(v.string()),
    h3Res7: v.optional(v.string()),
    h3Res4: v.optional(v.string()),
    h3Res5: v.optional(v.string()),
    h3Res6: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    mapMarkerColor: v.optional(v.string()),
    expoPushToken: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
    lessonReminderMinutesBefore: v.optional(v.number()),
    logoStorageId: v.optional(v.id("_storage")),
    autoExpireMinutesBefore: v.optional(v.number()),
    autoAcceptDefault: v.optional(v.boolean()),
    calendarProvider: v.optional(
      v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    ),
    calendarSyncEnabled: v.optional(v.boolean()),
    calendarConnectedAt: v.optional(v.number()),
    diditSessionId: v.optional(v.string()),
    diditVerificationStatus: v.optional(
      v.union(
        v.literal("not_started"),
        v.literal("in_progress"),
        v.literal("pending"),
        v.literal("in_review"),
        v.literal("approved"),
        v.literal("declined"),
        v.literal("abandoned"),
        v.literal("expired"),
      ),
    ),
    diditStatusRaw: v.optional(v.string()),
    diditLastEventAt: v.optional(v.number()),
    diditVerifiedAt: v.optional(v.number()),
    diditDecision: v.optional(v.any()),
    diditLegalName: v.optional(v.string()),
    diditLegalFirstName: v.optional(v.string()),
    diditLegalMiddleName: v.optional(v.string()),
    diditLegalLastName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_didit_session_id", ["diditSessionId"])
    .index("by_slug", ["slug"]),

  studioBillingProfiles: defineTable({
    studioId: v.id("studioProfiles"),
    ownerUserId: v.id("users"),
    country: v.optional(v.string()),
    legalEntityType: v.union(v.literal("individual"), v.literal("company")),
    legalBusinessName: v.optional(v.string()),
    taxId: v.optional(v.string()),
    taxClassification: v.optional(v.string()),
    vatReportingType: v.optional(
      v.union(
        v.literal("osek_patur"),
        v.literal("osek_murshe"),
        v.literal("company"),
        v.literal("other"),
      ),
    ),
    companyRegNumber: v.optional(v.string()),
    legalForm: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    billingPhone: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    billingAddressStructured: v.optional(
      v.object({
        line1: v.string(),
        line2: v.optional(v.string()),
        city: v.string(),
        state: v.optional(v.string()),
        postalCode: v.string(),
        country: v.optional(v.string()),
      }),
    ),
    status: v.union(v.literal("incomplete"), v.literal("complete")),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_studio", ["studioId"])
    .index("by_owner_user", ["ownerUserId"]),

  studioPaymentProfiles: defineTable({
    studioId: v.id("studioProfiles"),
    provider: v.string(),
    status: v.union(
      v.literal("missing"),
      v.literal("pending"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    providerCustomerId: v.optional(v.string()),
    providerMerchantId: v.optional(v.string()),
    providerReference: v.optional(v.string()),
    displayName: v.optional(v.string()),
    requirementsSummary: v.optional(v.string()),
    chargesEnabled: v.optional(v.boolean()),
    payoutsEnabled: v.optional(v.boolean()),
    savedPaymentMethodCount: v.optional(v.number()),
    defaultPaymentMethodType: v.optional(v.string()),
    supportedPaymentMethodTypes: v.optional(v.array(v.string())),
    readyForChargesAt: v.optional(v.number()),
    readyForPayoutsAt: v.optional(v.number()),
    lastPaymentMethodSyncedAt: v.optional(v.number()),
    lastSyncedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_studio", ["studioId"])
    .index("by_provider_reference", ["provider", "providerReference"]),

  studioBranches: defineTable({
    studioId: v.id("studioProfiles"),
    name: v.string(),
    slug: v.string(),
    address: v.string(),
    zone: v.optional(v.string()),
    boundaryProvider: v.optional(v.string()),
    boundaryId: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    h3Index: v.optional(v.string()),
    h3Res8: v.optional(v.string()),
    h3Res7: v.optional(v.string()),
    h3Res4: v.optional(v.string()),
    h3Res5: v.optional(v.string()),
    h3Res6: v.optional(v.string()),
    arrivalRadiusMeters: v.optional(v.number()),
    contactPhone: v.optional(v.string()),
    expoPushToken: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
    lessonReminderMinutesBefore: v.optional(v.number()),
    autoExpireMinutesBefore: v.optional(v.number()),
    autoAcceptDefault: v.optional(v.boolean()),
    calendarProvider: v.optional(
      v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    ),
    calendarSyncEnabled: v.optional(v.boolean()),
    calendarConnectedAt: v.optional(v.number()),
    isPrimary: v.boolean(),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_studio_id", ["studioId"])
    .index("by_studio_active", ["studioId", "status"])
    .index("by_studio_slug", ["studioId", "slug"])
    .index("by_studio_primary", ["studioId", "isPrimary"])
    .index("by_h3_index", ["h3Index"])
    .index("by_h3_res8", ["h3Res8"])
    .index("by_h3_res7", ["h3Res7"])
    .index("by_h3_res6", ["h3Res6"])
    .index("by_h3_res5", ["h3Res5"])
    .index("by_h3_res4", ["h3Res4"]),

  studioMemberships: defineTable({
    studioId: v.id("studioProfiles"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("branch_manager")),
    branchIds: v.optional(v.array(v.id("studioBranches"))),
    status: v.union(v.literal("active"), v.literal("invited"), v.literal("revoked")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_studio", ["studioId"])
    .index("by_user", ["userId"])
    .index("by_studio_user", ["studioId", "userId"])
    .index("by_studio_status", ["studioId", "status"]),

  studioEntitlements: defineTable({
    studioId: v.id("studioProfiles"),
    planKey: v.union(v.literal("free"), v.literal("growth"), v.literal("custom")),
    maxBranches: v.number(),
    branchesFeatureEnabled: v.boolean(),
    subscriptionStatus: v.union(
      v.literal("active"),
      v.literal("trialing"),
      v.literal("past_due"),
      v.literal("canceled"),
    ),
    effectiveAt: v.number(),
    updatedAt: v.number(),
  }).index("by_studio_id", ["studioId"]),

  studioSports: defineTable({
    studioId: v.id("studioProfiles"),
    sport: v.string(),
    createdAt: v.number(),
  })
    .index("by_studio_id", ["studioId"])
    .index("by_sport", ["sport"])
    .index("by_studio_and_sport", ["studioId", "sport"]),
};
