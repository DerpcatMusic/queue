import { defineTable } from "convex/server";
import { v } from "convex/values";
import { internalAccessRoleValidator } from "./lib/internalAccess";

export const identityCoreTables = {
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
    // SECURITY: Unique constraint to prevent duplicate active grants per email
    .index("by_email_active_unique", ["email", "active"], { unique: true })
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
};
