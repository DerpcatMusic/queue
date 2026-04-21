import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  v2ConnectedAccountStatusValidator,
  v2FundSplitStatusValidator,
  v2LedgerBucketValidator,
  v2LedgerEntryTypeValidator,
  v2MetadataValidator,
  v2MoneyBreakdownValidator,
  v2PaymentOrderStatusValidator,
  v2PayoutTransferStatusValidator,
  v2PricingSnapshotValidator,
  v2RequirementKindValidator,
} from "./schemaValidators";

export const billingCurrentTables = {
  paymentOffers: defineTable({
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
    idempotencyKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_job", ["jobId", "createdAt"])
    .index("by_studio_user", ["studioUserId", "createdAt"])
    .index("by_instructor_user", ["instructorUserId", "createdAt"])
    .index("by_status", ["status", "createdAt"])
    .index("by_idempotency_key", ["idempotencyKey"]),

  paymentOrders: defineTable({
    offerId: v.optional(v.id("paymentOffers")),
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    studioUserId: v.id("users"),
    instructorId: v.id("instructorProfiles"),
    instructorUserId: v.id("users"),
    provider: v.union(v.literal("airwallex"), v.literal("stripe")),
    status: v2PaymentOrderStatusValidator,
    correlationToken: v.optional(v.string()),
    providerCountry: v.optional(v.string()),
    currency: v.string(),
    instructorGrossAmountAgorot: v.optional(v.number()),
    platformFeeAmountAgorot: v.optional(v.number()),
    platformFeeBps: v.optional(v.number()),
    studioChargeAmountAgorot: v.optional(v.number()),
    pricing: v.optional(v2MoneyBreakdownValidator),
    capturedAmountAgorot: v.optional(v.number()),
    refundedAmountAgorot: v.optional(v.number()),
    correlationKey: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
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
    .index("by_correlation_key", ["correlationKey"])
    .index("by_idempotency_key", ["idempotencyKey"])
    // SECURITY: Unique index for payment idempotency (prevents duplicate payment orders per job)
    .index("by_job_idempotency", ["jobId", "idempotencyKey"]),

  paymentAttempts: defineTable({
    paymentOrderId: v.id("paymentOrders"),
    provider: v.union(v.literal("airwallex"), v.literal("stripe")),
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

  providerObjects: defineTable({
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

  connectedAccounts: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("instructor"), v.literal("studio")),
    provider: v.union(v.literal("airwallex"), v.literal("stripe")),
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

  connectedAccountRequirements: defineTable({
    connectedAccountId: v.id("connectedAccounts"),
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

  fundSplits: defineTable({
    paymentOrderId: v.id("paymentOrders"),
    paymentAttemptId: v.id("paymentAttempts"),
    connectedAccountId: v.id("connectedAccounts"),
    provider: v.union(v.literal("airwallex"), v.literal("stripe")),
    providerFundsSplitId: v.optional(v.string()),
    sourcePaymentIntentId: v.string(),
    destinationAccountId: v.string(),
    amountAgorot: v.number(),
    currency: v.string(),
    autoRelease: v.boolean(),
    releaseMode: v.union(v.literal("automatic"), v.literal("manual"), v.literal("scheduled")),
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

  payoutTransfers: defineTable({
    connectedAccountId: v.id("connectedAccounts"),
    fundSplitId: v.id("fundSplits"),
    provider: v.union(v.literal("airwallex"), v.literal("stripe")),
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

  paymentOrderSummaries: defineTable({
    paymentOrderId: v.id("paymentOrders"),
    offerId: v.optional(v.id("paymentOffers")),
    jobId: v.id("jobs"),
    studioId: v.id("studioProfiles"),
    studioUserId: v.id("users"),
    instructorId: v.id("instructorProfiles"),
    instructorUserId: v.id("users"),
    provider: v.union(v.literal("airwallex"), v.literal("stripe")),
    status: v2PaymentOrderStatusValidator,
    currency: v.string(),
    studioChargeAmountAgorot: v.number(),
    instructorBaseAmountAgorot: v.number(),
    platformMarkupAmountAgorot: v.number(),
    capturedAmountAgorot: v.number(),
    refundedAmountAgorot: v.number(),
    correlationKey: v.optional(v.string()),
    latestError: v.optional(v.string()),
    latestAttemptId: v.optional(v.id("paymentAttempts")),
    latestAttemptStatus: v.optional(v2PaymentOrderStatusValidator),
    latestAttemptStatusRaw: v.optional(v.string()),
    latestAttemptProviderPaymentIntentId: v.optional(v.string()),
    latestSplitId: v.optional(v.id("fundSplits")),
    latestSplitStatus: v.optional(v2FundSplitStatusValidator),
    latestSplitSettledAt: v.optional(v.number()),
    latestTransferId: v.optional(v.id("payoutTransfers")),
    latestTransferStatus: v.optional(v2PayoutTransferStatusValidator),
    latestTransferPaidAt: v.optional(v.number()),
    receiptUrl: v.optional(v.string()),
    receiptNumber: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    succeededAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
  })
    .index("by_payment_order", ["paymentOrderId"])
    .index("by_job", ["jobId", "createdAt"])
    .index("by_studio_user", ["studioUserId", "createdAt"])
    .index("by_instructor_user", ["instructorUserId", "createdAt"])
    .index("by_status", ["status", "createdAt"]),

  payoutPreferences: defineTable({
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

  ledgerEntries: defineTable({
    paymentOrderId: v.id("paymentOrders"),
    paymentAttemptId: v.optional(v.id("paymentAttempts")),
    fundSplitId: v.optional(v.id("fundSplits")),
    payoutTransferId: v.optional(v.id("payoutTransfers")),
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

  paymentMigrationRefs: defineTable({
    sourceTable: v.union(
      v.literal("paymentOffersV2"),
      v.literal("connectedAccountsV2"),
      v.literal("providerObjectsV2"),
      v.literal("connectedAccountRequirementsV2"),
      v.literal("payoutPreferencesV2"),
      v.literal("pricingRulesV2"),
      v.literal("paymentOrdersV2"),
      v.literal("paymentAttemptsV2"),
      v.literal("fundSplitsV2"),
      v.literal("payoutTransfersV2"),
      v.literal("ledgerEntriesV2"),
    ),
    sourceId: v.string(),
    targetTable: v.union(
      v.literal("paymentOffers"),
      v.literal("connectedAccounts"),
      v.literal("providerObjects"),
      v.literal("connectedAccountRequirements"),
      v.literal("payoutPreferences"),
      v.literal("pricingRules"),
      v.literal("paymentOrders"),
      v.literal("paymentAttempts"),
      v.literal("fundSplits"),
      v.literal("payoutTransfers"),
      v.literal("ledgerEntries"),
    ),
    targetId: v.string(),
    createdAt: v.number(),
  })
    .index("by_source", ["sourceTable", "sourceId"])
    .index("by_target", ["targetTable", "targetId"]),

  pricingRules: defineTable({
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

  webhookDeliveries: defineTable({
    provider: v.union(v.literal("didit"), v.literal("airwallex")),
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
};
