import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  diditVerificationStatusValidator,
  instructorCertificateReviewStatusValidator,
  instructorInsuranceReviewStatusValidator,
} from "./lib/instructorCompliance";

const socialLinksValidator = v.object({
  instagram: v.optional(v.string()),
  tiktok: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
  facebook: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  website: v.optional(v.string()),
});

const rapydCanonicalPayloadValidator = v.any();

const rapydProviderResponsePayloadValidator = v.any();

const diditCanonicalPayloadValidator = v.any();

const storedSpecialtyValidator = v.object({
  sport: v.string(),
  capabilityTags: v.optional(v.array(v.string())),
});

const paymentMetadataValidator = v.object({
  sport: v.optional(v.string()),
  startTime: v.optional(v.number()),
  rapydProviderStatus: v.optional(v.string()),
  rapydRequestedPaymentMethodSelectors: v.optional(v.array(v.string())),
  rapydResolvedPaymentMethodTypes: v.optional(v.array(v.string())),
});

const integrationMetadataValidator = v.object({
  providerPaymentId: v.optional(v.string()),
  providerCheckoutId: v.optional(v.string()),
  merchantReferenceId: v.optional(v.string()),
  statusRaw: v.optional(v.string()),
  providerPayoutId: v.optional(v.string()),
  payoutId: v.optional(v.string()),
  beneficiaryId: v.optional(v.string()),
  payoutMethodType: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  vendorData: v.optional(v.string()),
  decisionJson: v.optional(v.string()),
});

const providerMethodDescriptorValidator = v.object({
  type: v.string(),
  category: v.optional(v.string()),
  paymentFlowType: v.optional(v.string()),
  payoutMethodType: v.optional(v.string()),
  name: v.optional(v.string()),
  status: v.optional(v.union(v.string(), v.number())),
  countries: v.optional(v.array(v.string())),
  currencies: v.optional(v.array(v.string())),
  supportedDigitalWalletProviders: v.optional(v.array(v.string())),
});

const providerRequiredFieldValidator = v.object({
  name: v.string(),
  type: v.optional(v.string()),
  required: v.optional(v.boolean()),
  description: v.optional(v.string()),
});

export default defineSchema({
  ...authTables,
  users: defineTable({
    role: v.union(v.literal("pending"), v.literal("instructor"), v.literal("studio")),
    roles: v.optional(v.array(v.union(v.literal("instructor"), v.literal("studio")))),
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
    .index("by_role", ["role"])
    .index("by_email", ["email"]),

  profileImageUploadSessions: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("instructor"), v.literal("studio")),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_token", ["token"])
    .index("by_expiresAt", ["expiresAt"]),

  instructorDocumentUploadSessions: defineTable({
    userId: v.id("users"),
    instructorId: v.id("instructorProfiles"),
    kind: v.union(v.literal("certificate"), v.literal("insurance")),
    sport: v.optional(v.string()),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_instructor", ["instructorId", "createdAt"])
    .index("by_token", ["token"])
    .index("by_expiresAt", ["expiresAt"]),

  instructorProfiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    bio: v.optional(v.string()),
    socialLinks: v.optional(socialLinksValidator),
    address: v.optional(v.string()),
    addressCity: v.optional(v.string()),
    addressStreet: v.optional(v.string()),
    addressNumber: v.optional(v.string()),
    addressFloor: v.optional(v.string()),
    addressPostalCode: v.optional(v.string()),
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
    diditDecision: v.optional(v.any()),
    diditLastEventAt: v.optional(v.number()),
    diditVerifiedAt: v.optional(v.number()),
    diditLegalFirstName: v.optional(v.string()),
    diditLegalMiddleName: v.optional(v.string()),
    diditLegalLastName: v.optional(v.string()),
    diditLegalName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_didit_session_id", ["diditSessionId"]),

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
    policyNumber: v.optional(v.string()),
    expiresOn: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    reviewSummary: v.optional(v.string()),
    reviewJson: v.optional(v.string()),
    rejectionReasons: v.optional(v.array(v.string())),
    uploadedAt: v.number(),
    reviewedAt: v.optional(v.number()),
    firstReminderSentAt: v.optional(v.number()),
    finalReminderSentAt: v.optional(v.number()),
    expiredNoticeSentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_instructor", ["instructorId"])
    .index("by_instructor_review", ["instructorId", "reviewStatus"])
    .index("by_expiresAt", ["expiresAt"]),

  calendarIntegrations: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("instructor"), v.literal("studio")),
    instructorId: v.optional(v.id("instructorProfiles")),
    studioId: v.optional(v.id("studioProfiles")),
    branchId: v.optional(v.id("studioBranches")),
    provider: v.union(v.literal("google"), v.literal("apple")),
    status: v.union(v.literal("connected"), v.literal("error"), v.literal("revoked")),
    accountEmail: v.optional(v.string()),
    oauthClientId: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    scopes: v.optional(v.array(v.string())),
    agendaSyncToken: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_provider", ["userId", "provider"])
    .index("by_instructor_provider", ["instructorId", "provider"])
    .index("by_studio_provider", ["studioId", "provider"])
    .index("by_branch_provider", ["branchId", "provider"]),

  calendarEventMappings: defineTable({
    integrationId: v.id("calendarIntegrations"),
    externalEventId: v.string(),
    providerEventId: v.string(),
    providerEtag: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_integration", ["integrationId"])
    .index("by_integration_external_event", ["integrationId", "externalEventId"])
    .index("by_integration_provider_event", ["integrationId", "providerEventId"]),

  calendarExternalEvents: defineTable({
    integrationId: v.id("calendarIntegrations"),
    providerEventId: v.string(),
    title: v.string(),
    status: v.union(v.literal("confirmed"), v.literal("tentative"), v.literal("cancelled")),
    startTime: v.number(),
    endTime: v.number(),
    isAllDay: v.boolean(),
    location: v.optional(v.string()),
    htmlLink: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    providerUpdatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_integration", ["integrationId"])
    .index("by_integration_provider_event", ["integrationId", "providerEventId"])
    .index("by_integration_start_time", ["integrationId", "startTime"]),

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

  studioSports: defineTable({
    studioId: v.id("studioProfiles"),
    sport: v.string(),
    createdAt: v.number(),
  })
    .index("by_studio_id", ["studioId"])
    .index("by_sport", ["sport"])
    .index("by_studio_and_sport", ["studioId", "sport"]),

  studioProfiles: defineTable({
    userId: v.id("users"),
    studioName: v.string(),
    bio: v.optional(v.string()),
    socialLinks: v.optional(socialLinksValidator),
    address: v.string(),
    addressCity: v.optional(v.string()),
    addressStreet: v.optional(v.string()),
    addressNumber: v.optional(v.string()),
    addressFloor: v.optional(v.string()),
    addressPostalCode: v.optional(v.string()),
    zone: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    contactPhone: v.optional(v.string()),
    mapMarkerColor: v.optional(v.string()),
    expoPushToken: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
    logoStorageId: v.optional(v.id("_storage")),
    autoExpireMinutesBefore: v.optional(v.number()),
    // NEW: studio-level marketplace auto-accept default (additive, optional)
    autoAcceptDefault: v.optional(v.boolean()),
    calendarProvider: v.optional(
      v.union(v.literal("none"), v.literal("google"), v.literal("apple")),
    ),
    calendarSyncEnabled: v.optional(v.boolean()),
    calendarConnectedAt: v.optional(v.number()),
    diditSessionId: v.optional(v.string()),
    diditVerificationStatus: v.optional(diditVerificationStatusValidator),
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
    .index("by_zone", ["zone"]),

  studioBillingProfiles: defineTable({
    studioId: v.id("studioProfiles"),
    ownerUserId: v.id("users"),
    legalEntityType: v.union(v.literal("individual"), v.literal("company")),
    legalBusinessName: v.optional(v.string()),
    taxId: v.optional(v.string()),
    vatReportingType: v.optional(
      v.union(
        v.literal("osek_patur"),
        v.literal("osek_murshe"),
        v.literal("company"),
        v.literal("other"),
      ),
    ),
    billingEmail: v.optional(v.string()),
    billingPhone: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
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
    readyForChargesAt: v.optional(v.number()),
    readyForPayoutsAt: v.optional(v.number()),
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
    zone: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    contactPhone: v.optional(v.string()),
    expoPushToken: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
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
    .index("by_zone", ["zone"]),

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

  jobs: defineTable({
    studioId: v.id("studioProfiles"),
    branchId: v.id("studioBranches"),
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
      v.union(v.literal("hebrew"), v.literal("english"), v.literal("arabic"), v.literal("russian")),
    ),
    requiredCapabilityTags: v.optional(v.array(v.string())),
    preferredCapabilityTags: v.optional(v.array(v.string())),
    isRecurring: v.optional(v.boolean()),
    cancellationDeadlineHours: v.optional(v.number()),
    applicationDeadline: v.optional(v.number()),
    // NEW: per-job auto-accept override (additive, optional)
    autoAcceptEnabled: v.optional(v.boolean()),
    // NEW: per-job expiry override in MINUTES (additive, optional)
    expiryOverrideMinutes: v.optional(v.number()),
    // NEW: boost preset metadata (additive, optional)
    boostPreset: v.optional(v.union(v.literal("small"), v.literal("medium"), v.literal("large"))),
    // NEW: boost pay metadata (additive, optional)
    boostBonusAmount: v.optional(v.number()),
    boostActive: v.optional(v.boolean()),
    // NEW: boost trigger time in minutes before session start (additive, optional)
    boostTriggerMinutes: v.optional(v.number()),
    branchNameSnapshot: v.optional(v.string()),
    branchAddressSnapshot: v.optional(v.string()),
    // NEW: closure reason for cancellation/expiry (additive, optional)
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
    .index("by_status_postedAt", ["status", "postedAt"])
    .index("by_filledByInstructor_startTime", ["filledByInstructorId", "startTime"])
    .index("by_sport_and_status", ["sport", "status"])
    .index("by_sport_zone_status_postedAt", ["sport", "zone", "status", "postedAt"])
    .index("by_zone_and_status", ["zone", "status"]),

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
    .index("by_studio", ["studioId"])
    .index("by_branch", ["branchId"])
    .index("by_instructor", ["instructorId"])
    .index("by_instructor_appliedAt", ["instructorId", "appliedAt"])
    .index("by_job_and_instructor", ["jobId", "instructorId"]),

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

  payments: defineTable({
    paymentOrderId: v.optional(v.id("paymentOrders")),
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    branchId: v.optional(v.id("studioBranches")),
    studioUserId: v.id("users"),
    instructorId: v.optional(v.id("instructorProfiles")),
    instructorUserId: v.optional(v.id("users")),
    provider: v.literal("rapyd"),
    providerCheckoutId: v.optional(v.string()),
    providerPaymentId: v.optional(v.string()),
    status: v.union(
      v.literal("created"),
      v.literal("pending"),
      v.literal("authorized"),
      v.literal("captured"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("refunded"),
    ),
    currency: v.string(),
    instructorBaseAmountAgorot: v.number(),
    platformMarkupAmountAgorot: v.number(),
    studioChargeAmountAgorot: v.number(),
    platformMarkupBps: v.number(),
    idempotencyKey: v.string(),
    metadata: v.optional(paymentMetadataValidator),
    branchNameSnapshot: v.optional(v.string()),
    lastError: v.optional(v.string()),
    capturedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_studio", ["studioId", "createdAt"])
    .index("by_branch", ["branchId", "createdAt"])
    .index("by_studio_user", ["studioUserId", "createdAt"])
    .index("by_instructor_user", ["instructorUserId", "createdAt"])
    .index("by_job", ["jobId", "createdAt"])
    .index("by_status", ["status", "createdAt"])
    .index("by_studio_user_idempotency", ["studioUserId", "idempotencyKey"])
    .index("by_payment_order", ["paymentOrderId", "createdAt"])
    .index("by_provider_checkoutId", ["provider", "providerCheckoutId"])
    .index("by_provider_paymentId", ["provider", "providerPaymentId"]),

  paymentEvents: defineTable({
    provider: v.literal("rapyd"),
    providerEventId: v.string(),
    eventType: v.optional(v.string()),
    paymentId: v.optional(v.id("payments")),
    providerPaymentId: v.optional(v.string()),
    providerCheckoutId: v.optional(v.string()),
    statusRaw: v.optional(v.string()),
    signatureValid: v.boolean(),
    processed: v.boolean(),
    payloadHash: v.string(),
    payload: rapydCanonicalPayloadValidator,
    processingError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_provider_eventId", ["provider", "providerEventId"])
    .index("by_payment", ["paymentId", "createdAt"])
    .index("by_provider_payment_processed", [
      "provider",
      "providerPaymentId",
      "processed",
      "createdAt",
    ])
    .index("by_provider_checkout_processed", [
      "provider",
      "providerCheckoutId",
      "processed",
      "createdAt",
    ]),

  invoices: defineTable({
    paymentId: v.id("payments"),
    provider: v.union(v.literal("icount"), v.literal("morning")),
    status: v.union(v.literal("pending"), v.literal("issued"), v.literal("failed")),
    currency: v.string(),
    amountAgorot: v.number(),
    vatRate: v.number(),
    externalInvoiceId: v.optional(v.string()),
    externalInvoiceUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    issuedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_payment", ["paymentId", "createdAt"])
    .index("by_status", ["status", "createdAt"])
    .index("by_provider_external", ["provider", "externalInvoiceId"]),

  payouts: defineTable({
    paymentOrderId: v.optional(v.id("paymentOrders")),
    payoutScheduleId: v.optional(v.id("payoutSchedules")),
    paymentId: v.id("payments"),
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    branchId: v.optional(v.id("studioBranches")),
    studioUserId: v.id("users"),
    instructorId: v.id("instructorProfiles"),
    instructorUserId: v.id("users"),
    destinationId: v.optional(v.id("payoutDestinations")),
    provider: v.literal("rapyd"),
    idempotencyKey: v.string(),
    amountAgorot: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("pending_provider"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("needs_attention"),
    ),
    providerPayoutId: v.optional(v.string()),
    providerStatusRaw: v.optional(v.string()),
    attemptCount: v.number(),
    maxAttempts: v.number(),
    lastError: v.optional(v.string()),
    lastAttemptAt: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
    terminalAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_payment", ["paymentId", "createdAt"])
    .index("by_payment_order", ["paymentOrderId", "createdAt"])
    .index("by_schedule", ["payoutScheduleId", "createdAt"])
    .index("by_studio", ["studioId", "createdAt"])
    .index("by_branch", ["branchId", "createdAt"])
    .index("by_instructor_user", ["instructorUserId", "createdAt"])
    .index("by_destination", ["destinationId", "createdAt"])
    .index("by_status_retryAt", ["status", "nextRetryAt"])
    .index("by_provider_payoutId", ["provider", "providerPayoutId"])
    .index("by_idempotency", ["idempotencyKey"]),

  payoutEvents: defineTable({
    payoutId: v.id("payouts"),
    paymentId: v.id("payments"),
    provider: v.literal("rapyd"),
    eventType: v.union(
      v.literal("attempt_started"),
      v.literal("provider_response"),
      v.literal("retry_scheduled"),
      v.literal("terminal_failure"),
      v.literal("status_update"),
    ),
    attempt: v.optional(v.number()),
    providerEventId: v.optional(v.string()),
    providerPayoutId: v.optional(v.string()),
    statusRaw: v.optional(v.string()),
    mappedStatus: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("processing"),
        v.literal("pending_provider"),
        v.literal("paid"),
        v.literal("failed"),
        v.literal("cancelled"),
        v.literal("needs_attention"),
      ),
    ),
    retryable: v.optional(v.boolean()),
    httpStatus: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    message: v.optional(v.string()),
    payload: v.optional(rapydProviderResponsePayloadValidator),
    createdAt: v.number(),
  })
    .index("by_payout", ["payoutId", "createdAt"])
    .index("by_payment", ["paymentId", "createdAt"])
    .index("by_provider_eventId", ["provider", "providerEventId"]),

  payoutDestinations: defineTable({
    userId: v.id("users"),
    provider: v.literal("rapyd"),
    railCategory: v.union(
      v.literal("bank"),
      v.literal("card"),
      v.literal("ewallet"),
      v.literal("rapyd_wallet"),
    ),
    type: v.string(),
    externalRecipientId: v.string(),
    label: v.optional(v.string()),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    last4: v.optional(v.string()),
    beneficiaryEntityType: v.optional(v.union(v.literal("individual"), v.literal("company"))),
    senderProfileId: v.optional(v.string()),
    isDefault: v.boolean(),
    status: v.union(
      v.literal("pending_verification"),
      v.literal("verified"),
      v.literal("failed"),
      v.literal("expired"),
    ),
    verifiedAt: v.optional(v.number()),
    lastProviderSyncState: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("verified"),
        v.literal("failed"),
        v.literal("expired"),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId", "updatedAt"])
    .index("by_user_provider_external", ["userId", "provider", "externalRecipientId"])
    .index("by_user_default", ["userId", "isDefault", "updatedAt"]),

  payoutDestinationOnboarding: defineTable({
    userId: v.id("users"),
    provider: v.literal("rapyd"),
    merchantReferenceId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("expired"),
    ),
    category: v.string(),
    beneficiaryCountry: v.string(),
    beneficiaryEntityType: v.union(v.literal("individual"), v.literal("company")),
    payoutCurrency: v.string(),
    redirectUrl: v.optional(v.string()),
    beneficiaryId: v.optional(v.string()),
    payoutMethodType: v.optional(v.string()),
    lastError: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_provider_merchant_reference", ["provider", "merchantReferenceId"]),

  payoutDestinationEvents: defineTable({
    provider: v.literal("rapyd"),
    providerEventId: v.string(),
    eventType: v.optional(v.string()),
    onboardingId: v.optional(v.id("payoutDestinationOnboarding")),
    userId: v.optional(v.id("users")),
    destinationId: v.optional(v.id("payoutDestinations")),
    merchantReferenceId: v.optional(v.string()),
    beneficiaryId: v.optional(v.string()),
    payoutMethodType: v.optional(v.string()),
    signatureValid: v.boolean(),
    processed: v.boolean(),
    payloadHash: v.string(),
    payload: rapydCanonicalPayloadValidator,
    processingError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_provider_eventId", ["provider", "providerEventId"])
    .index("by_user", ["userId", "createdAt"]),

  integrationEvents: defineTable({
    provider: v.union(v.literal("rapyd"), v.literal("didit")),
    route: v.union(
      v.literal("payment"),
      v.literal("payout"),
      v.literal("beneficiary"),
      v.literal("kyc"),
    ),
    providerEventId: v.string(),
    eventType: v.optional(v.string()),
    signatureValid: v.boolean(),
    payloadHash: v.string(),
    payload: v.union(rapydCanonicalPayloadValidator, diditCanonicalPayloadValidator),
    metadata: v.optional(integrationMetadataValidator),
    processingState: v.union(v.literal("pending"), v.literal("processed"), v.literal("failed")),
    processingError: v.optional(v.string()),
    sourceEventId: v.optional(v.string()),
    entityId: v.optional(v.string()),
    processedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_provider_eventId", ["provider", "providerEventId"])
    .index("by_provider_processing_createdAt", ["provider", "processingState", "createdAt"])
    .index("by_processing_createdAt", ["processingState", "createdAt"])
    .index("by_processing_provider_route_createdAt", [
      "processingState",
      "provider",
      "route",
      "createdAt",
    ])
    .index("by_provider_route_createdAt", ["provider", "route", "createdAt"]),

  webhookInvalidSignatureThrottle: defineTable({
    provider: v.union(v.literal("rapyd"), v.literal("didit")),
    fingerprint: v.string(),
    invalidCount: v.number(),
    windowStartedAt: v.number(),
    lastInvalidAt: v.number(),
    blockedUntil: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_provider_fingerprint", ["provider", "fingerprint"])
    .index("by_provider_blocked_until", ["provider", "blockedUntil"]),

  // Generic API rate limiting to prevent abuse
  apiRateLimitThrottle: defineTable({
    // Identifier: userId, sessionId, or IP address hash
    identifier: v.string(),
    // Type of operation being rate limited
    operationType: v.union(
      v.literal("query"),
      v.literal("mutation"),
      v.literal("auth"),
      v.literal("payment"),
      v.literal("webhook"),
    ),
    // Sliding window start time
    windowStartedAt: v.number(),
    // Current request count in window
    requestCount: v.number(),
    // If blocked, when the block expires
    blockedUntil: v.optional(v.number()),
    // For payment operations, stricter limits
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_identifier_type", ["identifier", "operationType"])
    .index("by_identifier_blocked_until", ["identifier", "blockedUntil"]),

  diditEvents: defineTable({
    providerEventId: v.string(),
    sessionId: v.optional(v.string()),
    instructorId: v.optional(v.id("instructorProfiles")),
    studioId: v.optional(v.id("studioProfiles")),
    vendorData: v.optional(v.string()),
    statusRaw: v.optional(v.string()),
    mappedStatus: v.optional(
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
    signatureValid: v.boolean(),
    processed: v.boolean(),
    payloadHash: v.string(),
    payload: diditCanonicalPayloadValidator,
    processingError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_provider_event_id", ["providerEventId"])
    .index("by_instructor", ["instructorId", "createdAt"])
    .index("by_studio", ["studioId", "createdAt"]),

  paymentOrders: defineTable({
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    studioUserId: v.id("users"),
    instructorId: v.optional(v.id("instructorProfiles")),
    instructorUserId: v.optional(v.id("users")),
    provider: v.literal("rapyd"),
    correlationToken: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("checkout_pending"),
      v.literal("payment_pending"),
      v.literal("authorized"),
      v.literal("captured"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("refunded"),
    ),
    currency: v.string(),
    instructorGrossAmountAgorot: v.number(),
    platformFeeAmountAgorot: v.number(),
    studioChargeAmountAgorot: v.number(),
    platformFeeBps: v.number(),
    providerCheckoutId: v.optional(v.string()),
    providerPaymentId: v.optional(v.string()),
    latestCheckoutUrl: v.optional(v.string()),
    latestError: v.optional(v.string()),
    capturedAt: v.optional(v.number()),
    releasedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_job", ["jobId", "createdAt"])
    .index("by_studio_user", ["studioUserId", "createdAt"])
    .index("by_instructor_user", ["instructorUserId", "createdAt"])
    .index("by_correlation_token", ["correlationToken"])
    .index("by_provider_checkout", ["provider", "providerCheckoutId"])
    .index("by_provider_payment", ["provider", "providerPaymentId"]),

  paymentProviderLinks: defineTable({
    provider: v.literal("rapyd"),
    paymentOrderId: v.id("paymentOrders"),
    legacyPaymentId: v.optional(v.id("payments")),
    providerObjectType: v.union(
      v.literal("merchant_reference"),
      v.literal("checkout"),
      v.literal("payment"),
    ),
    providerObjectId: v.string(),
    correlationToken: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_provider_object", ["provider", "providerObjectType", "providerObjectId"])
    .index("by_payment_order", ["paymentOrderId", "createdAt"])
    .index("by_legacy_payment", ["legacyPaymentId", "createdAt"])
    .index("by_correlation_token", ["correlationToken"]),

  ledgerEntries: defineTable({
    paymentOrderId: v.id("paymentOrders"),
    jobId: v.id("jobs"),
    studioUserId: v.id("users"),
    instructorUserId: v.optional(v.id("users")),
    payoutScheduleId: v.optional(v.id("payoutSchedules")),
    payoutId: v.optional(v.id("payouts")),
    dedupeKey: v.string(),
    entryType: v.union(
      v.literal("charge_gross"),
      v.literal("platform_fee"),
      v.literal("instructor_gross"),
      v.literal("provider_fee"),
      v.literal("refund"),
      v.literal("refund_fee_impact"),
      v.literal("payout_reserved"),
      v.literal("payout_sent"),
      v.literal("payout_failed"),
      v.literal("adjustment"),
    ),
    balanceBucket: v.union(
      v.literal("provider_clearing"),
      v.literal("platform_available"),
      v.literal("instructor_held"),
      v.literal("instructor_available"),
      v.literal("instructor_reserved"),
      v.literal("instructor_paid"),
      v.literal("adjustments"),
    ),
    amountAgorot: v.number(),
    currency: v.string(),
    referenceType: v.union(
      v.literal("payment_order"),
      v.literal("provider_event"),
      v.literal("job_completion"),
      v.literal("payout_schedule"),
      v.literal("payout"),
      v.literal("refund"),
      v.literal("adjustment"),
    ),
    referenceId: v.string(),
    createdAt: v.number(),
  })
    .index("by_payment_order", ["paymentOrderId", "createdAt"])
    .index("by_instructor_bucket", ["instructorUserId", "balanceBucket", "createdAt"])
    .index("by_reference", ["referenceType", "referenceId", "createdAt"])
    .index("by_dedupe_key", ["dedupeKey"]),

  payoutReleaseRules: defineTable({
    userId: v.id("users"),
    preferenceMode: v.union(
      v.literal("immediate_when_eligible"),
      v.literal("scheduled_date"),
      v.literal("manual_hold"),
    ),
    scheduledDate: v.optional(v.number()),
    destinationId: v.optional(v.id("payoutDestinations")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  payoutSchedules: defineTable({
    paymentOrderId: v.id("paymentOrders"),
    sourcePaymentId: v.optional(v.id("payments")),
    payoutId: v.optional(v.id("payouts")),
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    studioUserId: v.id("users"),
    instructorId: v.id("instructorProfiles"),
    instructorUserId: v.id("users"),
    destinationId: v.optional(v.id("payoutDestinations")),
    status: v.union(
      v.literal("blocked"),
      v.literal("pending_eligibility"),
      v.literal("available"),
      v.literal("scheduled"),
      v.literal("processing"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("needs_attention"),
    ),
    amountAgorot: v.number(),
    currency: v.string(),
    releaseAfter: v.optional(v.number()),
    readyAt: v.optional(v.number()),
    executedAt: v.optional(v.number()),
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_payment_order", ["paymentOrderId", "createdAt"])
    .index("by_instructor_user", ["instructorUserId", "createdAt"])
    .index("by_status_readyAt", ["status", "readyAt"])
    .index("by_payout", ["payoutId", "createdAt"]),

  payoutProviderLinks: defineTable({
    provider: v.literal("rapyd"),
    payoutScheduleId: v.id("payoutSchedules"),
    payoutId: v.optional(v.id("payouts")),
    providerPayoutId: v.optional(v.string()),
    merchantReferenceId: v.string(),
    correlationToken: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_schedule", ["payoutScheduleId", "createdAt"])
    .index("by_payout", ["payoutId", "createdAt"])
    .index("by_provider_payout", ["provider", "providerPayoutId"])
    .index("by_merchant_reference", ["provider", "merchantReferenceId"]),

  webhookDeliveries: defineTable({
    provider: v.union(v.literal("rapyd"), v.literal("didit")),
    route: v.union(
      v.literal("payment"),
      v.literal("payout"),
      v.literal("beneficiary"),
      v.literal("kyc"),
    ),
    providerEventId: v.string(),
    deliveryKey: v.string(),
    eventType: v.optional(v.string()),
    signatureValid: v.boolean(),
    timestampValid: v.boolean(),
    payloadHash: v.string(),
    processingState: v.union(v.literal("pending"), v.literal("processed"), v.literal("failed")),
    integrationEventId: v.optional(v.id("integrationEvents")),
    processingError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_delivery_key", ["provider", "deliveryKey"])
    .index("by_provider_event", ["provider", "providerEventId", "createdAt"])
    .index("by_processing", ["processingState", "createdAt"]),

  providerMethodCache: defineTable({
    provider: v.literal("rapyd"),
    kind: v.union(
      v.literal("payment_methods_country"),
      v.literal("payout_method_types"),
      v.literal("payout_required_fields"),
    ),
    cacheKey: v.string(),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    expiresAt: v.number(),
    payload: v.object({
      methods: v.optional(v.array(providerMethodDescriptorValidator)),
      requiredFields: v.optional(v.array(providerRequiredFieldValidator)),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_kind_cache_key", ["provider", "kind", "cacheKey"])
    .index("by_expiresAt", ["expiresAt"]),

  userNotifications: defineTable({
    recipientUserId: v.id("users"),
    actorUserId: v.optional(v.id("users")),
    kind: v.union(
      v.literal("application_received"),
      v.literal("application_accepted"),
      v.literal("application_rejected"),
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
});
