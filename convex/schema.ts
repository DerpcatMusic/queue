import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  diditVerificationStatusValidator,
  instructorCertificateReviewStatusValidator,
  instructorInsuranceReviewStatusValidator,
} from "./lib/instructorCompliance";
import { internalAccessRoleValidator } from "./lib/internalAccess";
import {
  NOTIFICATION_INBOX_KINDS,
  NOTIFICATION_PREFERENCE_KEYS,
} from "./lib/notificationPreferences";

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

const airwallexCanonicalPayloadValidator = v.any();

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

const v2MoneyBreakdownValidator = v.object({
  baseLessonAmountAgorot: v.number(),
  bonusAmountAgorot: v.number(),
  instructorOfferAmountAgorot: v.number(),
  platformServiceFeeAgorot: v.number(),
  studioChargeAmountAgorot: v.number(),
});

const v2PricingSnapshotValidator = v.object({
  pricingRuleVersion: v.string(),
  feeMode: v.union(v.literal("standard"), v.literal("bonus")),
  hasBonus: v.boolean(),
});

const v2MetadataValidator = v.object({
  jobSnapshotStatus: v.optional(v.string()),
  failureCode: v.optional(v.string()),
  failureReason: v.optional(v.string()),
  providerStatusRaw: v.optional(v.string()),
  providerEventId: v.optional(v.string()),
});

const integrationMetadataValidator = v.object({
  providerPaymentId: v.optional(v.string()),
  providerCheckoutId: v.optional(v.string()),
  merchantReferenceId: v.optional(v.string()),
  statusRaw: v.optional(v.string()),
  providerPayoutId: v.optional(v.string()),
  providerAccountId: v.optional(v.string()),
  providerFundsSplitId: v.optional(v.string()),
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

const v2ConnectedAccountStatusValidator = v.union(
  v.literal("pending"),
  v.literal("action_required"),
  v.literal("active"),
  v.literal("restricted"),
  v.literal("rejected"),
  v.literal("disabled"),
);

const v2RequirementKindValidator = v.union(
  v.literal("agreement"),
  v.literal("identity"),
  v.literal("business"),
  v.literal("bank_account"),
  v.literal("payment_method"),
  v.literal("other"),
);

const v2PaymentOrderStatusValidator = v.union(
  v.literal("draft"),
  v.literal("requires_payment_method"),
  v.literal("processing"),
  v.literal("succeeded"),
  v.literal("partially_refunded"),
  v.literal("refunded"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const v2FundSplitStatusValidator = v.union(
  v.literal("pending_create"),
  v.literal("created"),
  v.literal("released"),
  v.literal("settled"),
  v.literal("failed"),
  v.literal("reversed"),
);

const v2PayoutTransferStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("sent"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("needs_attention"),
);

const v2LedgerEntryTypeValidator = v.union(
  v.literal("studio_charge"),
  v.literal("platform_gross_revenue"),
  v.literal("processor_fee_expense"),
  v.literal("instructor_offer_reserved"),
  v.literal("fund_split_created"),
  v.literal("fund_split_released"),
  v.literal("payout_transfer_sent"),
  v.literal("refund_gross"),
  v.literal("refund_platform_reversal"),
  v.literal("refund_instructor_reversal"),
  v.literal("adjustment"),
);

const v2LedgerBucketValidator = v.union(
  v.literal("provider_clearing"),
  v.literal("platform_gross_revenue"),
  v.literal("platform_fee_expense"),
  v.literal("platform_net_revenue"),
  v.literal("instructor_split_pending"),
  v.literal("instructor_split_available"),
  v.literal("instructor_payout_in_flight"),
  v.literal("instructor_paid_out"),
  v.literal("refund_reserve"),
  v.literal("adjustments"),
);

const notificationPreferenceKeyValidator = v.union(
  ...NOTIFICATION_PREFERENCE_KEYS.map((key) => v.literal(key)),
);

const notificationInboxKindValidator = v.union(
  ...NOTIFICATION_INBOX_KINDS.map((kind) => v.literal(kind)),
);

const notificationScheduleStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("sent"),
  v.literal("cancelled"),
  v.literal("skipped"),
);

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
    notificationClientLastSeenAt: v.optional(v.number()),
    notificationLocalRemindersCoverageUntil: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_role", ["role"])
    .index("by_email", ["email"]),

  internalAccessGrants: defineTable({
    userId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    role: internalAccessRoleValidator,
    verificationBypass: v.boolean(),
    active: v.boolean(),
    notes: v.optional(v.string()),
    grantedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_active", ["userId", "active", "updatedAt"])
    .index("by_email_active", ["email", "active", "updatedAt"])
    .index("by_role_active", ["role", "active", "updatedAt"]),

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
    lessonReminderMinutesBefore: v.optional(v.number()),
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
    /** Name of the person who holds/is named on the insurance policy (the insured instructor) */
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
    lessonReminderMinutesBefore: v.optional(v.number()),
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
    .index("by_status_startTime", ["status", "startTime"])
    .index("by_status_postedAt", ["status", "postedAt"])
    .index("by_filledByInstructor_startTime", ["filledByInstructorId", "startTime"])
    .index("by_sport_and_status", ["sport", "status"])
    .index("by_sport_zone_status_postedAt", ["sport", "zone", "status", "postedAt"])
    .index("by_zone_and_status", ["zone", "status"]),

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
    provider: v.union(v.literal("rapyd"), v.literal("didit"), v.literal("airwallex")),
    route: v.union(
      v.literal("payment"),
      v.literal("payout"),
      v.literal("beneficiary"),
      v.literal("kyc"),
      v.literal("connected_account"),
      v.literal("fund_split"),
    ),
    providerEventId: v.string(),
    eventType: v.optional(v.string()),
    signatureValid: v.boolean(),
    payloadHash: v.string(),
    payload: v.union(
      rapydCanonicalPayloadValidator,
      diditCanonicalPayloadValidator,
      airwallexCanonicalPayloadValidator,
    ),
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
    provider: v.union(v.literal("rapyd"), v.literal("didit"), v.literal("airwallex")),
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

  paymentOffersV2: defineTable({
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    studioUserId: v.id("users"),
    instructorId: v.id("instructorProfiles"),
    instructorUserId: v.id("users"),
    providerCountry: v.string(),
    currency: v.string(),
    pricing: v2MoneyBreakdownValidator,
    pricingSnapshot: v2PricingSnapshotValidator,
    bonusReason: v.optional(v.string()),
    bonusAppliedByUserId: v.optional(v.id("users")),
    status: v.union(
      v.literal("draft"),
      v.literal("ready"),
      v.literal("superseded"),
      v.literal("paid"),
      v.literal("cancelled"),
    ),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(v2MetadataValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_job", ["jobId", "createdAt"])
    .index("by_studio_user", ["studioUserId", "createdAt"])
    .index("by_instructor_user", ["instructorUserId", "createdAt"])
    .index("by_status", ["status", "createdAt"]),

  paymentOrdersV2: defineTable({
    offerId: v.id("paymentOffersV2"),
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    studioUserId: v.id("users"),
    instructorId: v.id("instructorProfiles"),
    instructorUserId: v.id("users"),
    provider: v.literal("airwallex"),
    status: v2PaymentOrderStatusValidator,
    providerCountry: v.string(),
    currency: v.string(),
    pricing: v2MoneyBreakdownValidator,
    capturedAmountAgorot: v.number(),
    refundedAmountAgorot: v.number(),
    correlationKey: v.string(),
    latestError: v.optional(v.string()),
    metadata: v.optional(v2MetadataValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
    succeededAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
  })
    .index("by_offer", ["offerId", "createdAt"])
    .index("by_job", ["jobId", "createdAt"])
    .index("by_studio_user", ["studioUserId", "createdAt"])
    .index("by_instructor_user", ["instructorUserId", "createdAt"])
    .index("by_status", ["status", "createdAt"])
    .index("by_correlation_key", ["correlationKey"]),

  paymentAttemptsV2: defineTable({
    paymentOrderId: v.id("paymentOrdersV2"),
    provider: v.literal("airwallex"),
    providerPaymentIntentId: v.string(),
    providerAttemptId: v.optional(v.string()),
    clientSecretRef: v.optional(v.string()),
    status: v2PaymentOrderStatusValidator,
    statusRaw: v.optional(v.string()),
    requestId: v.string(),
    idempotencyKey: v.string(),
    lastError: v.optional(v.string()),
    metadata: v.optional(v2MetadataValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_payment_order", ["paymentOrderId", "createdAt"])
    .index("by_provider_payment_intent", ["provider", "providerPaymentIntentId"])
    .index("by_idempotency", ["idempotencyKey"]),

  providerObjectsV2: defineTable({
    provider: v.literal("airwallex"),
    entityType: v.union(
      v.literal("payment_order"),
      v.literal("payment_attempt"),
      v.literal("connected_account"),
      v.literal("fund_split"),
      v.literal("payout_transfer"),
    ),
    entityId: v.string(),
    providerObjectType: v.string(),
    providerObjectId: v.string(),
    createdAt: v.number(),
  })
    .index("by_provider_object", ["provider", "providerObjectType", "providerObjectId"])
    .index("by_entity", ["entityType", "entityId", "createdAt"]),

  connectedAccountsV2: defineTable({
    userId: v.id("users"),
    role: v.literal("instructor"),
    provider: v.literal("airwallex"),
    providerAccountId: v.string(),
    accountCapability: v.union(v.literal("ledger"), v.literal("withdrawal"), v.literal("full")),
    status: v2ConnectedAccountStatusValidator,
    kycStatus: v.optional(v.string()),
    kybStatus: v.optional(v.string()),
    serviceAgreementType: v.optional(v.string()),
    country: v.string(),
    currency: v.string(),
    defaultPayoutMethod: v.optional(v.string()),
    metadata: v.optional(v2MetadataValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
    activatedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_provider_account", ["provider", "providerAccountId"])
    .index("by_status", ["status", "createdAt"]),

  connectedAccountRequirementsV2: defineTable({
    connectedAccountId: v.id("connectedAccountsV2"),
    providerRequirementId: v.string(),
    kind: v2RequirementKindValidator,
    code: v.optional(v.string()),
    message: v.string(),
    blocking: v.boolean(),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_connected_account", ["connectedAccountId", "createdAt"])
    .index("by_unresolved_blocking", ["blocking", "resolvedAt", "createdAt"]),

  fundSplitsV2: defineTable({
    paymentOrderId: v.id("paymentOrdersV2"),
    paymentAttemptId: v.id("paymentAttemptsV2"),
    connectedAccountId: v.id("connectedAccountsV2"),
    provider: v.literal("airwallex"),
    providerFundsSplitId: v.optional(v.string()),
    sourcePaymentIntentId: v.string(),
    destinationAccountId: v.string(),
    amountAgorot: v.number(),
    currency: v.string(),
    autoRelease: v.boolean(),
    releaseMode: v.union(
      v.literal("automatic"),
      v.literal("manual"),
      v.literal("scheduled"),
    ),
    status: v2FundSplitStatusValidator,
    requestId: v.string(),
    idempotencyKey: v.string(),
    failureReason: v.optional(v.string()),
    metadata: v.optional(v2MetadataValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
    releasedAt: v.optional(v.number()),
    settledAt: v.optional(v.number()),
  })
    .index("by_payment_order", ["paymentOrderId", "createdAt"])
    .index("by_connected_account", ["connectedAccountId", "createdAt"])
    .index("by_provider_split", ["provider", "providerFundsSplitId"])
    .index("by_status", ["status", "createdAt"]),

  payoutTransfersV2: defineTable({
    connectedAccountId: v.id("connectedAccountsV2"),
    fundSplitId: v.id("fundSplitsV2"),
    provider: v.literal("airwallex"),
    providerTransferId: v.optional(v.string()),
    amountAgorot: v.number(),
    currency: v.string(),
    status: v2PayoutTransferStatusValidator,
    statusRaw: v.optional(v.string()),
    requestId: v.string(),
    idempotencyKey: v.string(),
    failureReason: v.optional(v.string()),
    metadata: v.optional(v2MetadataValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
    paidAt: v.optional(v.number()),
  })
    .index("by_connected_account", ["connectedAccountId", "createdAt"])
    .index("by_fund_split", ["fundSplitId", "createdAt"])
    .index("by_provider_transfer", ["provider", "providerTransferId"])
    .index("by_status", ["status", "createdAt"]),

  payoutPreferencesV2: defineTable({
    userId: v.id("users"),
    mode: v.union(
      v.literal("immediate_when_eligible"),
      v.literal("scheduled_date"),
      v.literal("manual_hold"),
    ),
    scheduledDate: v.optional(v.number()),
    autoPayoutEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  ledgerEntriesV2: defineTable({
    paymentOrderId: v.id("paymentOrdersV2"),
    paymentAttemptId: v.optional(v.id("paymentAttemptsV2")),
    fundSplitId: v.optional(v.id("fundSplitsV2")),
    payoutTransferId: v.optional(v.id("payoutTransfersV2")),
    jobId: v.id("jobs"),
    studioUserId: v.id("users"),
    instructorUserId: v.optional(v.id("users")),
    entryType: v2LedgerEntryTypeValidator,
    bucket: v2LedgerBucketValidator,
    amountAgorot: v.number(),
    currency: v.string(),
    dedupeKey: v.string(),
    referenceType: v.union(
      v.literal("payment_order"),
      v.literal("payment_attempt"),
      v.literal("fund_split"),
      v.literal("payout_transfer"),
      v.literal("provider_event"),
      v.literal("refund"),
      v.literal("adjustment"),
    ),
    referenceId: v.string(),
    createdAt: v.number(),
  })
    .index("by_payment_order", ["paymentOrderId", "createdAt"])
    .index("by_instructor_bucket", ["instructorUserId", "bucket", "createdAt"])
    .index("by_reference", ["referenceType", "referenceId", "createdAt"])
    .index("by_dedupe_key", ["dedupeKey"]),

  pricingRulesV2: defineTable({
    code: v.string(),
    country: v.string(),
    currency: v.string(),
    basePlatformFeeAgorot: v.number(),
    bonusPlatformFeeAgorot: v.number(),
    bonusTriggerMode: v.union(v.literal("bonus_amount_positive")),
    active: v.boolean(),
    version: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code", "createdAt"])
    .index("by_active_country_currency", ["active", "country", "currency", "createdAt"]),

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
    provider: v.union(v.literal("rapyd"), v.literal("didit"), v.literal("airwallex")),
    route: v.union(
      v.literal("payment"),
      v.literal("payout"),
      v.literal("beneficiary"),
      v.literal("kyc"),
      v.literal("connected_account"),
      v.literal("fund_split"),
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
});
