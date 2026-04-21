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

export const billingLegacyTables = {
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
    provider: v.union(v.literal("airwallex"), v.literal("stripe")),
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

  payoutTransfersV2: defineTable({
    connectedAccountId: v.id("connectedAccountsV2"),
    fundSplitId: v.id("fundSplitsV2"),
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
};
