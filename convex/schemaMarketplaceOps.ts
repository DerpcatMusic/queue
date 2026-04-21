import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  airwallexCanonicalPayloadValidator,
  diditCanonicalPayloadValidator,
  integrationMetadataValidator,
} from "./schemaValidators";

export const marketplaceOpsTables = {
  integrationEvents: defineTable({
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
    eventType: v.optional(v.string()),
    signatureValid: v.boolean(),
    payloadHash: v.string(),
    payload: v.union(diditCanonicalPayloadValidator, airwallexCanonicalPayloadValidator),
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

  webhookInvalidSignatureThrottle: defineTable({
    provider: v.union(v.literal("stripe"), v.literal("didit"), v.literal("airwallex")),
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

  // Replay attack prevention - tracks webhook event processing
  webhookEventIdempotency: defineTable({
    provider: v.union(v.literal("stripe"), v.literal("didit"), v.literal("airwallex")),
    eventId: v.string(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    processedAt: v.optional(v.number()),
    success: v.optional(v.boolean()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_provider_eventId", ["provider", "eventId"])
    .index("by_provider_processedAt", ["provider", "processedAt"]),

  apiRateLimitThrottle: defineTable({
    identifier: v.string(),
    operationType: v.union(
      v.literal("query"),
      v.literal("mutation"),
      v.literal("auth"),
      v.literal("payment"),
      v.literal("webhook"),
      v.literal("batch:markNotificationsRead"),
      v.literal("batch:bulkDelete"),
      v.literal("batch:bulkArchive"),
      v.literal("batch:exportData"),
      v.literal("batch:batchUpdate"),
    ),
    windowStartedAt: v.number(),
    requestCount: v.number(),
    blockedUntil: v.optional(v.number()),
    // Multi-layer tracking for rate limit analysis
    userId: v.optional(v.string()),
    deviceHash: v.optional(v.string()),
    ipHash: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_identifier_type", ["identifier", "operationType"])
    .index("by_identifier_blocked_until", ["identifier", "blockedUntil"])
    .index("by_userId", ["userId"])
    .index("by_deviceHash", ["deviceHash"])
    .index("by_ipHash", ["ipHash"]),

  // Proof-of-work challenges for expensive batch operations
  rateLimitPowChallenges: defineTable({
    challengeId: v.string(),
    operationType: v.string(),
    difficulty: v.number(),
    target: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    used: v.boolean(),
  })
    .index("by_challenge_id", ["challengeId"])
    .index("by_expires_at", ["expiresAt"]),
};
