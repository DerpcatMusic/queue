import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Critical operation audit log for security and compliance.
 * 
 * Logs:
 * - Role switches
 * - Job acceptances/rejections
 * - Payment creation
 * - Internal access grants
 * - Cancellations
 */
export const auditTables = {
  internalAuditLogs: defineTable({
    // Action metadata
    action: v.union(
      v.literal("role_switch"),
      v.literal("role_set"),
      v.literal("application_accepted"),
      v.literal("application_rejected"),
      v.literal("job_cancelled_by_studio"),
      v.literal("job_cancelled_by_instructor"),
      v.literal("payment_offer_created"),
      v.literal("payment_order_created"),
      v.literal("internal_access_grant"),
      v.literal("internal_access_revoke"),
    ),
    
    // Actor (who performed the action)
    actorId: v.optional(v.id("users")),
    actorEmail: v.optional(v.string()),
    actorRole: v.optional(v.union(v.literal("pending"), v.literal("instructor"), v.literal("studio"))),
    
    // Target (what was affected)
    targetType: v.optional(v.union(
      v.literal("user"),
      v.literal("job"),
      v.literal("application"),
      v.literal("payment_offer"),
      v.literal("payment_order"),
      v.literal("internal_access"),
    )),
    targetId: v.optional(v.string()), // Can be any ID type, stored as string for flexibility
    
    // Context
    metadata: v.optional(v.object({
      // Role-related
      previousRole: v.optional(v.string()),
      newRole: v.optional(v.string()),
      
      // Job/application related
      jobId: v.optional(v.id("jobs")),
      instructorId: v.optional(v.id("instructorProfiles")),
      studioId: v.optional(v.id("studioProfiles")),
      applicationId: v.optional(v.id("jobApplications")),
      
      // Payment related
      offerId: v.optional(v.id("paymentOffers")),
      orderId: v.optional(v.id("paymentOrders")),
      amountAgorot: v.optional(v.number()),
      
      // Internal access related
      grantedRole: v.optional(v.string()),
      targetUserId: v.optional(v.id("users")),
      targetEmail: v.optional(v.string()),
      
      // Cancellation
      cancellationReason: v.optional(v.string()),
      
      // Additional details
      description: v.optional(v.string()),
    })),
    
    // Result
    result: v.union(v.literal("success"), v.literal("failure")),
    errorMessage: v.optional(v.string()),
    
    // Request context (if available)
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    
    // Timestamps
    timestamp: v.number(),
    createdAt: v.number(),
  })
    .index("by_action", ["action"])
    .index("by_actor", ["actorId", "timestamp"])
    .index("by_target", ["targetType", "targetId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_result", ["result", "timestamp"])
    .index("by_action_timestamp", ["action", "timestamp"]),
};
