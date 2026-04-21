import { defineTable } from "convex/server";
import { v } from "convex/values";

// OTP codes for verifying account deletion requests
export const deletionTables = {
  deletionOtpCodes: defineTable({
    userId: v.id("users"),
    email: v.string(),
    code: v.string(), // Hashed 6-digit code
    salt: v.string(),
    expiresAt: v.number(), // Unix timestamp
    attempts: v.number(), // Track failed attempts (max 3)
    createdAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_email", ["email"])
    .index("by_expires_at", ["expiresAt"]),

  // Pending deletion requests (before OTP verification)
  deletionRequests: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("instructor"), v.literal("studio")),
    status: v.union(
      v.literal("pending_otp"),
      v.literal("otp_verified"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    email: v.string(),
    deletionScheduledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_status", ["status"]),
};
