import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const socialLinksValidator = v.object({
  instagram: v.optional(v.string()),
  tiktok: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
  facebook: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  website: v.optional(v.string()),
});

export default defineSchema({
  ...authTables,
  users: defineTable({
    role: v.union(v.literal("pending"), v.literal("instructor"), v.literal("studio")),
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

  instructorProfiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    bio: v.optional(v.string()),
    socialLinks: v.optional(socialLinksValidator),
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

  calendarIntegrations: defineTable({
    userId: v.id("users"),
    instructorId: v.id("instructorProfiles"),
    provider: v.union(v.literal("google"), v.literal("apple")),
    status: v.union(v.literal("connected"), v.literal("error"), v.literal("revoked")),
    accountEmail: v.optional(v.string()),
    oauthClientId: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    scopes: v.optional(v.array(v.string())),
    lastSyncedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_provider", ["userId", "provider"])
    .index("by_instructor_provider", ["instructorId", "provider"]),

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
      v.union(v.literal("hebrew"), v.literal("english"), v.literal("arabic"), v.literal("russian")),
    ),
    isRecurring: v.optional(v.boolean()),
    cancellationDeadlineHours: v.optional(v.number()),
    applicationDeadline: v.optional(v.number()),
  })
    .index("by_studio", ["studioId"])
    .index("by_studio_postedAt", ["studioId", "postedAt"])
    .index("by_studio_startTime", ["studioId", "startTime"])
    .index("by_status", ["status"])
    .index("by_status_postedAt", ["status", "postedAt"])
    .index("by_filledByInstructor_startTime", ["filledByInstructorId", "startTime"])
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

  payments: defineTable({
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
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
    metadata: v.optional(v.any()),
    lastError: v.optional(v.string()),
    capturedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_studio", ["studioId", "createdAt"])
    .index("by_studio_user", ["studioUserId", "createdAt"])
    .index("by_instructor_user", ["instructorUserId", "createdAt"])
    .index("by_job", ["jobId", "createdAt"])
    .index("by_status", ["status", "createdAt"])
    .index("by_studio_user_idempotency", ["studioUserId", "idempotencyKey"])
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
    payload: v.any(),
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
    paymentId: v.id("payments"),
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
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
    payload: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_payout", ["payoutId", "createdAt"])
    .index("by_payment", ["paymentId", "createdAt"])
    .index("by_provider_eventId", ["provider", "providerEventId"]),

  payoutDestinations: defineTable({
    userId: v.id("users"),
    provider: v.literal("rapyd"),
    type: v.string(),
    externalRecipientId: v.string(),
    label: v.optional(v.string()),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    last4: v.optional(v.string()),
    isDefault: v.boolean(),
    status: v.string(),
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
    payload: v.any(),
    processingError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_provider_eventId", ["provider", "providerEventId"])
    .index("by_user", ["userId", "createdAt"]),

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

  diditEvents: defineTable({
    providerEventId: v.string(),
    sessionId: v.optional(v.string()),
    instructorId: v.optional(v.id("instructorProfiles")),
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
    payload: v.any(),
    processingError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_provider_event_id", ["providerEventId"])
    .index("by_instructor", ["instructorId", "createdAt"]),

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
