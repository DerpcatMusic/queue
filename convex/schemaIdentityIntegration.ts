import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  diditCanonicalPayloadValidator,
  diditVerificationStatusValidator,
} from "./schemaValidators";

export const identityIntegrationTables = {
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

  diditEvents: defineTable({
    providerEventId: v.string(),
    sessionId: v.optional(v.string()),
    instructorId: v.optional(v.id("instructorProfiles")),
    studioId: v.optional(v.id("studioProfiles")),
    vendorData: v.optional(v.string()),
    statusRaw: v.optional(v.string()),
    mappedStatus: v.optional(diditVerificationStatusValidator),
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
};
